export { ChainLedger } from './ledger'
import { isFinalStatus, VALID_ROUTES, VALID_STATUSES, type Env, type TransferFile } from './types'

// ── Singleton ledger DO name ──────────────────────────────────────────────────
const LEDGER_NAME = 'global'

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(origin: string, allowedStr: string): HeadersInit {
  const origins = allowedStr.split(',').map(s => s.trim())
  const allowed = allowedStr === '*' || origins.includes(origin) ? (allowedStr === '*' ? '*' : origin) : ''
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(data: unknown, init: ResponseInit & { headers?: HeadersInit } = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...((init.headers ?? {}) as Record<string, string>) },
  })
}

function isValidChainId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{32}$/.test(id)
}

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function appendToLedger(
  env: Env,
  data: string
): Promise<{ ledger_index: number; previous_hash: string; record_hash: string }> {
  const id = env.LEDGER.idFromName(LEDGER_NAME)
  const stub = env.LEDGER.get(id)
  const resp = await stub.fetch('http://internal/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  return resp.json()
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleRegister(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  let body: { chain_id?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, { status: 400, headers: cors }) }

  if (!isValidChainId(body.chain_id)) {
    return json({ error: 'Invalid chain_id — must be 32 hex chars' }, { status: 400, headers: cors })
  }

  const now = Date.now()
  await env.DB.prepare(
    `INSERT INTO chain_ids (id, first_seen, last_seen) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen`
  ).bind(body.chain_id, now, now).run()

  return json({ ok: true }, { headers: cors })
}

async function handleCreateSession(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  let body: { sender_chain_id?: unknown; route?: unknown; files?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, { status: 400, headers: cors }) }

  if (!isValidChainId(body.sender_chain_id)) {
    return json({ error: 'Invalid sender_chain_id' }, { status: 400, headers: cors })
  }
  if (typeof body.route !== 'string' || !VALID_ROUTES.includes(body.route as never)) {
    return json({ error: `route must be one of: ${VALID_ROUTES.join(', ')}` }, { status: 400, headers: cors })
  }
  if (!Array.isArray(body.files) || body.files.length === 0) {
    return json({ error: 'files must be a non-empty array' }, { status: 400, headers: cors })
  }

  // Sanitize files — never store filenames
  const sanitizedFiles: TransferFile[] = (body.files as TransferFile[]).map(f => ({
    category: String(f?.category ?? 'other').slice(0, 32),
    type:     String(f?.type     ?? 'application/octet-stream').slice(0, 128),
    size:     Math.max(0, Number(f?.size) || 0),
    hash:     /^[0-9a-f]{64}$/.test(String(f?.hash)) ? String(f.hash) : '0'.repeat(64),
  }))

  const sessionId = crypto.randomUUID()
  const now = Date.now()
  const filesJson = JSON.stringify(sanitizedFiles)

  // Append to the global hash-chain ledger
  const ledgerPayload = JSON.stringify({
    session_id:      sessionId,
    sender_chain_id: body.sender_chain_id,
    route:           body.route,
    files_hash:      await sha256hex(filesJson),
  })
  const { ledger_index, previous_hash, record_hash } = await appendToLedger(env, ledgerPayload)

  // Upsert sender chain ID
  await env.DB.prepare(
    `INSERT INTO chain_ids (id, first_seen, last_seen) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen`
  ).bind(body.sender_chain_id, now, now).run()

  // Insert session row
  await env.DB.prepare(`
    INSERT INTO transfer_sessions
      (id, sender_chain_id, route, files_json, status, started_at, ledger_index, previous_hash, record_hash)
    VALUES (?, ?, ?, ?, 'registered', ?, ?, ?, ?)
  `).bind(sessionId, body.sender_chain_id, body.route, filesJson, now, ledger_index, previous_hash, record_hash).run()

  // Insert initial event
  await env.DB.prepare(
    `INSERT INTO transfer_events (session_id, status, ts) VALUES (?, 'registered', ?)`
  ).bind(sessionId, now).run()

  return json({ session_id: sessionId, ledger_index }, { headers: cors })
}

async function handleAppendEvent(req: Request, env: Env, cors: HeadersInit, sessionId: string): Promise<Response> {
  let body: { status?: unknown; receiver_chain_id?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, { status: 400, headers: cors }) }

  if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as never)) {
    return json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400, headers: cors })
  }

  type SessionRow = { id: string; status: string; started_at: number }
  const session = await env.DB.prepare(
    `SELECT id, status, started_at FROM transfer_sessions WHERE id = ?`
  ).bind(sessionId).first<SessionRow>()

  if (!session) return json({ error: 'Session not found' }, { status: 404, headers: cors })

  const now = Date.now()
  const parts: string[] = ['status = ?']
  const binds: unknown[] = [body.status]

  if (isValidChainId(body.receiver_chain_id)) {
    await env.DB.prepare(
      `INSERT INTO chain_ids (id, first_seen, last_seen) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen`
    ).bind(body.receiver_chain_id, now, now).run()
    parts.push('receiver_chain_id = ?')
    binds.push(body.receiver_chain_id)
  }

  if (isFinalStatus(body.status)) {
    parts.push('completed_at = ?', 'duration_ms = ?')
    binds.push(now, now - session.started_at)
  }

  binds.push(sessionId)
  await env.DB.prepare(
    `UPDATE transfer_sessions SET ${parts.join(', ')} WHERE id = ?`
  ).bind(...binds).run()

  await env.DB.prepare(
    `INSERT INTO transfer_events (session_id, status, ts) VALUES (?, ?, ?)`
  ).bind(sessionId, body.status, now).run()

  return json({ ok: true }, { headers: cors })
}

type SessionRow = {
  id: string; sender_chain_id: string; receiver_chain_id: string | null
  route: string; files_json: string; status: string
  started_at: number; completed_at: number | null; duration_ms: number | null
  ledger_index: number; record_hash: string; previous_hash?: string
}

async function handleExplorer(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const url = new URL(req.url)
  const page  = Math.max(1, parseInt(url.searchParams.get('page')  || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  const [rows, total] = await Promise.all([
    env.DB.prepare(`
      SELECT id, sender_chain_id, receiver_chain_id, route, files_json, status,
             started_at, completed_at, duration_ms, ledger_index, record_hash
      FROM transfer_sessions ORDER BY started_at DESC LIMIT ? OFFSET ?
    `).bind(limit, (page - 1) * limit).all<SessionRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM transfer_sessions`).first<{ c: number }>(),
  ])

  return json({
    sessions: rows.results.map(r => ({ ...r, files: JSON.parse(r.files_json), files_json: undefined })),
    total: total?.c ?? 0,
    page,
    limit,
  }, { headers: cors })
}

async function handleSessionDetail(req: Request, env: Env, cors: HeadersInit, sessionId: string): Promise<Response> {
  const session = await env.DB.prepare(`
    SELECT id, sender_chain_id, receiver_chain_id, route, files_json, status,
           started_at, completed_at, duration_ms, ledger_index, previous_hash, record_hash
    FROM transfer_sessions WHERE id = ?
  `).bind(sessionId).first<SessionRow>()

  if (!session) return json({ error: 'Not found' }, { status: 404, headers: cors })

  const events = await env.DB.prepare(
    `SELECT id, status, ts FROM transfer_events WHERE session_id = ? ORDER BY ts ASC`
  ).bind(sessionId).all<{ id: number; status: string; ts: number }>()

  return json({
    ...session,
    files: JSON.parse(session.files_json),
    files_json: undefined,
    events: events.results,
  }, { headers: cors })
}

async function handleChains(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const url = new URL(req.url)
  const page  = Math.max(1, parseInt(url.searchParams.get('page')  || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))

  const [rows, total] = await Promise.all([
    env.DB.prepare(`
      SELECT c.id, c.first_seen, c.last_seen,
             COUNT(DISTINCT s.id) AS transfer_count
      FROM chain_ids c
      LEFT JOIN transfer_sessions s ON s.sender_chain_id = c.id OR s.receiver_chain_id = c.id
      GROUP BY c.id
      ORDER BY c.last_seen DESC LIMIT ? OFFSET ?
    `).bind(limit, (page - 1) * limit).all<{ id: string; first_seen: number; last_seen: number; transfer_count: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM chain_ids`).first<{ c: number }>(),
  ])

  return json({ chains: rows.results, total: total?.c ?? 0, page, limit }, { headers: cors })
}

async function handleStats(env: Env, cors: HeadersInit): Promise<Response> {
  const [sessions, chains, completed] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS c FROM transfer_sessions`).first<{ c: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM chain_ids`).first<{ c: number }>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM transfer_sessions WHERE status='completed'`).first<{ c: number }>(),
  ])
  return json({
    total_sessions:    sessions?.c  ?? 0,
    total_chains:      chains?.c    ?? 0,
    completed_sessions: completed?.c ?? 0,
  }, { headers: cors })
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url)
    const origin = request.headers.get('Origin') ?? ''
    const cors   = corsHeaders(origin, env.ALLOWED_ORIGIN)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    // GET /chain/ — the Worker route clex.in/chain/* intercepts the trailing-slash
    // page request before Pages can serve it. Redirect to the canonical /chain page.
    if (request.method === 'GET' && (url.pathname === '/chain/' || url.pathname === '/chain')) {
      return Response.redirect(new URL('/chain', url.origin).href, 301)
    }

    // POST /chain/register
    if (request.method === 'POST' && url.pathname === '/chain/register') {
      return handleRegister(request, env, cors)
    }

    // POST /chain/session
    if (request.method === 'POST' && url.pathname === '/chain/session') {
      return handleCreateSession(request, env, cors)
    }

    // POST /chain/session/:id/event
    const evtMatch = url.pathname.match(/^\/chain\/session\/([^/]+)\/event$/)
    if (request.method === 'POST' && evtMatch) {
      return handleAppendEvent(request, env, cors, evtMatch[1])
    }

    // GET /chain/explorer
    if (request.method === 'GET' && url.pathname === '/chain/explorer') {
      return handleExplorer(request, env, cors)
    }

    // GET /chain/session/:id
    const sesMatch = url.pathname.match(/^\/chain\/session\/([^/]+)$/)
    if (request.method === 'GET' && sesMatch) {
      return handleSessionDetail(request, env, cors, sesMatch[1])
    }

    // GET /chain/chains
    if (request.method === 'GET' && url.pathname === '/chain/chains') {
      return handleChains(request, env, cors)
    }

    // GET /chain/stats
    if (request.method === 'GET' && url.pathname === '/chain/stats') {
      return handleStats(env, cors)
    }

    // GET /chain/health
    if (request.method === 'GET' && url.pathname === '/chain/health') {
      return json({ ok: true }, { headers: cors })
    }

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
