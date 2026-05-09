/**
 * Route handlers for the Clex API key management endpoints.
 *
 *   GET    /api/keys                 — list keys for the signed-in operator
 *   POST   /api/keys                 — mint a new key
 *   DELETE /api/keys/:id             — revoke a key
 *   GET    /api/keys/usage           — 30-day daily traffic across keys
 *
 * Auth: reuses the existing `gdrive_session` cookie (Google sub). No new
 * auth surface — if the operator has signed in via /developers or /account
 * they are already authorized for these endpoints.
 */
import {
  appendCors,
  json,
  parseCookies,
  type Env,
} from './googleAuth'
import {
  dailyUsageWindow,
  listKeys,
  mintKey,
  revokeKey,
  type Plan,
} from './apiKeys'

const SESSION_COOKIE = 'gdrive_session'
const SESSION_PREFIX = 'gdrive:session:'

interface SessionRecord {
  id: string
  sub: string
  email: string | null
  displayName: string | null
  picture: string | null
  accessToken: string
  accessTokenExpiresAt: number
  scope: string[]
  createdAt: number
  updatedAt: number
}

async function readOwner(
  request: Request,
  env: Env,
): Promise<{ sub: string; email: string | null } | null> {
  const cookies = parseCookies(request)
  const sessionId = cookies.get(SESSION_COOKIE)
  if (!sessionId) return null
  const raw = await env.DRIVE_SESSION_STORE.get(`${SESSION_PREFIX}${sessionId}`)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as SessionRecord
    if (!session.sub) return null
    return { sub: session.sub, email: session.email ?? null }
  } catch {
    return null
  }
}

function withCors(headers: Headers, request: Request, env: Env): Headers {
  appendCors(headers, request, env)
  return headers
}

function jsonWithCors(
  data: unknown,
  request: Request,
  env: Env,
  status: number = 200,
): Response {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' })
  withCors(headers, request, env)
  return new Response(JSON.stringify(data), { status, headers })
}

export async function handleListKeys(request: Request, env: Env): Promise<Response> {
  const owner = await readOwner(request, env)
  if (!owner) return jsonWithCors({ error: 'auth_required' }, request, env, 401)
  const keys = await listKeys(env, owner.sub)
  return jsonWithCors({ owner: { email: owner.email }, keys }, request, env)
}

export async function handleMintKey(request: Request, env: Env): Promise<Response> {
  const owner = await readOwner(request, env)
  if (!owner) return jsonWithCors({ error: 'auth_required' }, request, env, 401)
  let body: { label?: string; plan?: string }
  try {
    body = (await request.json()) as { label?: string; plan?: string }
  } catch {
    body = {}
  }
  const requestedPlan = (body.plan ?? 'free') as Plan
  const allowed: Plan[] = ['free', 'starter', 'pro', 'unlimited']
  const plan = allowed.includes(requestedPlan) ? requestedPlan : 'free'
  try {
    const result = await mintKey(env, owner.sub, owner.email, body.label ?? '', plan)
    // The full plaintext is returned exactly once. The client surfaces it
    // immediately and is responsible for warning the user that it can't
    // be retrieved later.
    return jsonWithCors(result, request, env, 201)
  } catch (e) {
    return jsonWithCors(
      { error: 'mint_failed', message: (e as Error).message ?? 'unknown' },
      request,
      env,
      400,
    )
  }
}

export async function handleRevokeKey(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const owner = await readOwner(request, env)
  if (!owner) return jsonWithCors({ error: 'auth_required' }, request, env, 401)
  if (!id) return jsonWithCors({ error: 'id_required' }, request, env, 400)
  const ok = await revokeKey(env, owner.sub, id)
  if (!ok) return jsonWithCors({ error: 'not_found_or_not_owner' }, request, env, 404)
  return jsonWithCors({ ok: true }, request, env)
}

export async function handleKeyUsage(request: Request, env: Env): Promise<Response> {
  const owner = await readOwner(request, env)
  if (!owner) return jsonWithCors({ error: 'auth_required' }, request, env, 401)
  const url = new URL(request.url)
  const daysParam = Number(url.searchParams.get('days') ?? 30)
  const days = Math.min(90, Math.max(7, Number.isFinite(daysParam) ? daysParam : 30))
  const series = await dailyUsageWindow(env, owner.sub, days)
  return jsonWithCors({ days, series }, request, env)
}

// Suppress the unused-import warning when this module is imported but the
// `json` helper from googleAuth.ts isn't needed (we use jsonWithCors). The
// re-export keeps the surface predictable for any future endpoint that
// wants a non-CORS response.
export { json }
