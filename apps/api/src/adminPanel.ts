/**
 * /api/admin/* — sign-in, sessions, sign-in audit and passkeys.
 *
 * Everything the console shows about users, keys and uploads lives in the
 * vault worker's D1 database and is served by /vault/api/admin/*; transfer
 * sessions and worker metrics are in ./transfers. This module owns who may
 * open the console at all.
 */
import { appendCors, type Env } from './env'
import { base64urlEncode, randomBytes } from './crypto'
import {
  ADMIN_SESSION_TTL,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS,
  adminError,
  adminSecretConfigured,
  clearLoginFailures,
  clearSessionCookie,
  clientCountry,
  clientIp,
  deleteAdminSession,
  listAdminLogins,
  listAdminSessions,
  logAdminLogin,
  loginLockedFor,
  newId,
  nowSeconds,
  putWebauthnChallenge,
  readSessionCookie,
  reserveLoginAttempt,
  requireAdmin,
  sameOrigin,
  sessionCookie,
  startAdminSession,
  takeWebauthnChallenge,
  userAgent,
  verifyAdminSecret,
  type AdminSession,
} from './adminAuth'
import { rpOriginsFromEnv, verifyAssertion, verifyRegistration } from './webauthn'

interface AdminPasskeyRow {
  id: string
  credential_id: string
  public_key: string
  /** COSE algorithm: -7 ES256, -257 RS256. Rows from before this field are ES256. */
  alg?: number
  counter: number
  transports: string | null
  label: string | null
  created_at: number
  created_ip: string | null
  last_used_at: number | null
  last_used_ip: string | null
  revoked_at: number | null
}

const PASSKEY_PREFIX = 'admin:passkey:'
const PASSKEY_LOOKUP_PREFIX = 'admin:passkey:lookup:'

export function jsonResponse(
  data: unknown,
  request: Request,
  env: Env,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
    ...extra,
  })
  appendCors(headers, request, env)
  return new Response(JSON.stringify(data), { status, headers })
}

function withCookie(response: Response, cookie: string): Response {
  const headers = new Headers(response.headers)
  headers.append('Set-Cookie', cookie)
  return new Response(response.body, { status: response.status, headers })
}

function rpIdFor(request: Request, env: Env): string {
  return env.WEBAUTHN_RP_ID || new URL(env.FRONTEND_BASE_URL || request.url).hostname
}

function parseTransports(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : undefined
  } catch {
    return undefined
  }
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T
  } catch {
    return null
  }
}

function publicSession(session: AdminSession) {
  return {
    session_id: session.session_id.slice(0, 12),
    created_at: session.created_at,
    expires_at: session.expires_at,
    last_seen_at: session.last_seen_at ?? session.created_at,
    method: session.method,
    ip: session.ip,
    ua: session.ua,
    passkey_label: session.passkey_label ?? null,
  }
}

// ── Passkey storage ───────────────────────────────────────────────────────

async function listAdminPasskeys(env: Env, includeRevoked = false): Promise<AdminPasskeyRow[]> {
  const rows: AdminPasskeyRow[] = []
  const list = await env.DRIVE_SESSION_STORE.list({ prefix: PASSKEY_PREFIX, limit: 1000 })
  await Promise.all(list.keys.map(async key => {
    // The lookup index shares the prefix; its values are bare ids.
    if (key.name.startsWith(PASSKEY_LOOKUP_PREFIX)) return
    const raw = await env.DRIVE_SESSION_STORE.get(key.name)
    if (!raw) return
    try {
      const row = JSON.parse(raw) as AdminPasskeyRow
      if (includeRevoked || !row.revoked_at) rows.push(row)
    } catch {
      // ignore malformed stored rows
    }
  }))
  return rows.sort((a, b) => b.created_at - a.created_at)
}

async function getAdminPasskey(env: Env, credentialId: string): Promise<AdminPasskeyRow | null> {
  if (!credentialId || credentialId.length > 1024) return null
  const id = await env.DRIVE_SESSION_STORE.get(`${PASSKEY_LOOKUP_PREFIX}${credentialId}`)
  if (!id) return null
  const raw = await env.DRIVE_SESSION_STORE.get(`${PASSKEY_PREFIX}${id}`)
  if (!raw) return null
  try {
    const row = JSON.parse(raw) as AdminPasskeyRow
    if (row.revoked_at) return null
    return row
  } catch {
    return null
  }
}

async function putAdminPasskey(env: Env, row: AdminPasskeyRow): Promise<void> {
  await Promise.all([
    env.DRIVE_SESSION_STORE.put(`${PASSKEY_PREFIX}${row.id}`, JSON.stringify(row)),
    env.DRIVE_SESSION_STORE.put(`${PASSKEY_LOOKUP_PREFIX}${row.credential_id}`, row.id),
  ])
}

// ── Sign-in ───────────────────────────────────────────────────────────────

/**
 * Sign-in requests must come from this site, as JSON. A page on another site
 * can POST `text/plain` without a CORS preflight, and sign-ins are counted per
 * address — so without this, any page an operator visited could spend that
 * operator's attempts and lock them out. Requiring JSON forces a preflight the
 * CORS allow-list refuses, and a foreign Origin is turned away before anything
 * is counted. Clients that send no Origin (curl) are not browsers and can only
 * spend their own address's attempts.
 */
function rejectForeignSignIn(request: Request, env: Env): Response | null {
  if (!sameOrigin(request, env)) return jsonResponse({ error: 'origin_not_allowed' }, request, env, 403)
  const type = (request.headers.get('content-type') || '').toLowerCase()
  if (!type.startsWith('application/json')) return jsonResponse({ error: 'json_required' }, request, env, 415)
  return null
}

function tooManyAttempts(request: Request, env: Env, wait: number): Response {
  return jsonResponse(
    { error: 'too_many_attempts', retry_after: wait },
    request, env, 429, { 'retry-after': String(wait) },
  )
}

async function logLocked(request: Request, env: Env, method: 'password' | 'passkey'): Promise<void> {
  await logAdminLogin(env, {
    method, result: 'locked', reason: 'too_many_attempts', ip: clientIp(request), ua: userAgent(request),
    country: clientCountry(request), passkey_id: null,
  })
}

function signedIn(request: Request, env: Env, session: AdminSession, extra: Record<string, unknown> = {}): Response {
  return withCookie(
    jsonResponse({ ok: true, session: publicSession(session), ...extra }, request, env),
    sessionCookie(request, session.session_id),
  )
}

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request)
  const ua = userAgent(request)
  const country = clientCountry(request)

  const foreign = rejectForeignSignIn(request, env)
  if (foreign) return foreign

  if (!adminSecretConfigured(env)) {
    return jsonResponse({ error: 'admin_secret_not_configured' }, request, env, 503)
  }

  const body = await readJson<{ secret?: unknown }>(request)
  if (!body) return jsonResponse({ error: 'invalid_json' }, request, env, 400)
  const secret = typeof body.secret === 'string' ? body.secret.trim() : ''

  // The attempt is counted before the secret is checked; see loginThrottle.ts.
  const wait = await reserveLoginAttempt(env, ip)
  if (wait) {
    await logLocked(request, env, 'password')
    return tooManyAttempts(request, env, wait)
  }

  if (!(await verifyAdminSecret(env, secret))) {
    await logAdminLogin(env, { method: 'password', result: 'failure', reason: 'bad_secret', ip, ua, country, passkey_id: null })
    return jsonResponse({ error: 'invalid_secret' }, request, env, 401)
  }

  await clearLoginFailures(env, ip)
  const session = await startAdminSession(env, 'password', ip, ua)
  await logAdminLogin(env, { method: 'password', result: 'success', reason: null, ip, ua, country, passkey_id: null })
  return signedIn(request, env, session)
}

export async function handleAdminLogout(request: Request, env: Env): Promise<Response> {
  // Signing out always clears the cookie, even when the session has already
  // expired, so the browser never keeps a dead credential around.
  const sessionId = readSessionCookie(request)
  if (sessionId) await deleteAdminSession(env, sessionId)
  return withCookie(jsonResponse({ ok: true }, request, env), clearSessionCookie(request))
}

export async function handleAdminMe(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  return jsonResponse({
    session: publicSession(guard.session as AdminSession),
    config: {
      rp_id: rpIdFor(request, env),
      session_ttl: ADMIN_SESSION_TTL,
      lockout: { max_attempts: LOGIN_MAX_ATTEMPTS, window_seconds: LOGIN_WINDOW_SECONDS },
    },
  }, request, env)
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function handleAdminSessions(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  const current = guard.session?.session_id ?? ''
  const sessions = await listAdminSessions(env)
  // The listing never carries a full session id — those are bearer
  // credentials. A 12-character handle is enough to pick one to revoke.
  return jsonResponse({
    sessions: sessions.map(s => ({
      ...s,
      session_id: s.session_id.slice(0, 12),
      current: s.session_id === current,
    })),
  }, request, env)
}

export async function handleAdminSessionRevoke(request: Request, env: Env, id: string): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  const current = guard.session?.session_id ?? ''

  if (id === 'others') {
    const sessions = await listAdminSessions(env)
    const others = sessions.filter(s => s.session_id !== current)
    await Promise.all(others.map(s => deleteAdminSession(env, s.session_id)))
    return jsonResponse({ ok: true, revoked: others.length }, request, env)
  }

  if (!/^[0-9a-f]{12}$/.test(id)) return jsonResponse({ error: 'invalid_session_id' }, request, env, 400)
  const target = (await listAdminSessions(env)).find(s => s.session_id.startsWith(id))
  if (!target) return jsonResponse({ error: 'session_not_found' }, request, env, 404)
  await deleteAdminSession(env, target.session_id)
  const isCurrent = target.session_id === current
  const response = jsonResponse({ ok: true, revoked: 1, signed_out: isCurrent }, request, env)
  return isCurrent ? withCookie(response, clearSessionCookie(request)) : response
}

export async function handleAdminLogins(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request, { allowSecret: true })
  if (!guard.ok) return guard.error
  const raw = Number.parseInt(new URL(request.url).searchParams.get('limit') || '100', 10)
  const limit = Math.min(Math.max(Number.isFinite(raw) ? raw : 100, 1), 500)
  const logins = await listAdminLogins(env, limit)
  return jsonResponse({ logins }, request, env)
}

// ── Passkeys ──────────────────────────────────────────────────────────────

export async function handlePasskeyLoginBegin(request: Request, env: Env): Promise<Response> {
  const foreign = rejectForeignSignIn(request, env)
  if (foreign) return foreign
  // Handing out a challenge proves nothing, so it only checks the lock.
  const wait = await loginLockedFor(env, clientIp(request))
  if (wait) return tooManyAttempts(request, env, wait)

  const passkeys = await listAdminPasskeys(env)
  if (passkeys.length === 0) {
    return jsonResponse({ error: 'no_passkeys_registered' }, request, env, 404)
  }

  const rpId = rpIdFor(request, env)
  const challenge = base64urlEncode(randomBytes(32))
  const handle = newId()
  await putWebauthnChallenge(env, handle, { challenge, purpose: 'login', issued_at: nowSeconds() })
  const allowCredentials = passkeys.map(row => ({
    id: row.credential_id,
    type: 'public-key',
    transports: parseTransports(row.transports),
  }))
  return jsonResponse({
    handle,
    publicKey: { challenge, rpId, timeout: 60_000, userVerification: 'required', allowCredentials },
  }, request, env)
}

export async function handlePasskeyLoginFinish(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request)
  const ua = userAgent(request)
  const country = clientCountry(request)

  const foreign = rejectForeignSignIn(request, env)
  if (foreign) return foreign

  const body = await readJson<{
    handle?: string
    credentialId?: string
    response?: { authenticatorData?: string; clientDataJSON?: string; signature?: string }
  }>(request)
  if (!body) return jsonResponse({ error: 'invalid_json' }, request, env, 400)

  const wait = await reserveLoginAttempt(env, ip)
  if (wait) {
    await logLocked(request, env, 'passkey')
    return tooManyAttempts(request, env, wait)
  }

  const fail = async (reason: string, error: string, passkeyId: string | null = null) => {
    await logAdminLogin(env, { method: 'passkey', result: 'failure', reason, ip, ua, country, passkey_id: passkeyId })
    return jsonResponse({ error }, request, env, 401)
  }

  const challenge = await takeWebauthnChallenge(env, String(body.handle || ''))
  if (!challenge || challenge.purpose !== 'login') return fail('challenge_missing', 'challenge_not_found')

  const stored = await getAdminPasskey(env, String(body.credentialId || ''))
  if (!stored) return fail('unknown_credential', 'unknown_credential')

  let newSignCount: number
  try {
    const result = await verifyAssertion({
      authenticatorDataB64: body.response?.authenticatorData || '',
      clientDataJsonB64: body.response?.clientDataJSON || '',
      signatureB64: body.response?.signature || '',
      expectedChallenge: String(challenge.challenge),
      expectedRpId: rpIdFor(request, env),
      expectedOrigins: rpOriginsFromEnv(rpIdFor(request, env)),
      storedPublicKeyB64: stored.public_key,
      alg: stored.alg ?? -7,
      storedSignCount: stored.counter,
    })
    newSignCount = result.newSignCount
  } catch (e) {
    return fail(`verify:${(e as Error).message}`, 'passkey_verification_failed', stored.id)
  }

  // Persisting the counter is what makes the regression check above mean
  // anything: it used to stay at its registration value forever, so a cloned
  // authenticator was never detected.
  stored.counter = newSignCount
  stored.last_used_at = nowSeconds()
  stored.last_used_ip = ip
  await putAdminPasskey(env, stored)
  await clearLoginFailures(env, ip)
  const session = await startAdminSession(env, 'passkey', ip, ua, stored.label)
  await logAdminLogin(env, { method: 'passkey', result: 'success', reason: null, ip, ua, country, passkey_id: stored.id })
  return signedIn(request, env, session, { passkey: { id: stored.id, label: stored.label } })
}

export async function handlePasskeys(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  const passkeys = await listAdminPasskeys(env)
  return jsonResponse({
    passkeys: passkeys.map(row => ({
      id: row.id,
      label: row.label,
      alg: row.alg ?? -7,
      transports: parseTransports(row.transports) ?? [],
      created_at: row.created_at,
      created_ip: row.created_ip,
      last_used_at: row.last_used_at,
      last_used_ip: row.last_used_ip,
    })),
  }, request, env)
}

export async function handlePasskeyRegisterBegin(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  const rpId = rpIdFor(request, env)
  const challenge = base64urlEncode(randomBytes(32))
  const handle = newId()
  await putWebauthnChallenge(env, handle, { challenge, purpose: 'register', issued_at: nowSeconds() })
  const excludeCredentials = (await listAdminPasskeys(env)).map(row => ({
    id: row.credential_id,
    type: 'public-key',
    transports: parseTransports(row.transports),
  }))
  return jsonResponse({
    handle,
    publicKey: {
      rp: { id: rpId, name: env.WEBAUTHN_RP_NAME || 'Clex Admin' },
      user: { id: base64urlEncode(new TextEncoder().encode('admin')), name: 'admin@clex.in', displayName: 'Clex Admin' },
      challenge,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      timeout: 60_000,
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      attestation: 'none',
      excludeCredentials,
    },
  }, request, env)
}

export async function handlePasskeyRegisterFinish(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  const body = await readJson<{
    handle?: string
    label?: string
    response?: { attestationObject?: string; clientDataJSON?: string; transports?: unknown }
  }>(request)
  if (!body) return jsonResponse({ error: 'invalid_json' }, request, env, 400)

  const challenge = await takeWebauthnChallenge(env, String(body.handle || ''))
  if (!challenge || challenge.purpose !== 'register') {
    return jsonResponse({ error: 'challenge_not_found' }, request, env, 400)
  }

  let result
  try {
    result = await verifyRegistration({
      attestationObjectB64: body.response?.attestationObject || '',
      clientDataJsonB64: body.response?.clientDataJSON || '',
      expectedChallenge: String(challenge.challenge),
      expectedRpId: rpIdFor(request, env),
      expectedOrigins: rpOriginsFromEnv(rpIdFor(request, env)),
    })
  } catch (e) {
    return jsonResponse({ error: 'webauthn_verification_failed', detail: (e as Error).message }, request, env, 400)
  }

  const transports = Array.isArray(body.response?.transports)
    ? (body.response.transports as unknown[]).filter((t): t is string => typeof t === 'string' && t.length < 32).slice(0, 8)
    : null
  const id = newId()
  const row: AdminPasskeyRow = {
    id,
    credential_id: result.credentialId,
    public_key: result.publicKeyB64,
    alg: result.alg,
    counter: result.signCount,
    transports: transports ? JSON.stringify(transports) : null,
    label: (typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'Admin passkey').slice(0, 80),
    created_at: nowSeconds(),
    created_ip: clientIp(request),
    last_used_at: null,
    last_used_ip: null,
    revoked_at: null,
  }
  await putAdminPasskey(env, row)
  return jsonResponse({ ok: true, passkey: { id, label: row.label, alg: result.alg } }, request, env)
}

export async function handlePasskeyRevoke(request: Request, env: Env, id: string): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if (!guard.ok) return guard.error
  const raw = await env.DRIVE_SESSION_STORE.get(`${PASSKEY_PREFIX}${id}`)
  if (!raw) return jsonResponse({ error: 'passkey_not_found' }, request, env, 404)
  let row: AdminPasskeyRow
  try {
    row = JSON.parse(raw) as AdminPasskeyRow
  } catch {
    return jsonResponse({ error: 'passkey_unreadable' }, request, env, 500)
  }
  row.revoked_at = nowSeconds()
  await env.DRIVE_SESSION_STORE.put(`${PASSKEY_PREFIX}${row.id}`, JSON.stringify(row))
  await env.DRIVE_SESSION_STORE.delete(`${PASSKEY_LOOKUP_PREFIX}${row.credential_id}`)
  return jsonResponse({ ok: true }, request, env)
}

/** Read-only routes also accept the lnch.in proxy's X-Admin-Secret. */
export async function requireAdminOrSecret(request: Request, env: Env): Promise<Response | null> {
  const guard = await requireAdmin(env, request, { allowSecret: true })
  return guard.ok ? null : guard.error
}

/** Mutating routes accept only a signed-in console session. */
export async function requireAdminSession(request: Request, env: Env): Promise<Response | null> {
  const guard = await requireAdmin(env, request)
  return guard.ok ? null : guard.error
}

export { adminError }
