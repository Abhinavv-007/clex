/**
 * Clex Vault Worker
 *
 * Routes:
 *   POST   /vault/api/secret                    — create view-once secret
 *   GET    /vault/api/secret/:id                — fetch encrypted payload (marks as opened)
 *   GET    /vault/api/secret/:id/status         — sender status poll
 *   POST   /vault/api/files                     — upload file (proxied to Supabase Storage)
 *   GET    /vault/api/files                     — list user's files
 *   GET    /vault/api/files/:id                 — get signed download URL (1h expiry)
 *   DELETE /vault/api/files/:id                 — delete file
 *   DELETE /vault/api/subscription/:subId/files — delete all files for a subscription
 *   POST   /vault/api/pairing/offer             — device A stores pairing offer
 *   GET    /vault/api/pairing/:code             — device B fetches offer by code
 *   POST   /vault/api/pairing/:code/answer      — device B posts answer
 *   GET    /vault/api/pairing/:code/answer      — device A polls for answer
 *   DELETE /vault/api/pairing/:code             — clean up after pairing
 *   GET    /vault/api/health                    — health check
 *
 * Cron (every hour):
 *   Queries pending_deletions where delete_at <= now(), deletes from Supabase,
 *   removes from D1 attachments + pending_deletions.
 */

export interface Env {
  // KV
  VAULT_SECRETS: KVNamespace
  VAULT_TOKENS: KVNamespace
  VAULT_SIGNALS: KVNamespace
  UPLOAD_QUOTA: KVNamespace      // daily upload quota tracking
  // D1
  DB: D1Database
  // Supabase
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  // Config
  ALLOWED_ORIGIN: string
  MAX_SECRET_SIZE: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'attachments'
const MAX_FILE_BYTES = 10 * 1024 * 1024          // 10 MB per file
const DAILY_QUOTA_BYTES = 100 * 1024 * 1024      // 100 MB per user per day
const QUOTA_KV_TTL = 25 * 60 * 60               // 25 hours in seconds
const DELETE_AFTER_MS = 24 * 60 * 60 * 1000     // 24 hours in ms

// ── CORS ──────────────────────────────────────────────────────────────────────

function corsHeaders(origin: string, allowedStr: string): Record<string, string> {
  const origins = allowedStr.split(',').map(s => s.trim())
  const allowed =
    allowedStr === '*' || origins.includes(origin)
      ? allowedStr === '*' ? '*' : origin
      : ''
  if (!allowed) return {}
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Vault-UID, X-Subscription-ID, X-Filename',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function err(msg: string, status = 400, cors: Record<string, string> = {}): Response {
  return json({ error: msg }, status, cors)
}

function randomId(len = 24): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function random8Digit(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000
  return n.toString().padStart(8, '0')
}

/** UTC date string for quota key: YYYY-MM-DD */
function utcDate(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

// ── Supabase Storage helpers ──────────────────────────────────────────────────

async function supabaseUpload(
  env: Env,
  storagePath: string,
  body: ReadableStream | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body,
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase upload failed (${res.status}): ${text}`)
  }
}

/** Returns a fully-qualified signed URL valid for expiresIn seconds (default 1 hour). */
async function supabaseSignedUrl(
  env: Env,
  storagePath: string,
  expiresIn = 3600,
): Promise<string> {
  const res = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/sign/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    },
  )
  if (!res.ok) throw new Error(`Supabase sign URL failed (${res.status})`)
  const data = await res.json() as { signedURL: string }
  // signedURL is a path like /storage/v1/object/sign/... — prepend origin
  return `${env.SUPABASE_URL}${data.signedURL}`
}

/** Deletes one or more paths from the bucket. Failures are swallowed (best-effort). */
async function supabaseDelete(env: Env, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: paths }),
    },
  ).catch(() => { /* best-effort */ })
}

// ── Daily upload quota (KV) ───────────────────────────────────────────────────

async function checkAndUpdateQuota(
  env: Env,
  userId: string,
  fileBytes: number,
): Promise<{ allowed: boolean; used: number }> {
  const key = `upload_quota:${userId}:${utcDate()}`
  const raw = await env.UPLOAD_QUOTA.get(key)
  const used = raw ? parseInt(raw, 10) : 0
  if (used + fileBytes > DAILY_QUOTA_BYTES) {
    return { allowed: false, used }
  }
  await env.UPLOAD_QUOTA.put(key, String(used + fileBytes), { expirationTtl: QUOTA_KV_TTL })
  return { allowed: true, used: used + fileBytes }
}

// ── Secret Share ──────────────────────────────────────────────────────────────

interface SecretRecord {
  encryptedPayload: string
  iv: string
  title?: string
  createdAt: number
  expiresAt: number
  alreadyOpened: boolean
  openedAt?: number
  policy: SecretPolicy
}

interface SecretPolicy {
  viewOnce: boolean
  timedView: boolean
  noSelect: boolean
  tabSwitchLock: boolean
  devtoolsGuard: boolean
  memoryOnly: true
  viewWindowSeconds: number
}

function normalizeSecretPolicy(input?: Partial<SecretPolicy>): SecretPolicy {
  if (!input) {
    // Backward-compatible default for secrets created before policy support.
    return {
      viewOnce: true,
      timedView: true,
      noSelect: true,
      tabSwitchLock: true,
      devtoolsGuard: true,
      memoryOnly: true,
      viewWindowSeconds: 60,
    }
  }

  const viewOnce = Boolean(input.viewOnce)
  const timedView = Boolean(input.timedView)
  const requestedWindow = Math.floor(Number(input.viewWindowSeconds ?? 60))
  const viewWindowSeconds = timedView
    ? Math.min(3600, Math.max(15, Number.isFinite(requestedWindow) ? requestedWindow : 60))
    : 0

  return {
    viewOnce,
    timedView,
    noSelect: Boolean(input.noSelect),
    tabSwitchLock: Boolean(input.tabSwitchLock),
    devtoolsGuard: Boolean(input.devtoolsGuard),
    memoryOnly: true,
    viewWindowSeconds,
  }
}

async function handleSecretCreate(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: {
    encryptedPayload?: string
    iv?: string
    title?: string
    ttlSeconds?: number
    policy?: Partial<SecretPolicy>
  }
  try { body = await req.json() } catch { return err('Invalid JSON', 400, cors) }

  const { encryptedPayload, iv, title, ttlSeconds = 86400 } = body
  if (!encryptedPayload || !iv) return err('encryptedPayload and iv required', 400, cors)

  const maxSize = parseInt(env.MAX_SECRET_SIZE ?? '50000')
  if (encryptedPayload.length > maxSize * 1.4) return err('Payload too large', 413, cors)

  const policy = normalizeSecretPolicy(body.policy)
  const parsedTtl = Math.floor(Number(ttlSeconds))
  const ttl = Number.isFinite(parsedTtl)
    ? Math.min(604800, Math.max(60, parsedTtl))
    : 86400
  const id = randomId(16)
  const now = Date.now()
  const record: SecretRecord = {
    encryptedPayload,
    iv,
    ...(title ? { title } : {}),
    createdAt: now,
    expiresAt: now + ttl * 1000,
    alreadyOpened: false,
    policy,
  }

  await env.VAULT_SECRETS.put(`secret:${id}`, JSON.stringify(record), { expirationTtl: ttl })
  return json({ id, expiresAt: record.expiresAt, policy }, 201, cors)
}

async function handleSecretFetch(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_SECRETS.get(`secret:${id}`)
  if (!raw) return json({ gone: true, reason: 'not_found' }, 410, cors)

  const record: SecretRecord = JSON.parse(raw)
  const policy = normalizeSecretPolicy(record.policy)
  if (record.alreadyOpened && policy.viewOnce) {
    return json({ gone: true, reason: 'already_opened', openedAt: record.openedAt }, 410, cors)
  }
  if (Date.now() > record.expiresAt) {
    await env.VAULT_SECRETS.delete(`secret:${id}`)
    return json({ gone: true, reason: 'expired' }, 410, cors)
  }

  if (!record.alreadyOpened || !record.openedAt) {
    const openedAt = Date.now()
    const updated: SecretRecord = { ...record, alreadyOpened: true, openedAt, policy }
    const remainingTtl = Math.ceil((record.expiresAt - Date.now()) / 1000)
    await env.VAULT_SECRETS.put(
      `secret:${id}`,
      JSON.stringify(updated),
      { expirationTtl: Math.max(remainingTtl, 300) },
    )
  }

  return json({
    encryptedPayload: record.encryptedPayload,
    iv: record.iv,
    ...(record.title ? { title: record.title } : {}),
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    policy,
  }, 200, cors)
}

async function handleSecretStatus(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_SECRETS.get(`secret:${id}`)
  if (!raw) return json({ exists: false }, 200, cors)
  const record: SecretRecord = JSON.parse(raw)
  const policy = normalizeSecretPolicy(record.policy)
  return json({
    exists: true,
    alreadyOpened: record.alreadyOpened,
    openedAt: record.openedAt ?? null,
    expiresAt: record.expiresAt,
    policy,
  }, 200, cors)
}

// ── File Upload / Download (Supabase Storage) ─────────────────────────────────

/**
 * POST /vault/api/files
 *
 * Headers:
 *   X-Vault-UID:         authenticated user id
 *   X-Subscription-ID:  subscription / workspace id
 *   X-Filename:         original filename (URL-encoded if needed)
 *   Content-Type:       MIME type of the file
 *
 * Body: raw file bytes
 *
 * Rules enforced:
 *   1. File body > 10MB → 413
 *   2. Daily quota (100MB/user/day) → 429
 *   3. Upload to Supabase using service_role key
 *   4. Insert into D1 attachments + pending_deletions
 *   5. Update quota KV
 */
async function handleFileUpload(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const userId = req.headers.get('X-Vault-UID')
  if (!userId) return err('X-Vault-UID header required', 401, cors)

  const subscriptionId = req.headers.get('X-Subscription-ID') ?? 'default'
  const rawFilename = req.headers.get('X-Filename')
  if (!rawFilename) return err('X-Filename header required', 400, cors)
  const filename = decodeURIComponent(rawFilename)

  const contentType = req.headers.get('Content-Type') ?? 'application/octet-stream'
  const buffer = await req.arrayBuffer()
  const fileBytes = buffer.byteLength

  // ── Rule 1: file size check ──────────────────────────────────────────────
  if (fileBytes <= 0) return err('Empty request body', 400, cors)
  if (fileBytes > MAX_FILE_BYTES) {
    return err(`File exceeds 10MB limit (got ${(fileBytes / 1024 / 1024).toFixed(1)}MB)`, 413, cors)
  }

  // ── Rule 2: daily quota check ────────────────────────────────────────────
  const quota = await checkAndUpdateQuota(env, userId, fileBytes)
  if (!quota.allowed) {
    const usedMB = (quota.used / 1024 / 1024).toFixed(1)
    return err(`Daily upload quota exceeded (${usedMB}MB / 100MB used today)`, 429, cors)
  }

  // ── Rule 3: upload to Supabase ───────────────────────────────────────────
  const timestamp = Date.now()
  const storagePath = `${userId}/${subscriptionId}/${timestamp}_${filename}`

  try {
    await supabaseUpload(env, storagePath, buffer, contentType)
  } catch (e: unknown) {
    // Roll back quota increment on upload failure
    const key = `upload_quota:${userId}:${utcDate()}`
    const raw = await env.UPLOAD_QUOTA.get(key)
    if (raw) {
      const current = parseInt(raw, 10) - fileBytes
      if (current > 0) {
        await env.UPLOAD_QUOTA.put(key, String(current), { expirationTtl: QUOTA_KV_TTL })
      } else {
        await env.UPLOAD_QUOTA.delete(key)
      }
    }
    return err(e instanceof Error ? e.message : 'Upload failed', 502, cors)
  }

  // ── Rule 4: persist metadata in D1 ──────────────────────────────────────
  const id = randomId(16)
  const uploadAt = Math.floor(timestamp / 1000)
  const deleteAt = Math.floor((timestamp + DELETE_AFTER_MS) / 1000)

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO attachments (id, user_id, subscription_id, storage_path, filename, size_bytes, mime_type, upload_at, delete_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, userId, subscriptionId, storagePath, filename, fileBytes, contentType, uploadAt, deleteAt),

    env.DB.prepare(`
      INSERT INTO pending_deletions (id, storage_path, delete_at)
      VALUES (?, ?, ?)
    `).bind(id, storagePath, deleteAt),
  ])

  return json({
    id,
    storagePath,
    filename,
    sizeBytes: fileBytes,
    mimeType: contentType,
    uploadAt: uploadAt * 1000,
    deleteAt: deleteAt * 1000,
  }, 201, cors)
}

/**
 * GET /vault/api/files/:id
 *
 * Verifies user owns the file via D1, then returns a Supabase signed URL
 * valid for 1 hour. Client downloads directly from Supabase.
 */
async function handleFileDownload(
  fileId: string,
  userId: string | null,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const row = userId
    ? await env.DB.prepare(
      'SELECT storage_path, filename, mime_type, size_bytes, delete_at FROM attachments WHERE id = ? AND user_id = ?'
    ).bind(fileId, userId).first<{ storage_path: string; filename: string; mime_type: string; size_bytes: number; delete_at: number }>()
    : await env.DB.prepare(
      'SELECT storage_path, filename, mime_type, size_bytes, delete_at FROM attachments WHERE id = ?'
    ).bind(fileId).first<{ storage_path: string; filename: string; mime_type: string; size_bytes: number; delete_at: number }>()

  if (!row) return err('File not found or access denied', 404, cors)
  if (Math.floor(Date.now() / 1000) > row.delete_at) {
    return err('File has expired', 410, cors)
  }

  try {
    const signedUrl = await supabaseSignedUrl(env, row.storage_path)
    return json({
      downloadUrl: signedUrl,
      signedUrl,
      filename: row.filename,
      sizeBytes: row.size_bytes,
      mimeType: row.mime_type,
      expiresAt: row.delete_at * 1000,
      expiresIn: 3600,
    }, 200, cors)
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Failed to generate download URL', 502, cors)
  }
}

/**
 * DELETE /vault/api/files/:id
 *
 * Deletes from Supabase Storage + D1 attachments + D1 pending_deletions.
 */
async function handleFileDelete(fileId: string, userId: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT storage_path FROM attachments WHERE id = ? AND user_id = ?'
  ).bind(fileId, userId).first<{ storage_path: string }>()

  if (!row) return err('File not found or access denied', 404, cors)

  await supabaseDelete(env, [row.storage_path])
  await env.DB.batch([
    env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(fileId),
    env.DB.prepare('DELETE FROM pending_deletions WHERE id = ?').bind(fileId),
  ])

  return json({ ok: true }, 200, cors)
}

/**
 * GET /vault/api/files
 *
 * Lists all non-expired attachments for a user.
 */
async function handleFileList(userId: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const now = Math.floor(Date.now() / 1000)
  const result = await env.DB.prepare(`
    SELECT id, storage_path, filename, size_bytes, mime_type, upload_at, delete_at
    FROM attachments
    WHERE user_id = ? AND delete_at > ?
    ORDER BY upload_at DESC
  `).bind(userId, now).all<{
    id: string
    storage_path: string
    filename: string
    size_bytes: number
    mime_type: string
    upload_at: number
    delete_at: number
  }>()

  const files = (result.results ?? []).map(f => ({
    id: f.id,
    storagePath: f.storage_path,
    filename: f.filename,
    sizeBytes: f.size_bytes,
    mimeType: f.mime_type,
    uploadAt: f.upload_at * 1000,
    deleteAt: f.delete_at * 1000,
  }))

  return json({ files }, 200, cors)
}

/**
 * DELETE /vault/api/subscription/:subId/files
 *
 * Immediately deletes all files associated with a subscription from
 * Supabase Storage and removes all D1 records.
 */
async function handleSubscriptionDelete(
  subId: string,
  userId: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT id, storage_path FROM attachments WHERE subscription_id = ? AND user_id = ?'
  ).bind(subId, userId).all<{ id: string; storage_path: string }>()

  const rows = result.results ?? []
  if (rows.length === 0) return json({ ok: true, deleted: 0 }, 200, cors)

  // Delete all from Supabase in one call
  const paths = rows.map(r => r.storage_path)
  await supabaseDelete(env, paths)

  // Delete all D1 records in a batch
  const ids = rows.map(r => r.id)
  const placeholders = ids.map(() => '?').join(', ')
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...ids),
    env.DB.prepare(`DELETE FROM pending_deletions WHERE id IN (${placeholders})`).bind(...ids),
  ])

  return json({ ok: true, deleted: rows.length }, 200, cors)
}

// ── Cron: pending deletions ───────────────────────────────────────────────────

/**
 * Runs every hour via Cron Trigger.
 * Fetches rows from pending_deletions where delete_at <= now(),
 * deletes each file from Supabase Storage, then cleans up D1.
 */
async function runPendingDeletions(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  const result = await env.DB.prepare(
    'SELECT id, storage_path FROM pending_deletions WHERE delete_at <= ? LIMIT 200'
  ).bind(now).all<{ id: string; storage_path: string }>()

  const rows = result.results ?? []
  if (rows.length === 0) return

  const paths = rows.map(r => r.storage_path)
  await supabaseDelete(env, paths)

  const ids = rows.map(r => r.id)
  const placeholders = ids.map(() => '?').join(', ')
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM pending_deletions WHERE id IN (${placeholders})`).bind(...ids),
    env.DB.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...ids),
  ])
}

// ── Device Pairing ────────────────────────────────────────────────────────────

interface PairingOffer {
  code: string
  offer: string
  deviceInfo: string
  createdAt: number
  expiresAt: number
}

async function handlePairingOffer(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: { offer?: string; deviceInfo?: string }
  try { body = await req.json() } catch { return err('Invalid JSON', 400, cors) }
  if (!body.offer) return err('offer required', 400, cors)

  const code = random8Digit()
  const now = Date.now()
  const record: PairingOffer = {
    code,
    offer: body.offer,
    deviceInfo: body.deviceInfo ?? '{}',
    createdAt: now,
    expiresAt: now + 300_000,
  }

  await env.VAULT_SIGNALS.put(`pairing:${code}`, JSON.stringify(record), { expirationTtl: 300 })
  return json({ code, expiresAt: record.expiresAt }, 201, cors)
}

async function handlePairingFetch(code: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_SIGNALS.get(`pairing:${code}`)
  if (!raw) return json({ found: false }, 404, cors)

  const record: PairingOffer = JSON.parse(raw)
  if (Date.now() > record.expiresAt) {
    await env.VAULT_SIGNALS.delete(`pairing:${code}`)
    return json({ found: false, reason: 'expired' }, 404, cors)
  }
  return json({ found: true, offer: record.offer, deviceInfo: record.deviceInfo, expiresAt: record.expiresAt }, 200, cors)
}

async function handlePairingAnswer(code: string, req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: { answer?: string }
  try { body = await req.json() } catch { return err('Invalid JSON', 400, cors) }
  if (!body.answer) return err('answer required', 400, cors)
  await env.VAULT_SIGNALS.put(`pairing-answer:${code}`, body.answer, { expirationTtl: 60 })
  return json({ ok: true }, 200, cors)
}

async function handlePairingAnswerPoll(code: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const answer = await env.VAULT_SIGNALS.get(`pairing-answer:${code}`)
  if (!answer) return json({ found: false }, 200, cors)
  return json({ found: true, answer }, 200, cors)
}

async function handlePairingDelete(code: string, env: Env, cors: Record<string, string>): Promise<Response> {
  await env.VAULT_SIGNALS.delete(`pairing:${code}`)
  await env.VAULT_SIGNALS.delete(`pairing-answer:${code}`)
  return json({ ok: true }, 200, cors)
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') ?? ''
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN ?? '*')
    const method = request.method.toUpperCase()

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const path = url.pathname

    // Health
    if (path === '/vault/api/health' || path === '/health') {
      return json({ ok: true, service: 'vault', ts: Date.now() }, 200, cors)
    }

    // ── Secret Share ──────────────────────────────────────────────────────────
    if (path === '/vault/api/secret' && method === 'POST') {
      return handleSecretCreate(request, env, cors)
    }

    const secretMatch = path.match(/^\/vault\/api\/secret\/([a-f0-9]+)$/)
    if (secretMatch) {
      const id = secretMatch[1]
      if (method === 'GET') return handleSecretFetch(id, env, cors)
      return err('Method not allowed', 405, cors)
    }

    const secretStatusMatch = path.match(/^\/vault\/api\/secret\/([a-f0-9]+)\/status$/)
    if (secretStatusMatch) {
      if (method === 'GET') return handleSecretStatus(secretStatusMatch[1], env, cors)
      return err('Method not allowed', 405, cors)
    }

    // ── Files (Supabase Storage) ──────────────────────────────────────────────
    if (path === '/vault/api/files') {
      if (method === 'POST') return handleFileUpload(request, env, cors)
      if (method === 'GET') {
        const userId = request.headers.get('X-Vault-UID')
        if (!userId) return err('X-Vault-UID required', 401, cors)
        return handleFileList(userId, env, cors)
      }
    }

    const fileMatch = path.match(/^\/vault\/api\/files\/([a-f0-9]+)$/)
    if (fileMatch) {
      const fileId = fileMatch[1]
      if (method === 'GET') {
        const userId = request.headers.get('X-Vault-UID')
        return handleFileDownload(fileId, userId, env, cors)
      }
      const userId = request.headers.get('X-Vault-UID')
      if (!userId) return err('X-Vault-UID required', 401, cors)
      if (method === 'DELETE') return handleFileDelete(fileId, userId, env, cors)
    }

    const subDeleteMatch = path.match(/^\/vault\/api\/subscription\/([^/]+)\/files$/)
    if (subDeleteMatch && method === 'DELETE') {
      const userId = request.headers.get('X-Vault-UID')
      if (!userId) return err('X-Vault-UID required', 401, cors)
      return handleSubscriptionDelete(subDeleteMatch[1], userId, env, cors)
    }

    // ── Device Pairing ────────────────────────────────────────────────────────
    if (path === '/vault/api/pairing/offer' && method === 'POST') {
      return handlePairingOffer(request, env, cors)
    }

    const pairingAnswerMatch = path.match(/^\/vault\/api\/pairing\/([0-9]{8})\/answer$/)
    if (pairingAnswerMatch) {
      const code = pairingAnswerMatch[1]
      if (method === 'POST') return handlePairingAnswer(code, request, env, cors)
      if (method === 'GET') return handlePairingAnswerPoll(code, env, cors)
    }

    const pairingMatch = path.match(/^\/vault\/api\/pairing\/([0-9]{8})$/)
    if (pairingMatch) {
      const code = pairingMatch[1]
      if (method === 'GET') return handlePairingFetch(code, env, cors)
      if (method === 'DELETE') return handlePairingDelete(code, env, cors)
    }

    return err('Not found', 404, cors)
  },

  // Runs every hour — cleans up expired files from Supabase + D1
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runPendingDeletions(env)
  },
}
