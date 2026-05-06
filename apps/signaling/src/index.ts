export { Room } from './room'
import type { Env } from './types'

const ROOM_CODE_RE = /^\/room\/([A-Z0-9]{6})$/i

const BOOTED_AT = Date.now()

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

function isAdminAuthorized(req: Request, env: Env): boolean {
  const expected = env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET || ''
  if (!expected) return false
  const provided = req.headers.get('x-admin-secret') || ''
  if (!provided) return false
  return safeEqual(provided, expected)
}

function adminJson(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      ...((init.headers as Record<string, string>) ?? {}),
    },
  })
}

function corsHeaders(origin: string, allowedOriginsStr: string): HeadersInit {
  const allowedOrigins = allowedOriginsStr.split(',').map(s => s.trim());
  let allowed = ''
  if (allowedOriginsStr === '*') {
    allowed = '*';
  } else if (allowedOrigins.includes(origin)) {
    allowed = origin;
  }
  
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') ?? ''

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env.ALLOWED_ORIGIN),
      })
    }

    // Health check — consumed by lnch.in's LaunchOps health probe.
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'clex-signaling',
          ts: Math.floor(Date.now() / 1000),
          version: 'phase-1-public-face',
        }),
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=10, s-maxage=30',
            ...corsHeaders(origin, env.ALLOWED_ORIGIN),
          },
        },
      )
    }

    // ─── Admin (gated by CLEX_ADMIN_SECRET) ────────────────────────────
    // Signaling is mostly a stateless DO router, so the admin surface is
    // intentionally tiny — process info, runtime, env config flags. The
    // chain worker carries the rich session/audit data.
    if (request.method === 'GET' &&
        (url.pathname === '/admin/summary' || url.pathname === '/api/admin/summary')) {
      if (!isAdminAuthorized(request, env)) return adminJson({ error: 'unauthorized' }, { status: 401 })
      return adminJson({
        service: 'clex-signaling',
        generatedAt: Math.floor(Date.now() / 1000),
        process: {
          booted_at: Math.floor(BOOTED_AT / 1000),
          uptime_ms: Date.now() - BOOTED_AT,
          runtime: 'cloudflare-workers',
        },
        bindings: {
          durable_object_rooms: typeof env.ROOMS?.idFromName === 'function',
        },
        config: {
          allowed_origin: env.ALLOWED_ORIGIN ?? null,
          admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
        },
      })
    }
    if (request.method === 'GET' &&
        (url.pathname === '/admin/health' || url.pathname === '/api/admin/health')) {
      if (!isAdminAuthorized(request, env)) return adminJson({ error: 'unauthorized' }, { status: 401 })
      return adminJson({
        ok: true,
        service: 'clex-signaling',
        ts: Math.floor(Date.now() / 1000),
        version: 'phase-2-admin-api',
        booted_at: Math.floor(BOOTED_AT / 1000),
        uptime_ms: Date.now() - BOOTED_AT,
        bindings: {
          durable_object_rooms: typeof env.ROOMS?.idFromName === 'function',
        },
      })
    }
    if (request.method === 'GET' &&
        (url.pathname === '/admin/audit' || url.pathname === '/api/admin/audit')) {
      if (!isAdminAuthorized(request, env)) return adminJson({ error: 'unauthorized' }, { status: 401 })
      return adminJson({
        service: 'clex-signaling',
        generatedAt: Math.floor(Date.now() / 1000),
        events: [
          {
            type: 'process.boot',
            ts: Math.floor(BOOTED_AT / 1000),
            details: { runtime: 'cloudflare-workers' },
          },
        ],
      })
    }

    // Route: /room/:code?role=sender|receiver
    const match = url.pathname.match(ROOM_CODE_RE)
    if (!match) {
      return new Response('Not found', { status: 404 })
    }

    const code = match[1].toUpperCase()

    // Use name-based DO ID — same code always hits same DO instance
    const id = env.ROOMS.idFromName(code)
    const stub = env.ROOMS.get(id)

    // Forward the WebSocket upgrade to the Durable Object
    const resp = await stub.fetch(request)

    // Attach CORS headers to the 101 response (needed for some browsers)
    const headers = new Headers(resp.headers)
    Object.entries(corsHeaders(origin, env.ALLOWED_ORIGIN)).forEach(([k, v]) => headers.set(k, v))

    return new Response(resp.body, {
      status: resp.status,
      headers,
      webSocket: (resp as Response & { webSocket: WebSocket | null }).webSocket,
    })
  },
} satisfies ExportedHandler<Env>
