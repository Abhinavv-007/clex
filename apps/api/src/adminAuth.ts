import type { Env } from './googleAuth'
import { randomHex, safeEqual } from './crypto'

export const ADMIN_SESSION_HEADER = 'x-admin-session'
const ADMIN_SESSION_PREFIX = 'admin:sess:'
const WEBAUTHN_CHALLENGE_PREFIX = 'admin:webauthn:challenge:'
const ADMIN_SESSION_TTL = 60 * 60 * 8
const WEBAUTHN_CHALLENGE_TTL = 60 * 5

export interface AdminSession {
  session_id: string
  created_at: number
  expires_at: number
  method: 'password' | 'passkey'
  ip: string | null
  ua: string | null
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function newId(): string {
  return randomHex(16)
}

export function clientIp(request: Request): string | null {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    null
  )
}

export function userAgent(request: Request): string | null {
  const ua = request.headers.get('user-agent')
  if (!ua) return null
  return ua.length > 512 ? ua.slice(0, 512) : ua
}

export function verifyAdminSecret(env: Env, candidate: string): boolean {
  const expected = env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET || ''
  if (!expected || !candidate) return false
  return safeEqual(expected, candidate)
}

function adminSessionKey(sessionId: string): string {
  return `${ADMIN_SESSION_PREFIX}${sessionId}`
}

function webauthnChallengeKey(handle: string): string {
  return `${WEBAUTHN_CHALLENGE_PREFIX}${handle}`
}

async function putAdminSession(env: Env, session: AdminSession): Promise<void> {
  await env.DRIVE_SESSION_STORE.put(adminSessionKey(session.session_id), JSON.stringify(session), {
    expirationTtl: ADMIN_SESSION_TTL,
  })
}

export async function getAdminSession(env: Env, sessionId: string): Promise<AdminSession | null> {
  const raw = await env.DRIVE_SESSION_STORE.get(adminSessionKey(sessionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export async function deleteAdminSession(env: Env, sessionId: string): Promise<void> {
  await env.DRIVE_SESSION_STORE.delete(adminSessionKey(sessionId))
}

export async function startAdminSession(
  env: Env,
  method: 'password' | 'passkey',
  ip: string | null,
  ua: string | null,
): Promise<AdminSession> {
  const session: AdminSession = {
    session_id: newId(),
    created_at: nowSeconds(),
    expires_at: nowSeconds() + ADMIN_SESSION_TTL,
    method,
    ip,
    ua,
  }
  await putAdminSession(env, session)
  return session
}

export async function requireAdmin(
  env: Env,
  request: Request,
): Promise<{ session: AdminSession } | { error: Response }> {
  const sessionId = request.headers.get(ADMIN_SESSION_HEADER)
  if (!sessionId) {
    return { error: adminError('admin_session_required') }
  }

  const session = await getAdminSession(env, sessionId)
  if (!session || session.expires_at <= nowSeconds()) {
    if (session) await deleteAdminSession(env, sessionId)
    return { error: adminError('admin_session_expired') }
  }

  return { session }
}

export function adminError(error: string, status = 401): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

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
