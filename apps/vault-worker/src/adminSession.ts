/**
 * Recognises a clex.in/admin console session on the vault worker.
 *
 * The api worker signs the operator in and stores the session in KV under
 * `admin:sess:<id>`, with the id in an HttpOnly cookie that is host-wide on
 * clex.in. VAULT_TOKENS is that same KV namespace (see wrangler.toml — the ids
 * match), so this worker can check the cookie against the same record without
 * a second sign-in or a shared secret. The rules mirror apps/api/src/adminAuth.ts:
 * cookie + `X-Clex-Admin: 1` + same-origin, or the lnch.in proxy's
 * X-Admin-Secret for read-only calls.
 */

const COOKIE_NAMES = ['__Host-clex_admin', 'clex_admin']
const SESSION_PREFIX = 'admin:sess:'

export interface AdminSessionEnv {
  CLEX_ADMIN_SECRET?: string
  ADMIN_SECRET?: string
  ALLOWED_ORIGIN?: string
}

export type AdminCheck =
  | { ok: true; via: 'session' | 'secret'; sessionId: string | null }
  | { ok: false; status: 401 | 403; error: string }

function readCookie(req: Request): string | null {
  const header = req.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (COOKIE_NAMES.includes(name)) {
      const value = rest.join('=').trim()
      if (/^[0-9a-f]{32}$/.test(value)) return value
    }
  }
  return null
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export async function verifyAdminSecret(env: AdminSessionEnv, candidate: string): Promise<boolean> {
  const expected = env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET || ''
  if (!expected || !candidate) return false
  const [a, b] = await Promise.all([sha256Hex(expected), sha256Hex(candidate)])
  return safeEqual(a, b)
}

function sameOrigin(req: Request, env: AdminSessionEnv): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  if (origin === new URL(req.url).origin) return true
  const allowed = (env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s && s !== '*')
  return allowed.includes(origin)
}

/**
 * @param sessions the KV namespace holding `admin:sess:*`, or undefined when
 *   this deployment has none bound (then only the secret works).
 * @param allowSecret whether X-Admin-Secret is accepted (read-only routes).
 */
export async function checkAdmin(
  req: Request,
  env: AdminSessionEnv,
  sessions: KVNamespace | undefined,
  allowSecret: boolean,
): Promise<AdminCheck> {
  const provided = req.headers.get('x-admin-secret')
  if (provided) {
    if (allowSecret && await verifyAdminSecret(env, provided)) return { ok: true, via: 'secret', sessionId: null }
    return { ok: false, status: 401, error: allowSecret ? 'invalid_admin_secret' : 'admin_session_required' }
  }

  const sessionId = readCookie(req)
  if (!sessionId || !sessions) return { ok: false, status: 401, error: 'admin_session_required' }
  if (req.headers.get('x-clex-admin') !== '1' || !sameOrigin(req, env)) {
    return { ok: false, status: 403, error: 'csrf_check_failed' }
  }

  const raw = await sessions.get(`${SESSION_PREFIX}${sessionId}`)
  if (!raw) return { ok: false, status: 401, error: 'admin_session_expired' }
  try {
    const session = JSON.parse(raw) as { expires_at?: number }
    if (!session.expires_at || session.expires_at * 1000 <= Date.now()) {
      return { ok: false, status: 401, error: 'admin_session_expired' }
    }
  } catch {
    return { ok: false, status: 401, error: 'admin_session_expired' }
  }
  return { ok: true, via: 'session', sessionId }
}
