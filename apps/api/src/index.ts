import {
  handleAdminLogin,
  handleAdminLogout,
  handleAdminMe,
  handleAdminFeed,
  handleAdminUserDetail,
  handleAdminUsers,
  handlePasskeyLoginBegin,
  handlePasskeyLoginFinish,
  handlePasskeyRegisterBegin,
  handlePasskeyRegisterFinish,
  handlePasskeyRevoke,
  handlePasskeys,
} from './adminPanel'
import {
  appendCors,
  buildFrontendRedirect,
  json,
  parseCookies,
  serializeCookie,
  shareableCookieDomain,
  type Env,
} from './env'
import {
  bumpMetric,
  handleAdminAudit,
  handleAdminHealth,
  handleAdminSummary,
  handleAdminTransfers,
  handleAppendEvent,
  handleCancelTransfer,
  handleCreateTransfer,
  handleGetTransfer,
} from './transfers'
import {
  handleKeyUsage,
  handleListKeys,
  handleMintKey,
  handleRevokeKey,
} from './apiKeysHandlers'
import { handleDashboard as _unusedDashboard } from './dashboard'
void _unusedDashboard


const VAULT_MAX_FILE_BYTES = 1024 * 1024 * 1024
const VAULT_DAILY_QUOTA_BYTES = 10 * 1024 * 1024 * 1024
const QUOTA_KV_TTL_SECONDS = 49 * 60 * 60
const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60
const ACCESS_TOKEN_SKEW_MS = 60_000

function redirect(url: string, headers?: HeadersInit): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...headers,
    },
  })
}

function encodeBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function utcDate(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

function randomHex(bytes = 16): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function appendSetCookie(headers: Headers, value: string): void {
  headers.append('Set-Cookie', value)
}

function normalizeShareToken(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function withNoStore(headers: Headers): Headers {
  headers.set('Cache-Control', 'no-store')
  return headers
}

function getRequiredCookie(cookies: Map<string, string>, name: string): string | null {
  const value = cookies.get(name)
  return value?.trim() ? value.trim() : null
}

async function kvGetJson<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.DRIVE_SESSION_STORE.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function kvPutJson(env: Env, key: string, value: unknown, expirationTtl?: number): Promise<void> {
  await env.DRIVE_SESSION_STORE.put(key, JSON.stringify(value), expirationTtl ? { expirationTtl } : undefined)
}

async function kvDelete(env: Env, ...keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => env.DRIVE_SESSION_STORE.delete(key)))
}

async function listAllKeys(env: Env, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined

  do {
    const page = await env.DRIVE_SESSION_STORE.list({ prefix, cursor })
    keys.push(...page.keys.map(item => item.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  return keys
}

async function dispatch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      const headers = new Headers()
      appendCors(headers, request, env)
      return new Response(null, { status: 204, headers })
    }

    // ─── Operator dashboard ───────────────────────────────────────────
    // The dashboard now lives entirely on clex.in/admin (Pages-served HTML
    // matching the rest of the site). Both api.clex.in/ and any
    // /dashboard request redirect there so there is one canonical UI.
    if (
      ((url.pathname === '/dashboard' || url.pathname === '/dashboard/') ||
       (url.pathname === '/' && url.hostname.startsWith('api.'))) &&
      request.method === 'GET'
    ) {
      return Response.redirect('https://clex.in/admin', 302)
    }

    // ─── API key management ───────────────────────────────────────────
    if (url.pathname === '/api/keys' && request.method === 'GET') {
      return handleListKeys(request, env)
    }
    if (url.pathname === '/api/keys' && request.method === 'POST') {
      return handleMintKey(request, env)
    }
    if (url.pathname === '/api/keys/usage' && request.method === 'GET') {
      return handleKeyUsage(request, env)
    }
    const keyMatch = url.pathname.match(/^\/api\/keys\/([A-Za-z0-9]+)$/)
    if (keyMatch && request.method === 'DELETE') {
      return handleRevokeKey(request, env, keyMatch[1])
    }

    // Public liveness probe consumed by lnch.in's LaunchOps health probe and
    // by external uptime monitors. Cheap, never reveals secrets.
    if (
      (url.pathname === '/api/health' || url.pathname === '/health') &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      const body = JSON.stringify({
        ok: true,
        service: 'clex-api',
        ts: Math.floor(Date.now() / 1000),
        version: 'phase-2-admin-api',
        bindings: {
          kv: typeof (env as { DRIVE_SESSION_STORE?: { put?: unknown } }).DRIVE_SESSION_STORE?.put === 'function',
        },
      })
      const headers = new Headers({
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=10, s-maxage=30',
      })
      appendCors(headers, request, env)
      return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers })
    }

    // ─── Public file-transfer API (clex.in/api/transfers) ─────────────
    // Stable shape that powers the upcoming `clex` CLI and any third-party
    // integrator. Storage is KV-backed; the actual file movement happens
    // browser-to-browser via the signaling worker. See apps/api/src/transfers.ts.
    if (url.pathname === '/api/transfers' && request.method === 'POST') {
      return handleCreateTransfer(request, env)
    }
    const transfersMatch = url.pathname.match(/^\/api\/transfers\/([A-Za-z0-9]+)(\/events)?$/)
    if (transfersMatch) {
      const codeOrId = transfersMatch[1]
      const isEventsSub = Boolean(transfersMatch[2])
      if (isEventsSub) {
        if (request.method === 'POST') return handleAppendEvent(request, env, codeOrId)
        return new Response('Method not allowed', { status: 405 })
      }
      if (request.method === 'GET') return handleGetTransfer(request, env, codeOrId)
      if (request.method === 'DELETE') return handleCancelTransfer(request, env, codeOrId)
      return new Response('Method not allowed', { status: 405 })
    }

    // ─── Admin ────────────────────────────────────────────────────────
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env)
    }
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
      return handleAdminLogout(request, env)
    }
    if (url.pathname === '/api/admin/me' && request.method === 'GET') {
      return handleAdminMe(request, env)
    }
    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      return handleAdminUsers(request, env)
    }
    const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
    if (adminUserMatch && request.method === 'GET') {
      return handleAdminUserDetail(request, env, decodeURIComponent(adminUserMatch[1]))
    }
    if (url.pathname === '/api/admin/feeds' && request.method === 'GET') {
      return handleAdminFeed(request, env)
    }
    if (url.pathname === '/api/admin/login/passkey/begin' && request.method === 'POST') {
      return handlePasskeyLoginBegin(request, env)
    }
    if (url.pathname === '/api/admin/login/passkey/finish' && request.method === 'POST') {
      return handlePasskeyLoginFinish(request, env)
    }
    if (url.pathname === '/api/admin/passkeys/register/begin' && request.method === 'POST') {
      return handlePasskeyRegisterBegin(request, env)
    }
    if (url.pathname === '/api/admin/passkeys/register/finish' && request.method === 'POST') {
      return handlePasskeyRegisterFinish(request, env)
    }
    if (url.pathname === '/api/admin/passkeys' && request.method === 'GET') {
      return handlePasskeys(request, env)
    }
    const passkeyMatch = url.pathname.match(/^\/api\/admin\/passkeys\/([A-Za-z0-9]+)$/)
    if (passkeyMatch && request.method === 'DELETE') {
      return handlePasskeyRevoke(request, env, passkeyMatch[1])
    }
    if (url.pathname === '/api/admin/summary' && request.method === 'GET') {
      return handleAdminSummary(request, env)
    }
    if (url.pathname === '/api/admin/transfers' && request.method === 'GET') {
      return handleAdminTransfers(request, env)
    }
    if (url.pathname === '/api/admin/health' && request.method === 'GET') {
      return handleAdminHealth(request, env)
    }
    if (url.pathname === '/api/admin/audit' && request.method === 'GET') {
      return handleAdminAudit(request, env)
    }

    return new Response('Not found', { status: 404 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const t0 = Date.now()
    const res = await dispatch(request, env)
    // Bucket the metrics route by the static prefix so we don't blow out
    // the per-route map with one entry per transfer-id. The transfer-id
    // segment is stripped to `/api/transfers/:id`.
    const route = url.pathname
      .replace(/^\/api\/transfers\/[A-Za-z0-9]+(\/events)?$/, '/api/transfers/:id$1')
    bumpMetric(route, res.status, Date.now() - t0)
    return res
  },

} satisfies ExportedHandler<Env>
