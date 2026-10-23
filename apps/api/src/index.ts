import {
  handleAdminLogin,
  handleAdminLogins,
  handleAdminLogout,
  handleAdminMe,
  handleAdminSessionRevoke,
  handleAdminSessions,
  handlePasskeyLoginBegin,
  handlePasskeyLoginFinish,
  handlePasskeyRegisterBegin,
  handlePasskeyRegisterFinish,
  handlePasskeyRevoke,
  handlePasskeys,
} from './adminPanel'
import { appendCors, type Env } from './env'
import {
  bumpMetric,
  handleAdminAudit,
  handleAdminHealth,
  handleAdminSummary,
  handleAdminTransferCancel,
  handleAdminTransferDetail,
  handleAdminTransfers,
  handleAppendEvent,
  handleCancelTransfer,
  handleCreateTransfer,
  handleGetTransfer,
} from './transfers'

const API_VERSION = '2026.10-admin'

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'not_found' }), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function dispatch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  if (method === 'OPTIONS') {
    const headers = new Headers()
    appendCors(headers, request, env)
    return new Response(null, { status: 204, headers })
  }

  // ─── Operator dashboard ───────────────────────────────────────────────
  // The console lives on clex.in/admin (Pages-served, in the site's design).
  // api.clex.in/ and /dashboard redirect there so there is one canonical UI.
  if (
    method === 'GET' &&
    (pathname === '/dashboard' || pathname === '/dashboard/' ||
      (pathname === '/' && url.hostname.startsWith('api.')))
  ) {
    return Response.redirect('https://clex.in/admin', 302)
  }

  // Public liveness probe consumed by lnch.in's LaunchOps health probe and
  // by external uptime monitors. Cheap, never reveals secrets.
  if ((pathname === '/api/health' || pathname === '/health') && (method === 'GET' || method === 'HEAD')) {
    const body = JSON.stringify({
      ok: true,
      service: 'clex-api',
      ts: Math.floor(Date.now() / 1000),
      version: API_VERSION,
      bindings: {
        kv: typeof (env as { DRIVE_SESSION_STORE?: { put?: unknown } }).DRIVE_SESSION_STORE?.put === 'function',
      },
    })
    const headers = new Headers({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=10, s-maxage=30',
    })
    appendCors(headers, request, env)
    return new Response(method === 'HEAD' ? null : body, { status: 200, headers })
  }

  // ─── Public transfer-metadata API (clex.in/api/transfers) ─────────────
  // The bytes move browser-to-browser over the signaling worker; this is the
  // metadata layer a CLI or integrator can drive. See ./transfers.
  if (pathname === '/api/transfers') {
    if (method === 'POST') return handleCreateTransfer(request, env)
    return methodNotAllowed()
  }
  const transfersMatch = pathname.match(/^\/api\/transfers\/([A-Za-z0-9]{4,32})(\/events)?$/)
  if (transfersMatch) {
    const codeOrId = transfersMatch[1]
    if (transfersMatch[2]) {
      if (method === 'POST') return handleAppendEvent(request, env, codeOrId)
      return methodNotAllowed()
    }
    if (method === 'GET') return handleGetTransfer(request, env, codeOrId)
    if (method === 'DELETE') return handleCancelTransfer(request, env, codeOrId)
    return methodNotAllowed()
  }

  // ─── Admin ────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/admin/')) {
    const route = `${method} ${pathname.slice('/api/admin'.length)}`
    switch (route) {
      case 'POST /login': return handleAdminLogin(request, env)
      case 'POST /logout': return handleAdminLogout(request, env)
      case 'GET /me': return handleAdminMe(request, env)
      case 'GET /sessions': return handleAdminSessions(request, env)
      case 'GET /logins': return handleAdminLogins(request, env)
      case 'POST /login/passkey/begin': return handlePasskeyLoginBegin(request, env)
      case 'POST /login/passkey/finish': return handlePasskeyLoginFinish(request, env)
      case 'POST /passkeys/register/begin': return handlePasskeyRegisterBegin(request, env)
      case 'POST /passkeys/register/finish': return handlePasskeyRegisterFinish(request, env)
      case 'GET /passkeys': return handlePasskeys(request, env)
      case 'GET /summary': return handleAdminSummary(request, env)
      case 'GET /transfers': return handleAdminTransfers(request, env)
      case 'GET /health': return handleAdminHealth(request, env)
      case 'GET /audit': return handleAdminAudit(request, env)
    }

    const sessionMatch = pathname.match(/^\/api\/admin\/sessions\/([a-z0-9]+)$/)
    if (sessionMatch && method === 'DELETE') return handleAdminSessionRevoke(request, env, sessionMatch[1])

    const passkeyMatch = pathname.match(/^\/api\/admin\/passkeys\/([A-Za-z0-9]+)$/)
    if (passkeyMatch && method === 'DELETE') return handlePasskeyRevoke(request, env, passkeyMatch[1])

    const transferMatch = pathname.match(/^\/api\/admin\/transfers\/([A-Za-z0-9]{4,32})$/)
    if (transferMatch && method === 'GET') return handleAdminTransferDetail(request, env, transferMatch[1])
    if (transferMatch && method === 'DELETE') return handleAdminTransferCancel(request, env, transferMatch[1])
  }

  return notFound()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const t0 = Date.now()
    let res: Response
    try {
      res = await dispatch(request, env)
    } catch (err) {
      console.error('clex-api unhandled error', err)
      res = new Response(JSON.stringify({ error: 'internal_error' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      })
    }
    // Bucket the metrics route by its static shape so ids and codes don't
    // blow out the per-route map; unmatched paths share one bucket.
    const route = res.status === 404
      ? '(unmatched)'
      : url.pathname
        .replace(/^\/api\/transfers\/[A-Za-z0-9]+(\/events)?$/, '/api/transfers/:id$1')
        .replace(/^\/api\/admin\/(sessions|passkeys|transfers)\/[A-Za-z0-9]+$/, '/api/admin/$1/:id')
    bumpMetric(route, res.status, Date.now() - t0)
    return res
  },
} satisfies ExportedHandler<Env>
