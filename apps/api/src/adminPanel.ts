import type { Env } from './googleAuth'
import { base64urlEncode, randomBytes } from './crypto'
import {
  adminError,
  clientIp,
  deleteAdminSession,
  newId,
  nowSeconds,
  putWebauthnChallenge,
  requireAdmin,
  startAdminSession,
  takeWebauthnChallenge,
  userAgent,
  verifyAdminSecret,
} from './adminAuth'
import { rpOriginsFromEnv, verifyAssertion, verifyRegistration } from './webauthn'

interface AdminPasskeyRow {
  id: string
  credential_id: string
  public_key: string
  counter: number
  transports: string | null
  label: string | null
  created_at: number
  created_ip: string | null
  last_used_at: number | null
  last_used_ip: string | null
  revoked_at: number | null
}

function jsonResponse(data: unknown, request: Request, env: Env, status = 200): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  const origin = request.headers.get('origin')
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Vary', 'Origin')
  } else if (env.ALLOWED_ORIGIN === '*') {
    headers.set('Access-Control-Allow-Origin', '*')
  }
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Session, X-Admin-Secret')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  return new Response(JSON.stringify(data), { status, headers })
}

function rpIdFor(request: Request, env: Env): string {
  return env.WEBAUTHN_RP_ID || new URL(env.FRONTEND_BASE_URL || request.url).hostname
}

async function listAdminPasskeys(env: Env): Promise<AdminPasskeyRow[]> {
  const rows: AdminPasskeyRow[] = []
  const list = await env.DRIVE_SESSION_STORE.list({ prefix: 'admin:passkey:', limit: 1000 })
  await Promise.all(list.keys.map(async key => {
    const raw = await env.DRIVE_SESSION_STORE.get(key.name)
    if (!raw) return
    try {
      const row = JSON.parse(raw) as AdminPasskeyRow
      if (!row.revoked_at) rows.push(row)
    } catch {
      // ignore malformed stored rows
    }
  }))
  return rows.sort((a, b) => b.created_at - a.created_at)
}

async function getAdminPasskey(env: Env, credentialId: string): Promise<AdminPasskeyRow | null> {
  const id = await env.DRIVE_SESSION_STORE.get(`admin:passkey:lookup:${credentialId}`)
  if (!id) return null
  const raw = await env.DRIVE_SESSION_STORE.get(`admin:passkey:${id}`)
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
    env.DRIVE_SESSION_STORE.put(`admin:passkey:${row.id}`, JSON.stringify(row)),
    env.DRIVE_SESSION_STORE.put(`admin:passkey:lookup:${row.credential_id}`, row.id),
  ])
}

async function logAdminLogin(
  env: Env,
  fields: {
    method: 'password' | 'passkey'
    result: 'success' | 'failure'
    reason: string | null
    ip: string | null
    ua: string | null
    passkey_id: string | null
  },
): Promise<void> {
  const record = { id: newId(), created_at: nowSeconds(), ...fields }
  await env.DRIVE_SESSION_STORE.put(`admin:login:${record.created_at}:${record.id}`, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 90,
  })
}

export async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request)
  const ua = userAgent(request)
  let body: { secret?: string } = {}
  try {
    body = await request.json() as { secret?: string }
  } catch {
    return jsonResponse({ error: 'invalid_json' }, request, env, 400)
  }

  if (!verifyAdminSecret(env, (body.secret || '').trim())) {
    await logAdminLogin(env, { method: 'password', result: 'failure', reason: 'bad_secret', ip, ua, passkey_id: null })
    return jsonResponse({ error: 'invalid_secret' }, request, env, 401)
  }

  const session = await startAdminSession(env, 'password', ip, ua)
  await logAdminLogin(env, { method: 'password', result: 'success', reason: null, ip, ua, passkey_id: null })
  return jsonResponse({ session_id: session.session_id, expires_at: session.expires_at, method: session.method }, request, env)
}

export async function handleAdminLogout(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if ('error' in guard) return guard.error
  const sessionId = request.headers.get('x-admin-session')
  if (sessionId) await deleteAdminSession(env, sessionId)
  return jsonResponse({ ok: true }, request, env)
}

export async function handleAdminMe(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if ('error' in guard) return guard.error
  return jsonResponse({ session: guard.session }, request, env)
}

export async function handlePasskeyLoginBegin(request: Request, env: Env): Promise<Response> {
  const rpId = rpIdFor(request, env)
  const challenge = base64urlEncode(randomBytes(32))
  const handle = newId()
  await putWebauthnChallenge(env, handle, { challenge, purpose: 'login', issued_at: nowSeconds() })
  const allowCredentials = (await listAdminPasskeys(env)).map(row => ({
    id: row.credential_id,
    type: 'public-key',
    transports: row.transports ? JSON.parse(row.transports) : undefined,
  }))
  return jsonResponse({
    handle,
    publicKey: { challenge, rpId, timeout: 60_000, userVerification: 'preferred', allowCredentials },
  }, request, env)
}

export async function handlePasskeyLoginFinish(request: Request, env: Env): Promise<Response> {
  const ip = clientIp(request)
  const ua = userAgent(request)
  let body: {
    handle?: string
    credentialId?: string
    response?: { authenticatorData?: string; clientDataJSON?: string; signature?: string }
  } = {}
  try {
    body = await request.json() as typeof body
  } catch {
    return jsonResponse({ error: 'invalid_json' }, request, env, 400)
  }

  const challenge = await takeWebauthnChallenge(env, body.handle || '')
  if (!challenge || challenge.purpose !== 'login') {
    await logAdminLogin(env, { method: 'passkey', result: 'failure', reason: 'challenge_missing', ip, ua, passkey_id: null })
    return jsonResponse({ error: 'challenge_not_found' }, request, env, 401)
  }

  const stored = await getAdminPasskey(env, body.credentialId || '')
  if (!stored) {
    await logAdminLogin(env, { method: 'passkey', result: 'failure', reason: 'unknown_credential', ip, ua, passkey_id: null })
    return jsonResponse({ error: 'unknown_credential' }, request, env, 401)
  }

  try {
    await verifyAssertion({
      authenticatorDataB64: body.response?.authenticatorData || '',
      clientDataJsonB64: body.response?.clientDataJSON || '',
      signatureB64: body.response?.signature || '',
      expectedChallenge: String(challenge.challenge),
      expectedRpId: rpIdFor(request, env),
      expectedOrigins: rpOriginsFromEnv(rpIdFor(request, env)),
      storedPublicKeyB64: stored.public_key,
      alg: -7,
      storedSignCount: stored.counter,
    })
  } catch (e) {
    await logAdminLogin(env, { method: 'passkey', result: 'failure', reason: `verify:${(e as Error).message}`, ip, ua, passkey_id: stored.id })
    return jsonResponse({ error: 'passkey_verification_failed' }, request, env, 401)
  }

  stored.last_used_at = nowSeconds()
  stored.last_used_ip = ip
  await putAdminPasskey(env, stored)
  const session = await startAdminSession(env, 'passkey', ip, ua)
  await logAdminLogin(env, { method: 'passkey', result: 'success', reason: null, ip, ua, passkey_id: stored.id })
  return jsonResponse({ session_id: session.session_id, expires_at: session.expires_at, method: session.method, passkey: { id: stored.id, label: stored.label } }, request, env)
}

export async function handlePasskeys(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if ('error' in guard) return guard.error
  const passkeys = await listAdminPasskeys(env)
  return jsonResponse({ passkeys: passkeys.map(({ public_key, counter, revoked_at, ...rest }) => rest) }, request, env)
}

export async function handlePasskeyRegisterBegin(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if ('error' in guard) return guard.error
  const rpId = rpIdFor(request, env)
  const challenge = base64urlEncode(randomBytes(32))
  const handle = newId()
  await putWebauthnChallenge(env, handle, { challenge, purpose: 'register', issued_at: nowSeconds() })
  const excludeCredentials = (await listAdminPasskeys(env)).map(row => ({
    id: row.credential_id,
    type: 'public-key',
    transports: row.transports ? JSON.parse(row.transports) : undefined,
  }))
  return jsonResponse({
    handle,
    publicKey: {
      rp: { id: rpId, name: env.WEBAUTHN_RP_NAME || 'Clex Admin' },
      user: { id: base64urlEncode(new TextEncoder().encode('admin')), name: 'admin@clex.in', displayName: 'Clex Admin' },
      challenge,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      timeout: 60_000,
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
      attestation: 'none',
      excludeCredentials,
    },
  }, request, env)
}

export async function handlePasskeyRegisterFinish(request: Request, env: Env): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if ('error' in guard) return guard.error
  let body: {
    handle?: string
    label?: string
    response?: { attestationObject?: string; clientDataJSON?: string; transports?: string[] }
  } = {}
  try {
    body = await request.json() as typeof body
  } catch {
    return jsonResponse({ error: 'invalid_json' }, request, env, 400)
  }

  const challenge = await takeWebauthnChallenge(env, body.handle || '')
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
    return jsonResponse({ error: `webauthn_verification_failed:${(e as Error).message}` }, request, env, 400)
  }

  const id = newId()
  const row: AdminPasskeyRow = {
    id,
    credential_id: result.credentialId,
    public_key: result.publicKeyB64,
    counter: result.signCount,
    transports: Array.isArray(body.response?.transports) ? JSON.stringify(body.response.transports) : null,
    label: (body.label || 'Admin passkey').slice(0, 80),
    created_at: nowSeconds(),
    created_ip: clientIp(request),
    last_used_at: null,
    last_used_ip: null,
    revoked_at: null,
  }
  await putAdminPasskey(env, row)
  return jsonResponse({ ok: true, passkey: { id, label: row.label, credential_id: row.credential_id, alg: result.alg } }, request, env)
}

export async function handlePasskeyRevoke(request: Request, env: Env, id: string): Promise<Response> {
  const guard = await requireAdmin(env, request)
  if ('error' in guard) return guard.error
  const raw = await env.DRIVE_SESSION_STORE.get(`admin:passkey:${id}`)
  if (!raw) return jsonResponse({ error: 'passkey_not_found' }, request, env, 404)
  const row = JSON.parse(raw) as AdminPasskeyRow
  row.revoked_at = nowSeconds()
  await env.DRIVE_SESSION_STORE.put(`admin:passkey:${row.id}`, JSON.stringify(row))
  await env.DRIVE_SESSION_STORE.delete(`admin:passkey:lookup:${row.credential_id}`)
  return jsonResponse({ ok: true }, request, env)
}

export async function requireAdminOrSecret(request: Request, env: Env): Promise<Response | null> {
  const guard = await requireAdmin(env, request)
  if (!('error' in guard)) return null
  const expected = env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET || ''
  const provided = request.headers.get('x-admin-secret') || ''
  if (expected && provided && verifyAdminSecret(env, provided)) return null
  return adminError('admin_session_required')
}

export async function handleAdminUsers(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 200)
  const sessions = await listJsonPrefix<{ sub: string; email: string | null; displayName: string | null; picture: string | null; createdAt: number; updatedAt: number }>(
    env,
    'gdrive:session:',
    limit,
  )
  const keys = await listApiKeyRecords(env, 1000)
  const users = new Map<string, { id: string; firebase_uid: string; email: string | null; display_name: string | null; picture: string | null; created_at: number; last_seen_at: number | null }>()
  for (const session of sessions) {
    const existing = users.get(session.sub)
    const created = Math.floor((session.createdAt || Date.now()) / 1000)
    const updated = Math.floor((session.updatedAt || session.createdAt || Date.now()) / 1000)
    if (!existing || updated > (existing.last_seen_at || 0)) {
      users.set(session.sub, {
        id: session.sub,
        firebase_uid: session.sub,
        email: session.email,
        display_name: session.displayName,
        picture: session.picture,
        created_at: existing?.created_at ? Math.min(existing.created_at, created) : created,
        last_seen_at: updated,
      })
    }
  }
  for (const key of keys) {
    if (users.has(key.ownerSub)) continue
    users.set(key.ownerSub, {
      id: key.ownerSub,
      firebase_uid: key.ownerSub,
      email: key.ownerEmail,
      display_name: null,
      picture: null,
      created_at: key.createdAt,
      last_seen_at: key.lastUsedAt || key.createdAt,
    })
  }
  return jsonResponse({ total: users.size, users: Array.from(users.values()).slice(0, limit) }, request, env)
}

export async function handleAdminUserDetail(request: Request, env: Env, uid: string): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const sessions = await listJsonPrefix<{ sub: string; email: string | null; displayName: string | null; picture: string | null; createdAt: number; updatedAt: number; accessTokenExpiresAt?: number; scope?: string[] }>(
    env,
    'gdrive:session:',
    1000,
  )
  const userSessions = sessions.filter(session => session.sub === uid)
  const keys = await listApiKeyRecordsForOwner(env, uid)
  if (userSessions.length === 0 && keys.length === 0) return jsonResponse({ error: 'user_not_found' }, request, env, 404)
  userSessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  const latest = userSessions[0] || null
  return jsonResponse({
    user: {
      id: uid,
      firebase_uid: uid,
      email: latest?.email || keys[0]?.ownerEmail || null,
      display_name: latest?.displayName || null,
      picture: latest?.picture || null,
      created_at: userSessions.length > 0
        ? Math.floor(Math.min(...userSessions.map(s => s.createdAt || Date.now())) / 1000)
        : (keys[keys.length - 1]?.createdAt || keys[0]?.createdAt || nowSeconds()),
      last_seen_at: latest
        ? Math.floor((latest.updatedAt || latest.createdAt || Date.now()) / 1000)
        : (Math.max(...keys.map(k => k.lastUsedAt || k.createdAt)) || null),
    },
    keys,
    security: {
      sessions: userSessions.map(session => ({
        email: session.email,
        scope: session.scope || [],
        created_at: Math.floor((session.createdAt || Date.now()) / 1000),
        updated_at: Math.floor((session.updatedAt || session.createdAt || Date.now()) / 1000),
        access_token_expires_at: session.accessTokenExpiresAt ? Math.floor(session.accessTokenExpiresAt / 1000) : null,
      })),
    },
  }, request, env)
}

export async function handleAdminFeed(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const limit = Math.min(Number.parseInt(new URL(request.url).searchParams.get('limit') || '50', 10) || 50, 200)
  const keyCreations = (await listApiKeyRecords(env, limit)).map(key => ({
    id: key.id,
    user_id: key.ownerSub,
    email: key.ownerEmail,
    display_name: null,
    name: key.label,
    key_prefix: key.prefix,
    created_at: key.createdAt,
    last_used_at: key.lastUsedAt,
    revoked_at: key.revokedAt,
  }))
  return jsonResponse({ key_creations: keyCreations, api_calls: [], ip_log: [] }, request, env)
}

async function listJsonPrefix<T>(env: Env, prefix: string, limit: number): Promise<T[]> {
  const out: T[] = []
  const list = await env.DRIVE_SESSION_STORE.list({ prefix, limit })
  await Promise.all(list.keys.map(async key => {
    const raw = await env.DRIVE_SESSION_STORE.get(key.name)
    if (!raw) return
    try {
      out.push(JSON.parse(raw) as T)
    } catch {
      // ignore malformed KV rows
    }
  }))
  return out
}

interface AdminApiKeyRecord {
  id: string
  ownerSub: string
  ownerEmail: string | null
  label: string
  prefix: string
  createdAt: number
  lastUsedAt: number | null
  revokedAt: number | null
}

async function listApiKeyRecords(env: Env, limit: number): Promise<AdminApiKeyRecord[]> {
  const rows = await listJsonPrefix<AdminApiKeyRecord & { revoked?: boolean }>(env, 'apikey:meta:', limit)
  return rows
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(row => ({ ...row, revokedAt: row.revokedAt ?? (row.revoked ? row.createdAt : null) }))
}

async function listApiKeyRecordsForOwner(env: Env, ownerSub: string): Promise<AdminApiKeyRecord[]> {
  return (await listApiKeyRecords(env, 1000)).filter(key => key.ownerSub === ownerSub)
}
