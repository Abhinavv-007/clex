/**
 * Public file-transfer API + admin endpoints for clex.in/api/*.
 *
 * v1 surface:
 *   POST   /api/transfers              create a transfer session
 *   GET    /api/transfers/:id          read transfer status (id or code)
 *   POST   /api/transfers/:id/events   append a lifecycle event
 *   DELETE /api/transfers/:id          cancel / expire a transfer
 *
 * Admin (gated by X-Admin-Secret: $CLEX_ADMIN_SECRET):
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
import { appendCors, type Env } from './googleAuth'

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

export function bumpMetric(route: string, status: number, latencyMs: number): void {
  const m = metrics()
  m.totalRequests += 1
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
  const buf = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length]
  }
  return out
}

function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function adminAllowed(request: Request, env: Env): boolean {
  const expected = env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET || ''
  if (!expected) return false
  const provided = request.headers.get('x-admin-secret') || ''
  if (!provided) return false
  return safeEqual(provided, expected)
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

async function writeTransfer(env: Env, record: TransferRecord): Promise<void> {
  const ttlSeconds = Math.max(60, Math.floor((record.expires_at - Date.now()) / 1000))
  await env.DRIVE_SESSION_STORE.put(
    `${TRANSFER_KV_PREFIX}${record.id}`,
    JSON.stringify(record),
    { expirationTtl: ttlSeconds },
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
      { type: 'transfer.cancelled', ts: Math.floor(now / 1000) },
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

function unauthorized(request: Request, env: Env): Response {
  return jsonResponse({ error: 'unauthorized' }, { status: 401 }, request, env)
}

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
  if (!adminAllowed(request, env)) return unauthorized(request, env)
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
        google_oauth_client_configured: Boolean(env.GOOGLE_CLIENT_ID),
        google_redirect_uri: env.GOOGLE_REDIRECT_URI ?? null,
        allowed_origin: env.ALLOWED_ORIGIN ?? null,
        admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
      },
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
  if (!adminAllowed(request, env)) return unauthorized(request, env)

  const url = new URL(request.url)
  const limitRaw = url.searchParams.get('limit')
  const limit = Math.min(
    TRANSFER_RECENT_LIMIT,
    Math.max(1, Number.parseInt(limitRaw ?? '20', 10) || 20),
  )

  // KV doesn't have a useful "list with values" guarantee for our scale,
  // so we list keys and read each one. With expirationTtl set to <=7d
  // and small payloads this is fine for an admin overview.
  const list = await env.DRIVE_SESSION_STORE.list({
    prefix: TRANSFER_KV_PREFIX,
    limit,
  })
  const records: TransferRecord[] = []
  for (const key of list.keys) {
    const raw = await env.DRIVE_SESSION_STORE.get(key.name)
    if (!raw) continue
    try {
      records.push(JSON.parse(raw) as TransferRecord)
    } catch {
      // skip malformed
    }
  }
  records.sort((a, b) => b.created_at - a.created_at)

  return jsonResponse(
    {
      service: 'clex-api',
      generatedAt: Math.floor(Date.now() / 1000),
      count: records.length,
      transfers: records.map((r) => ({
        transfer_id: r.id,
        code: r.code,
        status: r.status,
        file_name: r.file_name,
        file_size_bytes: r.file_size_bytes,
        file_mime: r.file_mime,
        route: r.route,
        created_at: Math.floor(r.created_at / 1000),
        expires_at: Math.floor(r.expires_at / 1000),
        events_count: r.events.length,
        client_label: r.client_label,
      })),
    },
    { status: 200 },
    request,
    env,
  )
}

export async function handleAdminHealth(request: Request, env: Env): Promise<Response> {
  if (!adminAllowed(request, env)) return unauthorized(request, env)
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
        google_oauth_client_configured: Boolean(env.GOOGLE_CLIENT_ID),
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
  if (!adminAllowed(request, env)) return unauthorized(request, env)
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
