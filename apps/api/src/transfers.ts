/**
 * Public file-transfer API + admin endpoints for clex.in/api/*.
 *
 * v1 surface:
 *   POST   /api/transfers              create a transfer session
 *   GET    /api/transfers/:id          read transfer status (id or code)
 *   POST   /api/transfers/:id/events   append a lifecycle event
 *   DELETE /api/transfers/:id          cancel / expire a transfer
 *
 * Admin:
 *   GET    /api/admin/summary
 *   GET    /api/admin/transfers
 *   GET    /api/admin/health
 *   GET    /api/admin/audit
 *
 * Storage model:
 *   - Transfer record stored in `DRIVE_SESSION_STORE` KV under
 *     `transfer:{id}`. id is 32 hex chars.
 *   - The friendly receive code is stored separately under
 *     `transfer-code:{code}` -> id, so receivers can resolve a 6-char
 *     code to the underlying transfer record.
 *   - File-name and file-mime are *optional* metadata supplied by the
 *     creator; clex itself never touches the actual bytes server-side.
 *     The transfer happens browser-to-browser via WebRTC signaling,
 *     this API is purely the metadata layer that makes a CLI client
 *     possible.
 *
 * The CLI itself ships in Phase 3. This PR establishes the stable
 * shape so lnch.in's developer docs and any third-party integrations
 * have something to integrate against today.
 */
import { appendCors, type Env } from './env'
import { requireAdminOrSecret, requireAdminSession } from './adminPanel'
import { safeEqual, sha256Hex } from './crypto'

const TRANSFER_KV_PREFIX = 'transfer:'
const TRANSFER_CODE_KV_PREFIX = 'transfer-code:'
const TRANSFER_DEFAULT_TTL_SECONDS = 24 * 60 * 60
const TRANSFER_MAX_TTL_SECONDS = 7 * 24 * 60 * 60
const TRANSFER_MIN_TTL_SECONDS = 60
const TRANSFER_EVENT_LIMIT = 64
const TRANSFER_RECENT_LIMIT = 50
const RECEIVE_URL_BASE = 'https://clex.in/receive'

// Letters/digits with ambiguous characters removed (no 0/O, 1/I/L, S/5,
// B/8). Six chars from this alphabet gives ~24^6 = 191 million codes,
// plenty for the lifetime of a TTL'd transfer.
const CODE_ALPHABET = '23456789ACDEFGHJKMNPQRTVWXYZ'
const CODE_LENGTH = 6

type TransferStatus =
  | 'created'
  | 'connected'
  | 'completed'
  | 'cancelled'
  | 'expired'

interface TransferEvent {
  type: string
  ts: number
  details?: Record<string, unknown>
}

export interface TransferRecord {
  id: string
  code: string
  receive_url: string
  status: TransferStatus
  file_name: string | null
  file_size_bytes: number | null
  file_mime: string | null
  route: 'p2p' | 'fallback' | null
  created_at: number
  expires_at: number
  events: TransferEvent[]
  client_label: string | null
  /**
   * SHA-256 of the manage token handed to the creator. Cancelling needs the
   * token: the receive code alone is short and is shown to the receiver, so it
   * must not be enough to kill someone else's transfer. Records created before
   * this field existed have none and stay cancellable by code.
   */
  manage_hash?: string
}

/** What the admin listing needs, kept in the KV key's metadata. */
interface TransferMeta {
  code: string
  status: TransferStatus
  file_name: string | null
  file_size_bytes: number | null
  file_mime: string | null
  route: 'p2p' | 'fallback' | null
  created_at: number
  expires_at: number
  events_count: number
  client_label: string | null
}

interface AdminMetrics {
  bootedAt: number
  totalRequests: number
  perRoute: Map<string, { total: number; success: number; errors: number; lastSeen: number; latencySum: number }>
  statusCodes: Map<number, number>
  transfers: {
    created: number
    completed: number
    cancelled: number
    expired: number
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __clexApiAdminMetrics: AdminMetrics | undefined
}

function metrics(): AdminMetrics {
  if (!globalThis.__clexApiAdminMetrics) {
    globalThis.__clexApiAdminMetrics = {
      bootedAt: Date.now(),
      totalRequests: 0,
      perRoute: new Map(),
      statusCodes: new Map(),
      transfers: { created: 0, completed: 0, cancelled: 0, expired: 0 },
    }
  }
  return globalThis.__clexApiAdminMetrics
}

/** Distinct routes tracked per isolate; anything past this is pooled. */
const MAX_TRACKED_ROUTES = 64

export function bumpMetric(route: string, status: number, latencyMs: number): void {
  const m = metrics()
  m.totalRequests += 1
  if (!m.perRoute.has(route) && m.perRoute.size >= MAX_TRACKED_ROUTES) route = '(other)'
  const r =
    m.perRoute.get(route) ??
    { total: 0, success: 0, errors: 0, lastSeen: 0, latencySum: 0 }
  r.total += 1
  if (status >= 400) r.errors += 1
  else r.success += 1
  r.lastSeen = Math.floor(Date.now() / 1000)
  r.latencySum += latencyMs
  m.perRoute.set(route, r)
  m.statusCodes.set(status, (m.statusCodes.get(status) ?? 0) + 1)
}

function jsonResponse(data: unknown, init: ResponseInit = {}, request?: Request, env?: Env): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
  if (request && env) appendCors(headers, request, env)
  return new Response(JSON.stringify(data), { ...init, headers })
}

function generateId(): string {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateCode(): string {
  // Rejection sampling: 256 is not a multiple of the alphabet size, so a
  // plain modulo would make the first letters of the alphabet more likely.
  const limit = 256 - (256 % CODE_ALPHABET.length)
  let out = ''
  while (out.length < CODE_LENGTH) {
    const buf = new Uint8Array(CODE_LENGTH * 2)
    crypto.getRandomValues(buf)
    for (const b of buf) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return out
}

async function readTransfer(env: Env, id: string): Promise<TransferRecord | null> {
  const raw = await env.DRIVE_SESSION_STORE.get(`${TRANSFER_KV_PREFIX}${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TransferRecord
  } catch {
    return null
  }
}

function transferMeta(record: TransferRecord): TransferMeta {
  return {
    code: record.code,
    status: record.status,
    file_name: record.file_name ? record.file_name.slice(0, 120) : null,
    file_size_bytes: record.file_size_bytes,
    file_mime: record.file_mime ? record.file_mime.slice(0, 64) : null,
    route: record.route,
    created_at: record.created_at,
    expires_at: record.expires_at,
    events_count: record.events.length,
    client_label: record.client_label ? record.client_label.slice(0, 64) : null,
  }
}

async function writeTransfer(env: Env, record: TransferRecord): Promise<void> {
  const ttlSeconds = Math.max(60, Math.floor((record.expires_at - Date.now()) / 1000))
  await env.DRIVE_SESSION_STORE.put(
    `${TRANSFER_KV_PREFIX}${record.id}`,
    JSON.stringify(record),
    { expirationTtl: ttlSeconds, metadata: transferMeta(record) },
  )
  await env.DRIVE_SESSION_STORE.put(
    `${TRANSFER_CODE_KV_PREFIX}${record.code}`,
    record.id,
    { expirationTtl: ttlSeconds },
  )
}

async function resolveTransferId(env: Env, codeOrId: string): Promise<string | null> {
  const normalized = codeOrId.trim()
  if (!normalized) return null
  if (/^[0-9a-f]{32}$/i.test(normalized)) return normalized.toLowerCase()
  if (/^[A-Za-z0-9]{4,12}$/.test(normalized)) {
    const id = await env.DRIVE_SESSION_STORE.get(
      `${TRANSFER_CODE_KV_PREFIX}${normalized.toUpperCase()}`,
    )
    return id || null
  }
  return null
}

function isFinal(status: TransferStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'expired'
}

function ensureExpiry(record: TransferRecord): TransferRecord {
  if (record.status === 'created' && Date.now() > record.expires_at) {
    return { ...record, status: 'expired' }
  }
  return record
}

export async function handleCreateTransfer(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env)
  }

  const fileName = typeof body.file_name === 'string' ? body.file_name.slice(0, 256) : null
  const fileMime =
    typeof body.file_mime === 'string' ? body.file_mime.slice(0, 128) : null
  const fileSizeRaw = body.file_size_bytes
  const fileSize =
    typeof fileSizeRaw === 'number' && Number.isFinite(fileSizeRaw) && fileSizeRaw >= 0
      ? Math.floor(fileSizeRaw)
      : null
  const clientLabel =
    typeof body.client === 'string' ? body.client.slice(0, 64) : null
  const routeRaw = typeof body.route === 'string' ? body.route : null
  const route =
    routeRaw === 'p2p' || routeRaw === 'fallback' ? routeRaw : null

  let ttlSeconds = TRANSFER_DEFAULT_TTL_SECONDS
  const ttlRaw = body.ttl_seconds
  if (typeof ttlRaw === 'number' && Number.isFinite(ttlRaw)) {
    ttlSeconds = Math.min(
      TRANSFER_MAX_TTL_SECONDS,
      Math.max(TRANSFER_MIN_TTL_SECONDS, Math.floor(ttlRaw)),
    )
  }

  const now = Date.now()
  const id = generateId()
  const manageToken = `${generateId()}${generateId()}`
  // Try a few times in case of code collision (extremely rare for 24^6).
  let code = generateCode()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await env.DRIVE_SESSION_STORE.get(`${TRANSFER_CODE_KV_PREFIX}${code}`)
    if (!existing) break
    code = generateCode()
  }

  const record: TransferRecord = {
    id,
    code,
    receive_url: `${RECEIVE_URL_BASE}?code=${code}`,
    status: 'created',
    file_name: fileName,
    file_size_bytes: fileSize,
    file_mime: fileMime,
    route,
    created_at: now,
    expires_at: now + ttlSeconds * 1000,
    events: [
      {
        type: 'transfer.created',
        ts: Math.floor(now / 1000),
        details: { code },
      },
    ],
    client_label: clientLabel,
    manage_hash: await sha256Hex(manageToken),
  }

  await writeTransfer(env, record)
  metrics().transfers.created += 1

  return jsonResponse(
    {
      transfer_id: record.id,
      code: record.code,
      receive_url: record.receive_url,
      status: record.status,
      expires_at: Math.floor(record.expires_at / 1000),
      created_at: Math.floor(record.created_at / 1000),
      // Shown once. Send it as `Authorization: Bearer <manage_token>` to cancel.
      manage_token: manageToken,
    },
    { status: 201 },
    request,
    env,
  )
}

export async function handleGetTransfer(
  request: Request,
  env: Env,
  codeOrId: string,
): Promise<Response> {
  const id = await resolveTransferId(env, codeOrId)
  if (!id) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)

  const recordRaw = await readTransfer(env, id)
  if (!recordRaw) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)
  const record = ensureExpiry(recordRaw)

  return jsonResponse(
    {
      transfer_id: record.id,
      code: record.code,
      receive_url: record.receive_url,
      status: record.status,
      file_name: record.file_name,
      file_size_bytes: record.file_size_bytes,
      file_mime: record.file_mime,
      route: record.route,
      created_at: Math.floor(record.created_at / 1000),
      expires_at: Math.floor(record.expires_at / 1000),
      events: record.events,
    },
    { status: 200 },
    request,
    env,
  )
}

export async function handleAppendEvent(
  request: Request,
  env: Env,
  codeOrId: string,
): Promise<Response> {
  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text) body = JSON.parse(text) as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env)
  }

  const eventType =
    typeof body.type === 'string' && /^[a-z][a-z0-9._-]{0,63}$/i.test(body.type)
      ? body.type
      : null
  if (!eventType) {
    return jsonResponse({ error: 'invalid_event_type' }, { status: 400 }, request, env)
  }
  const details =
    body.details && typeof body.details === 'object' && !Array.isArray(body.details)
      ? (body.details as Record<string, unknown>)
      : undefined

  const id = await resolveTransferId(env, codeOrId)
  if (!id) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)

  const recordRaw = await readTransfer(env, id)
  if (!recordRaw) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)
  let record = ensureExpiry(recordRaw)
  if (isFinal(record.status)) {
    return jsonResponse(
      { error: 'transfer_already_final', status: record.status },
      { status: 409 },
      request,
      env,
    )
  }

  const now = Date.now()
  const newEvent: TransferEvent = {
    type: eventType,
    ts: Math.floor(now / 1000),
    ...(details ? { details } : {}),
  }
  const events = [...record.events, newEvent].slice(-TRANSFER_EVENT_LIMIT)
  let nextStatus = record.status
  if (eventType === 'transfer.connected') nextStatus = 'connected'
  if (eventType === 'transfer.completed') {
    nextStatus = 'completed'
    metrics().transfers.completed += 1
  }
  record = { ...record, events, status: nextStatus }
  await writeTransfer(env, record)

  return jsonResponse(
    {
      transfer_id: record.id,
      status: record.status,
      event: newEvent,
      events_count: record.events.length,
    },
    { status: 200 },
    request,
    env,
  )
}

export async function handleCancelTransfer(
  request: Request,
  env: Env,
  codeOrId: string,
): Promise<Response> {
  const id = await resolveTransferId(env, codeOrId)
  if (!id) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)

  const recordRaw = await readTransfer(env, id)
  if (!recordRaw) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)
  if (recordRaw.manage_hash) {
    const auth = request.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
    if (!token || !safeEqual(await sha256Hex(token), recordRaw.manage_hash)) {
      return jsonResponse({ error: 'manage_token_required' }, { status: 401 }, request, env)
    }
  }
  return cancelTransfer(request, env, recordRaw)
}

async function cancelTransfer(request: Request, env: Env, recordRaw: TransferRecord, by = 'owner'): Promise<Response> {
  let record = ensureExpiry(recordRaw)
  if (record.status === 'completed') {
    return jsonResponse(
      { error: 'transfer_already_completed', status: record.status },
      { status: 409 },
      request,
      env,
    )
  }
  if (record.status === 'cancelled' || record.status === 'expired') {
    return jsonResponse(
      { transfer_id: record.id, status: record.status, already: true },
      { status: 200 },
      request,
      env,
    )
  }
  const now = Date.now()
  record = {
    ...record,
    status: 'cancelled',
    events: [
      ...record.events,
      { type: 'transfer.cancelled', ts: Math.floor(now / 1000), details: { by } },
    ].slice(-TRANSFER_EVENT_LIMIT),
  }
  await writeTransfer(env, record)
  metrics().transfers.cancelled += 1

  return jsonResponse(
    { transfer_id: record.id, status: record.status },
    { status: 200 },
    request,
    env,
  )
}

// ─── Admin ──────────────────────────────────────────────────────────────

function serializeRoutes() {
  const m = metrics()
  return Array.from(m.perRoute.entries())
    .map(([route, r]) => ({
      route,
      total: r.total,
      success: r.success,
      errors: r.errors,
      error_rate_pct: r.total > 0 ? Number(((r.errors / r.total) * 100).toFixed(2)) : null,
      last_seen: r.lastSeen,
      avg_latency_ms: r.total > 0 ? Math.round(r.latencySum / r.total) : null,
    }))
    .sort((a, b) => b.total - a.total)
}

function serializeStatusCodes(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [code, count] of metrics().statusCodes.entries()) {
    out[String(code)] = count
  }
  return out
}

export async function handleAdminSummary(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const m = metrics()
  return jsonResponse(
    {
      service: 'clex-api',
      generatedAt: Math.floor(Date.now() / 1000),
      process: {
        booted_at: Math.floor(m.bootedAt / 1000),
        uptime_ms: Date.now() - m.bootedAt,
        runtime: 'cloudflare-workers',
      },
      bindings: {
        kv_drive_session_store: typeof env.DRIVE_SESSION_STORE?.put === 'function',
      },
      config: {
        allowed_origin: env.ALLOWED_ORIGIN ?? null,
        admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
        webauthn_rp_id: env.WEBAUTHN_RP_ID ?? null,
        frontend_base_url: env.FRONTEND_BASE_URL ?? null,
      },
      // Counters live in this isolate's memory: they reset whenever
      // Cloudflare starts a fresh isolate and each isolate counts only the
      // requests it served. They describe recent traffic, not all-time totals.
      metrics_scope: 'isolate',
      metrics: {
        total_requests: m.totalRequests,
        per_route: serializeRoutes(),
        status_codes: serializeStatusCodes(),
        transfers: m.transfers,
      },
    },
    { status: 200 },
    request,
    env,
  )
}

export async function handleAdminTransfers(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError

  const url = new URL(request.url)
  const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50))
  const statusFilter = url.searchParams.get('status')

  // KV lists keys alphabetically, not by time, so the newest transfers can
  // only be found by reading every key. The record summary rides in each
  // key's metadata, so that is one list call per thousand transfers rather
  // than one read per transfer; only records written before metadata existed
  // are fetched individually.
  const rows: (TransferMeta & { transfer_id: string })[] = []
  let cursor: string | undefined
  let pages = 0
  do {
    const page = await env.DRIVE_SESSION_STORE.list<TransferMeta>({ prefix: TRANSFER_KV_PREFIX, cursor })
    await Promise.all(page.keys.map(async key => {
      const id = key.name.slice(TRANSFER_KV_PREFIX.length)
      if (key.metadata) {
        rows.push({ transfer_id: id, ...key.metadata })
        return
      }
      const record = await readTransfer(env, id)
      if (record) rows.push({ transfer_id: id, ...transferMeta(record) })
    }))
    cursor = page.list_complete ? undefined : page.cursor
    pages += 1
  } while (cursor && pages < 10)

  const now = Date.now()
  const normalized = rows.map(row => ({
    ...row,
    status: row.status === 'created' && now > row.expires_at ? 'expired' as const : row.status,
  }))
  const counts = normalized.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})
  const filtered = statusFilter ? normalized.filter(row => row.status === statusFilter) : normalized
  filtered.sort((a, b) => b.created_at - a.created_at)

  return jsonResponse(
    {
      service: 'clex-api',
      generatedAt: Math.floor(now / 1000),
      total: normalized.length,
      counts,
      count: Math.min(limit, filtered.length),
      transfers: filtered.slice(0, limit).map(r => ({
        transfer_id: r.transfer_id,
        code: r.code,
        status: r.status,
        file_name: r.file_name,
        file_size_bytes: r.file_size_bytes,
        file_mime: r.file_mime,
        route: r.route,
        created_at: Math.floor(r.created_at / 1000),
        expires_at: Math.floor(r.expires_at / 1000),
        events_count: r.events_count,
        client_label: r.client_label,
      })),
    },
    { status: 200 },
    request,
    env,
  )
}

/** DELETE /api/admin/transfers/:id — the operator's cancel, no token needed. */
export async function handleAdminTransferCancel(request: Request, env: Env, codeOrId: string): Promise<Response> {
  const authError = await requireAdminSession(request, env)
  if (authError) return authError
  const id = await resolveTransferId(env, codeOrId)
  if (!id) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)
  const record = await readTransfer(env, id)
  if (!record) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)
  return cancelTransfer(request, env, record, 'admin')
}

/** GET /api/admin/transfers/:id — full record, events included. */
export async function handleAdminTransferDetail(request: Request, env: Env, codeOrId: string): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const id = await resolveTransferId(env, codeOrId)
  const record = id ? await readTransfer(env, id) : null
  if (!record) return jsonResponse({ error: 'not_found' }, { status: 404 }, request, env)
  const { manage_hash: _hidden, ...rest } = ensureExpiry(record)
  return jsonResponse({ transfer: rest }, { status: 200 }, request, env)
}

export async function handleAdminHealth(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const m = metrics()
  return jsonResponse(
    {
      ok: true,
      service: 'clex-api',
      ts: Math.floor(Date.now() / 1000),
      version: 'phase-2-admin-api',
      booted_at: Math.floor(m.bootedAt / 1000),
      uptime_ms: Date.now() - m.bootedAt,
      runtime: 'cloudflare-workers',
      bindings: {
        kv_drive_session_store: typeof env.DRIVE_SESSION_STORE?.put === 'function',
      },
      config: {
        admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
      },
      metrics: {
        total_requests: m.totalRequests,
        per_route_count: m.perRoute.size,
        transfers: m.transfers,
      },
    },
    { status: 200 },
    request,
    env,
  )
}

export async function handleAdminAudit(request: Request, env: Env): Promise<Response> {
  const authError = await requireAdminOrSecret(request, env)
  if (authError) return authError
  const m = metrics()
  const events: { type: string; ts: number; details: Record<string, unknown> }[] = [
    {
      type: 'process.boot',
      ts: Math.floor(m.bootedAt / 1000),
      details: { runtime: 'cloudflare-workers' },
    },
  ]
  for (const [code, count] of m.statusCodes.entries()) {
    if (code >= 500) {
      events.push({
        type: 'response.5xx',
        ts: Math.floor(Date.now() / 1000),
        details: { status: code, count },
      })
    }
  }
  return jsonResponse(
    {
      service: 'clex-api',
      generatedAt: Math.floor(Date.now() / 1000),
      events: events.sort((a, b) => b.ts - a.ts),
    },
    { status: 200 },
    request,
    env,
  )
}
