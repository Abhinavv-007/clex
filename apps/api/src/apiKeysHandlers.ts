import {
  appendCors,
  parseCookies,
  type Env,
} from './googleAuth'
import { verifyFirebaseAuthHeader } from './firebase'
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

interface Owner {
  sub: string
  email: string | null
}

async function readOwner(
  request: Request,
  env: Env,
): Promise<Owner | null> {
  const claims = await verifyFirebaseAuthHeader(env, request)
  if (claims) {
    return { sub: claims.sub, email: claims.email ?? null }
  }

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
