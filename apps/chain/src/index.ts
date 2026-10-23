export { ChainLedger } from './ledger'
import { checkAdmin } from './adminSession'
import { isFinalStatus, statusesBelow, VALID_ROUTES, VALID_STATUSES, type Env, type TransferFile } from './types'

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

/** A positive integer query param, defaulted and clamped; never NaN. */
function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(url.searchParams.get(name) ?? '', 10)
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, raw))
}

function parseFiles(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const MAX_FILES_PER_SESSION = 500
const DAY_MS = 24 * 60 * 60 * 1000

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
  // `meta` is an optional, additive client-supplied bag (e.g. the privacy-safe
  // receipt summary from Clex Direct+). Older deployments simply ignore it.
  // We only enforce a soft size cap so a malformed client can't bloat a row.
  let body: { sender_chain_id?: unknown; route?: unknown; files?: unknown; meta?: unknown }
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
  if (body.files.length > MAX_FILES_PER_SESSION) {
    return json({ error: `at most ${MAX_FILES_PER_SESSION} files per session` }, { status: 400, headers: cors })
  }

  // Reject implausibly large meta payloads but otherwise let new fields through
  // without storing them — the client persists receipts locally for now.
  if (body.meta != null && JSON.stringify(body.meta).length > 4096) {
    return json({ error: 'meta payload too large (>4096 bytes)' }, { status: 400, headers: cors })
  }

  // Sanitize files — never store filenames
  const sanitizedFiles: TransferFile[] = (body.files as TransferFile[]).map(f => ({
    category: String(f?.category ?? 'other').slice(0, 32),
    type:     String(f?.type     ?? 'application/octet-stream').slice(0, 128),
    size:     Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(f?.size) || 0))),
    hash:     typeof f?.hash === 'string' && /^[0-9a-f]{64}$/.test(f.hash) ? f.hash : null,
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
  // `meta` is an optional, additive client-supplied receipt summary (Clex
  // Direct+). Accepted for forward-compat; not persisted yet.
  let body: { status?: unknown; receiver_chain_id?: unknown; meta?: unknown }
  try { body = await req.json() } catch { return json({ error: 'Bad JSON' }, { status: 400, headers: cors }) }

  if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as never)) {
    return json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400, headers: cors })
  }

  if (body.meta != null && JSON.stringify(body.meta).length > 4096) {
    return json({ error: 'meta payload too large (>4096 bytes)' }, { status: 400, headers: cors })
  }
  const nextStatus = body.status

  // Existence check is the only read we keep. We deliberately do NOT read
  // `status` here: the precedence guard is baked into the UPDATE's WHERE
  // clause so concurrent requests can't race each other into regressing.
  const session = await env.DB.prepare(
    `SELECT id FROM transfer_sessions WHERE id = ?`
  ).bind(sessionId).first<{ id: string }>()

  if (!session) return json({ error: 'Session not found' }, { status: 404, headers: cors })

  const now = Date.now()
  const receiverChainId = isValidChainId(body.receiver_chain_id) ? body.receiver_chain_id : null

  // receiver_chain_id is additive across the lifetime of a session and is
  // never overwritten once set. Update it independently of the status
  // advance so a late-arriving peer chain id can still attach even if the
  // status is already terminal.
  if (receiverChainId) {
    await env.DB.prepare(
      `INSERT INTO chain_ids (id, first_seen, last_seen) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen`
    ).bind(receiverChainId, now, now).run()
    await env.DB.prepare(
      `UPDATE transfer_sessions SET receiver_chain_id = COALESCE(receiver_chain_id, ?) WHERE id = ?`
    ).bind(receiverChainId, sessionId).run()
  }

  // Atomic status advance. The WHERE clause restricts the UPDATE to rows
  // whose current status has a strictly lower rank than the new status, so
  // out-of-order requests cannot overwrite a higher-ranked status.
  // `meta.changes` tells us whether the row was actually modified — that
  // is the source of truth for "did the status advance" downstream.
  const lowerStatuses = statusesBelow(nextStatus)
  let advanced = false
  if (lowerStatuses.length > 0) {
    const placeholders = lowerStatuses.map(() => '?').join(',')
    const finalSetters = isFinalStatus(nextStatus)
      ? ', completed_at = ?, duration_ms = ? - started_at'
      : ''
    const sql = `
      UPDATE transfer_sessions
      SET status = ?${finalSetters}
      WHERE id = ? AND status IN (${placeholders})
    `
    const binds: unknown[] = [nextStatus]
    if (isFinalStatus(nextStatus)) binds.push(now, now)
    binds.push(sessionId, ...lowerStatuses)

    const result = await env.DB.prepare(sql).bind(...binds).run()
    advanced = (result.meta?.changes ?? 0) > 0
  }

  if (!advanced) {
    return json({ ok: true, deduped: true }, { headers: cors })
  }

  // Dedupe consecutive identical events. We only get here when the status
  // genuinely advanced, but two interleaved advances (e.g. very fast
  // transfers where the same status is posted twice) could still race.
  const previousEvent = await env.DB.prepare(
    `SELECT status FROM transfer_events WHERE session_id = ? ORDER BY ts DESC, id DESC LIMIT 1`
  ).bind(sessionId).first<{ status: string }>()

  if (previousEvent?.status === nextStatus) {
    return json({ ok: true, deduped: true }, { headers: cors })
  }

  await env.DB.prepare(
    `INSERT INTO transfer_events (session_id, status, ts) VALUES (?, ?, ?)`
  ).bind(sessionId, nextStatus, now).run()

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
  const page  = intParam(url, 'page', 1, 1, 100_000)
  const limit = intParam(url, 'limit', 20, 1, 50)

  const [rows, total] = await Promise.all([
    env.DB.prepare(`
      SELECT id, sender_chain_id, receiver_chain_id, route, files_json, status,
             started_at, completed_at, duration_ms, ledger_index, record_hash
      FROM transfer_sessions ORDER BY started_at DESC LIMIT ? OFFSET ?
    `).bind(limit, (page - 1) * limit).all<SessionRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS c FROM transfer_sessions`).first<{ c: number }>(),
  ])

  return json({
    sessions: rows.results.map(r => ({ ...r, files: parseFiles(r.files_json), files_json: undefined })),
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
    files: parseFiles(session.files_json),
    files_json: undefined,
    events: events.results,
  }, { headers: cors })
}

async function handleChains(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const url = new URL(req.url)
  const page  = intParam(url, 'page', 1, 1, 100_000)
  const limit = intParam(url, 'limit', 20, 1, 50)

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

// ── Admin endpoints (clex.in/admin session, or X-Admin-Secret) ────────────────

/** Every admin route here is read-only, so the lnch.in secret is accepted too. */
async function adminDenied(req: Request, env: Env, cors: HeadersInit): Promise<Response | null> {
  const auth = await checkAdmin(req, env, env.ADMIN_SESSIONS, true)
  if (auth.ok) return null
  return json({ error: auth.error }, { status: auth.status, headers: adminHeaders(cors) })
}

function adminHeaders(cors: HeadersInit): HeadersInit {
  return { ...cors, 'Cache-Control': 'private, no-store' }
}

async function handleAdminSummary(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const denied = await adminDenied(req, env, cors)
  if (denied) return denied
  // started_at is in milliseconds (Date.now()). This used to compare it with
  // a seconds timestamp, so "last 24h" counted every transfer ever made.
  const now = Date.now()
  const since = now - DAY_MS
  const since30 = now - 30 * DAY_MS
  const [sessions, completed, cancelled, failed, chains, recent24h, byStatus, byRoute, perf, series] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM transfer_sessions').first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM transfer_sessions WHERE status='completed'").first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM transfer_sessions WHERE status='cancelled'").first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM transfer_sessions WHERE status='failed'").first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM chain_ids').first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM transfer_sessions WHERE started_at >= ?').bind(since).first<{ n: number }>(),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM transfer_sessions GROUP BY status').all<{ status: string; n: number }>(),
    env.DB.prepare('SELECT route, COUNT(*) AS n FROM transfer_sessions GROUP BY route').all<{ route: string; n: number }>(),
    env.DB.prepare(`SELECT AVG(duration_ms) AS avg_ms, MAX(ledger_index) AS ledger_height
                    FROM transfer_sessions WHERE status = 'completed'`).first<{ avg_ms: number | null; ledger_height: number | null }>(),
    env.DB.prepare(`SELECT date(started_at / 1000, 'unixepoch') AS d, COUNT(*) AS n,
                           COALESCE(SUM(status = 'completed'), 0) AS ok
                    FROM transfer_sessions WHERE started_at >= ? GROUP BY d ORDER BY d`).bind(since30)
      .all<{ d: string; n: number; ok: number }>(),
  ])
  const seriesMap = new Map((series.results ?? []).map(r => [r.d, r]))
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now - (29 - i) * DAY_MS).toISOString().slice(0, 10)
    return { day, transfers: seriesMap.get(day)?.n ?? 0, completed: seriesMap.get(day)?.ok ?? 0 }
  })
  return json(
    {
      service: 'clex-chain',
      generatedAt: Math.floor(Date.now() / 1000),
      counts: {
        transfers: sessions?.n ?? 0,
        completed: completed?.n ?? 0,
        cancelled: cancelled?.n ?? 0,
        failed: failed?.n ?? 0,
        chain_ids: chains?.n ?? 0,
      },
      last24h: { transfers: recent24h?.n ?? 0 },
      by_status: Object.fromEntries((byStatus.results ?? []).map(r => [r.status, r.n])),
      by_route: Object.fromEntries((byRoute.results ?? []).map(r => [r.route, r.n])),
      avg_completed_ms: perf?.avg_ms != null ? Math.round(perf.avg_ms) : null,
      ledger_height: perf?.ledger_height ?? null,
      series: days,
      config: {
        admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
        allowed_origin: env.ALLOWED_ORIGIN ?? null,
      },
    },
    { headers: adminHeaders(cors) },
  )
}

interface AdminSessionRow {
  id: string
  sender_chain_id: string
  receiver_chain_id: string | null
  route: string
  status: string
  started_at: number
  completed_at: number | null
  duration_ms: number | null
  files_json: string
}

async function handleAdminTransfers(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const denied = await adminDenied(req, env, cors)
  if (denied) return denied
  const url = new URL(req.url)
  const limit = intParam(url, 'limit', 20, 1, 100)
  const offset = intParam(url, 'offset', 0, 0, 1_000_000)
  const statusRaw = url.searchParams.get('status')
  const status = statusRaw && (VALID_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : null
  const chain = (url.searchParams.get('chain') || '').toLowerCase()
  const where: string[] = []
  const binds: unknown[] = []
  if (status) { where.push('status = ?'); binds.push(status) }
  if (/^[0-9a-f]{4,32}$/.test(chain)) {
    where.push('(sender_chain_id LIKE ? OR receiver_chain_id LIKE ? OR id LIKE ?)')
    binds.push(`${chain}%`, `${chain}%`, `${chain}%`)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [rows, total] = await Promise.all([
    env.DB.prepare(`
      SELECT id, sender_chain_id, receiver_chain_id, route, status, started_at,
             completed_at, duration_ms, files_json
      FROM transfer_sessions ${clause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all<AdminSessionRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM transfer_sessions ${clause}`).bind(...binds).first<{ n: number }>(),
  ])
  return json(
    {
      service: 'clex-chain',
      generatedAt: Math.floor(Date.now() / 1000),
      count: rows.results?.length ?? 0,
      total: total?.n ?? 0,
      transfers: (rows.results ?? []).map((r) => {
        const files = parseFiles(r.files_json)
        return {
          id: r.id,
          sender_chain_id: r.sender_chain_id,
          receiver_chain_id: r.receiver_chain_id,
          route: r.route,
          status: r.status,
          started_at: r.started_at,
          completed_at: r.completed_at,
          duration_ms: r.duration_ms,
          files,
        }
      }),
    },
    { headers: adminHeaders(cors) },
  )
}

async function handleAdminHealth(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const denied = await adminDenied(req, env, cors)
  if (denied) return denied
  let dbReachable = false
  try {
    await env.DB.prepare('SELECT 1').first()
    dbReachable = true
  } catch { /* ignore */ }
  return json(
    {
      ok: true,
      service: 'clex-chain',
      ts: Math.floor(Date.now() / 1000),
      version: 'phase-2-admin-api',
      bindings: {
        d1: dbReachable,
        durable_object_ledger: typeof env.LEDGER?.idFromName === 'function',
      },
      config: {
        admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
      },
    },
    { headers: adminHeaders(cors) },
  )
}

interface AdminAuditRow {
  session_id: string
  status: string
  ts: number
}

async function handleAdminAudit(req: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const denied = await adminDenied(req, env, cors)
  if (denied) return denied
  const url = new URL(req.url)
  const limit = intParam(url, 'limit', 50, 1, 200)
  const events = await env.DB.prepare(
    `SELECT session_id, status, ts FROM transfer_events ORDER BY ts DESC LIMIT ?`,
  ).bind(limit).all<AdminAuditRow>()
  return json(
    {
      service: 'clex-chain',
      generatedAt: Math.floor(Date.now() / 1000),
      count: events.results?.length ?? 0,
      events: events.results ?? [],
    },
    { headers: adminHeaders(cors) },
  )
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url)
    const origin = request.headers.get('Origin') ?? ''
    const cors   = corsHeaders(origin, env.ALLOWED_ORIGIN)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    try {
      return await route(request, env, url, cors)
    } catch (err) {
      console.error('clex-chain unhandled error', err)
      return json({ error: 'internal_error' }, { status: 500, headers: cors })
    }
  },
} satisfies ExportedHandler<Env>

async function route(request: Request, env: Env, url: URL, cors: HeadersInit): Promise<Response> {
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

    // ─── Admin (gated by CLEX_ADMIN_SECRET) ────────────────────────────────
    // Mounted under /chain/admin/* and /api/admin/* so the lnch.in proxy
    // can target either prefix.
    if (request.method === 'GET' &&
        (url.pathname === '/chain/admin/summary' || url.pathname === '/api/admin/summary')) {
      return handleAdminSummary(request, env, cors)
    }
    if (request.method === 'GET' &&
        (url.pathname === '/chain/admin/transfers' || url.pathname === '/api/admin/transfers')) {
      return handleAdminTransfers(request, env, cors)
    }
    if (request.method === 'GET' &&
        (url.pathname === '/chain/admin/health' || url.pathname === '/api/admin/health')) {
      return handleAdminHealth(request, env, cors)
    }
    if (request.method === 'GET' &&
        (url.pathname === '/chain/admin/audit' || url.pathname === '/api/admin/audit')) {
      return handleAdminAudit(request, env, cors)
    }

    // GET /chain/health, /api/health, /health
    // Standardized payload consumed by lnch.in's LaunchOps health probe.
    if (
      request.method === 'GET' &&
      (url.pathname === '/chain/health' ||
        url.pathname === '/api/health' ||
        url.pathname === '/health')
    ) {
      return json(
        {
          ok: true,
          service: 'clex-chain',
          ts: Math.floor(Date.now() / 1000),
          version: 'phase-1-public-face',
        },
        {
          headers: { ...cors, 'cache-control': 'public, max-age=10, s-maxage=30' },
        },
      )
    }

    // GET /api/public/summary — public-safe ledger stats for lnch.in.
    if (request.method === 'GET' && url.pathname === '/api/public/summary') {
      try {
        const total = await env.DB.prepare(
          'SELECT COUNT(*) AS n FROM transfer_sessions',
        ).first<{ n: number }>()
        const completed = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM transfer_sessions WHERE status = 'completed'",
        ).first<{ n: number }>()
        const chainIds = await env.DB.prepare(
          'SELECT COUNT(*) AS n FROM chain_ids',
        ).first<{ n: number }>()
        const since = Date.now() - DAY_MS
        const recent = await env.DB.prepare(
          'SELECT COUNT(*) AS n FROM transfer_sessions WHERE started_at >= ?',
        )
          .bind(since)
          .first<{ n: number }>()
        return json(
          {
            service: 'clex-chain',
            generatedAt: Math.floor(Date.now() / 1000),
            counts: {
              transfers: total?.n ?? null,
              completed_transfers: completed?.n ?? null,
              chain_ids: chainIds?.n ?? null,
            },
            last24h: { transfers: recent?.n ?? null },
          },
          {
            headers: {
              ...cors,
              'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
            },
          },
        )
      } catch {
        return json(
          { service: 'clex-chain', generatedAt: Math.floor(Date.now() / 1000), counts: {}, last24h: {} },
          { headers: { ...cors, 'cache-control': 'public, max-age=30' } },
        )
      }
    }

    return json({ error: 'Not found' }, { status: 404, headers: cors })
}
