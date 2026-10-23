/**
 * Admin authentication for clex.in/admin.
 *
 * ─── Session ──────────────────────────────────────────────────────────────
 *
 * A successful sign-in (admin secret or passkey) creates a random session id,
 * stores the session in KV under `admin:sess:<id>` and hands the id to the
 * browser as an HttpOnly, Secure, SameSite=Strict cookie. It used to be
 * returned in the JSON body and kept in localStorage, where any script on
 * clex.in could read it; a cookie the page cannot read removes that.
 *
 * The same KV namespace is bound to the vault worker (as VAULT_TOKENS) and to
 * the chain worker (as ADMIN_SESSIONS), and the cookie is host-wide on
 * clex.in, so /vault/api/admin/* and /chain/admin/* check the very same
 * session. See apps/vault-worker/src/adminSession.ts.
 *
 * ─── CSRF ─────────────────────────────────────────────────────────────────
 *
 * Every cookie-authenticated admin request must carry `X-Clex-Admin: 1`, and
 * its Origin (when the browser sends one) must be this origin. A cross-site
 * page cannot add a custom header without a CORS preflight, which the CORS
 * allow-list refuses, and SameSite=Strict keeps the cookie off cross-site
 * requests in the first place.
 *
 * ─── Machine access ───────────────────────────────────────────────────────
 *
 * The lnch.in operator proxy sends the admin secret as `X-Admin-Secret`.
 * That path is kept for read endpoints; it needs no cookie and no CSRF
 * header because it is not ambient.
 */
import type { Env } from './env'
import { randomHex, safeEqual, sha256Hex } from './crypto'

export const ADMIN_COOKIE = '__Host-clex_admin'
/** `__Host-` cookies require HTTPS; plain-HTTP dev uses this name instead. */
export const ADMIN_COOKIE_DEV = 'clex_admin'
export const ADMIN_CSRF_HEADER = 'x-clex-admin'

const ADMIN_SESSION_PREFIX = 'admin:sess:'
const WEBAUTHN_CHALLENGE_PREFIX = 'admin:webauthn:challenge:'
const LOGIN_LOG_PREFIX = 'admin:loginlog:'
const RATE_PREFIX = 'admin:rl:'

export const ADMIN_SESSION_TTL = 60 * 60 * 8
const WEBAUTHN_CHALLENGE_TTL = 60 * 5
const LOGIN_LOG_TTL = 60 * 60 * 24 * 90
/** A session's last-seen stamp is refreshed at most this often. */
const TOUCH_INTERVAL = 5 * 60

/** Failed sign-ins allowed per address per window before it is locked out. */
export const LOGIN_MAX_FAILURES = 8
export const LOGIN_WINDOW_SECONDS = 15 * 60

export interface AdminSession {
  session_id: string
  created_at: number
  expires_at: number
  last_seen_at?: number
  method: 'password' | 'passkey'
  ip: string | null
  ua: string | null
  passkey_label?: string | null
}

export interface LoginRecord {
  id: string
  created_at: number
  method: 'password' | 'passkey'
  result: 'success' | 'failure' | 'locked'
  reason: string | null
  ip: string | null
  ua: string | null
  country: string | null
  passkey_id: string | null
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function newId(): string {
  return randomHex(16)
}

/**
 * The client's address as the Cloudflare edge saw it. CF-Connecting-IP is
 * overwritten by the edge on every request; X-Forwarded-For is not, so it is
 * deliberately not consulted — a caller could choose its own value there and
 * dodge the sign-in lockout.
 */
export function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') || null
}

export function clientCountry(request: Request): string | null {
  const cf = (request as Request & { cf?: { country?: string } }).cf
  return cf?.country || request.headers.get('cf-ipcountry') || null
}

export function userAgent(request: Request): string | null {
  const ua = request.headers.get('user-agent')
  if (!ua) return null
  return ua.length > 512 ? ua.slice(0, 512) : ua
}

function configuredSecret(env: Env): string {
  return env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET || ''
}

export function adminSecretConfigured(env: Env): boolean {
  return Boolean(configuredSecret(env))
}

/**
 * Constant-time comparison of a candidate against the configured secret.
 * Both sides are hashed first so the comparison runs over equal-length
 * digests and leaks nothing about the secret's length.
 */
export async function verifyAdminSecret(env: Env, candidate: string): Promise<boolean> {
  const expected = configuredSecret(env)
  if (!expected || !candidate) return false
  const [a, b] = await Promise.all([sha256Hex(expected), sha256Hex(candidate)])
  return safeEqual(a, b)
}

function adminSessionKey(sessionId: string): string {
  return `${ADMIN_SESSION_PREFIX}${sessionId}`
}

function webauthnChallengeKey(handle: string): string {
  return `${WEBAUTHN_CHALLENGE_PREFIX}${handle}`
}

/** KV metadata is capped at 1024 bytes; the listing only needs these. */
function sessionMetadata(session: AdminSession) {
  return {
    created_at: session.created_at,
    expires_at: session.expires_at,
    last_seen_at: session.last_seen_at ?? session.created_at,
    method: session.method,
    ip: session.ip,
    ua: session.ua ? session.ua.slice(0, 200) : null,
    passkey_label: session.passkey_label ? session.passkey_label.slice(0, 80) : null,
  }
}

async function putAdminSession(env: Env, session: AdminSession): Promise<void> {
  const ttl = Math.max(60, session.expires_at - nowSeconds())
  await env.DRIVE_SESSION_STORE.put(adminSessionKey(session.session_id), JSON.stringify(session), {
    expirationTtl: ttl,
    metadata: sessionMetadata(session),
  })
}

export async function getAdminSession(env: Env, sessionId: string): Promise<AdminSession | null> {
  if (!/^[0-9a-f]{32}$/.test(sessionId)) return null
  const raw = await env.DRIVE_SESSION_STORE.get(adminSessionKey(sessionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export async function deleteAdminSession(env: Env, sessionId: string): Promise<void> {
  if (!/^[0-9a-f]{32}$/.test(sessionId)) return
  await env.DRIVE_SESSION_STORE.delete(adminSessionKey(sessionId))
}

export async function listAdminSessions(env: Env): Promise<(ReturnType<typeof sessionMetadata> & { session_id: string })[]> {
  const out: (ReturnType<typeof sessionMetadata> & { session_id: string })[] = []
  let cursor: string | undefined
  do {
    const page = await env.DRIVE_SESSION_STORE.list<ReturnType<typeof sessionMetadata>>({ prefix: ADMIN_SESSION_PREFIX, cursor })
    for (const key of page.keys) {
      const id = key.name.slice(ADMIN_SESSION_PREFIX.length)
      if (key.metadata) out.push({ session_id: id, ...key.metadata })
      else {
        // Sessions written before metadata existed.
        const session = await getAdminSession(env, id)
        if (session) out.push({ session_id: id, ...sessionMetadata(session) })
      }
    }
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return out
    .filter(s => s.expires_at > nowSeconds())
    .sort((a, b) => (b.last_seen_at ?? 0) - (a.last_seen_at ?? 0))
}

export async function startAdminSession(
  env: Env,
  method: 'password' | 'passkey',
  ip: string | null,
  ua: string | null,
  passkeyLabel: string | null = null,
): Promise<AdminSession> {
  const now = nowSeconds()
  const session: AdminSession = {
    session_id: newId(),
    created_at: now,
    expires_at: now + ADMIN_SESSION_TTL,
    last_seen_at: now,
    method,
    ip,
    ua,
    passkey_label: passkeyLabel,
  }
  await putAdminSession(env, session)
  return session
}

// ── Cookie ────────────────────────────────────────────────────────────────

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('cookie') || ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === ADMIN_COOKIE || name === ADMIN_COOKIE_DEV) {
      const value = rest.join('=').trim()
      if (/^[0-9a-f]{32}$/.test(value)) return value
    }
  }
  return null
}

export function sessionCookie(request: Request, sessionId: string, maxAge = ADMIN_SESSION_TTL): string {
  if (isHttps(request)) {
    return `${ADMIN_COOKIE}=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`
  }
  return `${ADMIN_COOKIE_DEV}=${sessionId}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict`
}

export function clearSessionCookie(request: Request): string {
  return sessionCookie(request, '', 0)
}

// ── Guard ─────────────────────────────────────────────────────────────────

/**
 * True when the request comes from this site. Browsers send Origin on every
 * POST/DELETE and on cross-origin GETs; a missing Origin on a same-origin GET
 * is normal.
 */
function sameOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const self = new URL(request.url).origin
  if (origin === self) return true
  const allowed = (env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry && entry !== '*')
  return allowed.includes(origin)
}

export type AdminGuard =
  | { ok: true; via: 'session'; session: AdminSession }
  | { ok: true; via: 'secret'; session: null }
  | { ok: false; error: Response }

export async function requireAdmin(
  env: Env,
  request: Request,
  options: { allowSecret?: boolean } = {},
): Promise<AdminGuard> {
  const provided = request.headers.get('x-admin-secret')
  if (provided && options.allowSecret) {
    if (await verifyAdminSecret(env, provided)) return { ok: true, via: 'secret', session: null }
    return { ok: false, error: adminError('invalid_admin_secret') }
  }

  const sessionId = readSessionCookie(request)
  if (!sessionId) return { ok: false, error: adminError('admin_session_required') }

  if (request.headers.get(ADMIN_CSRF_HEADER) !== '1' || !sameOrigin(request, env)) {
    return { ok: false, error: adminError('csrf_check_failed', 403) }
  }

  const session = await getAdminSession(env, sessionId)
  const now = nowSeconds()
  if (!session || session.expires_at <= now) {
    if (session) await deleteAdminSession(env, sessionId)
    return { ok: false, error: adminError('admin_session_expired') }
  }

  if (!session.last_seen_at || now - session.last_seen_at > TOUCH_INTERVAL) {
    session.last_seen_at = now
    await putAdminSession(env, session).catch(() => undefined)
  }

  return { ok: true, via: 'session', session }
}

export function adminError(error: string, status = 401, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
      ...extra,
    },
  })
}

// ── Sign-in throttling ────────────────────────────────────────────────────

interface RateRecord {
  failures: number
  first_at: number
}

async function rateKey(ip: string | null): Promise<string> {
  return `${RATE_PREFIX}${(await sha256Hex(ip || 'unknown')).slice(0, 32)}`
}

/** Seconds until this address may try again, or 0 when it is not locked. */
export async function loginLockedFor(env: Env, ip: string | null): Promise<number> {
  const raw = await env.DRIVE_SESSION_STORE.get(await rateKey(ip))
  if (!raw) return 0
  try {
    const rec = JSON.parse(raw) as RateRecord
    if (rec.failures < LOGIN_MAX_FAILURES) return 0
    return Math.max(0, rec.first_at + LOGIN_WINDOW_SECONDS - nowSeconds())
  } catch {
    return 0
  }
}

export async function recordLoginFailure(env: Env, ip: string | null): Promise<void> {
  const key = await rateKey(ip)
  const now = nowSeconds()
  let rec: RateRecord = { failures: 0, first_at: now }
  const raw = await env.DRIVE_SESSION_STORE.get(key)
  if (raw) {
    try {
      const prev = JSON.parse(raw) as RateRecord
      if (prev.first_at + LOGIN_WINDOW_SECONDS > now) rec = prev
    } catch { /* start a fresh window */ }
  }
  rec.failures += 1
  await env.DRIVE_SESSION_STORE.put(key, JSON.stringify(rec), {
    expirationTtl: Math.max(60, rec.first_at + LOGIN_WINDOW_SECONDS - now),
  })
}

export async function clearLoginFailures(env: Env, ip: string | null): Promise<void> {
  await env.DRIVE_SESSION_STORE.delete(await rateKey(ip))
}

// ── Sign-in log ───────────────────────────────────────────────────────────

/**
 * Each attempt is one KV key whose name sorts newest-first (the timestamp is
 * inverted) and whose record rides in the key's metadata, so the audit view
 * is a single list call instead of one read per entry.
 */
export async function logAdminLogin(
  env: Env,
  fields: Omit<LoginRecord, 'id' | 'created_at'>,
): Promise<void> {
  const record: LoginRecord = { id: newId(), created_at: nowSeconds(), ...fields }
  const inverted = String(9_999_999_999 - record.created_at).padStart(10, '0')
  const metadata = {
    ...record,
    ua: record.ua ? record.ua.slice(0, 220) : null,
    reason: record.reason ? record.reason.slice(0, 120) : null,
  }
  await env.DRIVE_SESSION_STORE.put(`${LOGIN_LOG_PREFIX}${inverted}:${record.id}`, '1', {
    expirationTtl: LOGIN_LOG_TTL,
    metadata,
  })
}

export async function listAdminLogins(env: Env, limit: number): Promise<LoginRecord[]> {
  const page = await env.DRIVE_SESSION_STORE.list<LoginRecord>({ prefix: LOGIN_LOG_PREFIX, limit })
  return page.keys.map(key => key.metadata).filter((m): m is LoginRecord => Boolean(m))
}

// ── WebAuthn challenges ───────────────────────────────────────────────────

export async function putWebauthnChallenge(
  env: Env,
  handle: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await env.DRIVE_SESSION_STORE.put(webauthnChallengeKey(handle), JSON.stringify(payload), {
    expirationTtl: WEBAUTHN_CHALLENGE_TTL,
  })
}

export async function takeWebauthnChallenge(
  env: Env,
  handle: string,
): Promise<Record<string, unknown> | null> {
  if (!/^[0-9a-f]{32}$/.test(handle)) return null
  const key = webauthnChallengeKey(handle)
  const raw = await env.DRIVE_SESSION_STORE.get(key)
  if (!raw) return null
  await env.DRIVE_SESSION_STORE.delete(key)
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}
