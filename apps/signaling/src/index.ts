export { Room } from './room'
import type { Env } from './types'

const ROOM_CODE_RE = /^\/room\/([A-Z0-9]{6})$/i

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
