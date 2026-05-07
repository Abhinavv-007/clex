/**
 * API-key infrastructure for the public Clex Direct API.
 *
 * Endpoints (all under /vault/api/keys):
 *   POST   /vault/api/keys          create a new key (UI: requires X-Vault-UID)
 *   GET    /vault/api/keys          list non-revoked keys owned by the caller
 *   PATCH  /vault/api/keys/:id      update name + per-key limits
 *   DELETE /vault/api/keys/:id      revoke (soft delete)
 *   GET    /vault/api/keys/:id/usage current rate-limit window for a key
 *
 * Auth model:
 *   Management endpoints trust the Firebase uid passed in `X-Vault-UID`.
 *   This matches the existing /vault/api/files convention; verifying the
 *   Firebase ID token would be slightly stronger but is intentionally
 *   deferred so we don't fan out a JWT verification path right now.
 *
 *   Programmatic upload endpoints (api_uploads.ts) authenticate via
 *   `Authorization: Bearer ck_live_<plaintext>` and look the key up by
 *   its SHA-256 hash.
 */

import type { Env } from './index'

const KEY_PREFIX = 'ck_live_'
const KEY_PREFIX_VISIBLE_LEN = KEY_PREFIX.length + 8 // ck_live_ + 8 chars

const FILE_SIZE_LIMITS = [
  10 * 1024 * 1024,           // 10 MB
  100 * 1024 * 1024,          // 100 MB
  1024 * 1024 * 1024,         // 1 GB
  -1,                         // unlimited (sentinel)
] as const

const RATE_LIMITS = [10, 30, 100, 1000, -1] as const

const MAX_KEYS_PER_USER = 25
const MAX_NAME_LENGTH = 64
// Even unlimited keys are capped at 5 GB per single upload to keep one bad
// request from blowing up the Worker. This is intentionally generous.
const ABSOLUTE_FILE_SIZE_CEILING = 5 * 1024 * 1024 * 1024

export interface ApiKeyRecord {
  id: string
  userId: string
  userEmail: string | null
  name: string
  prefix: string
  maxFileBytes: number
  ratePerMinute: number
  createdAt: number
  lastUsedAt: number | null
  totalUploads: number
  totalBytes: number
  revokedAt: number | null
}

interface ApiKeyRow {
  id: string
  user_id: string
  user_email: string | null
  name: string
  prefix: string
  hash: string
  max_file_bytes: number
  rate_per_minute: number
  created_at: number
  last_used_at: number | null
  total_uploads: number
  total_bytes: number
  revoked_at: number | null
}

function rowToRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    name: row.name,
    prefix: row.prefix,
    maxFileBytes: row.max_file_bytes,
    ratePerMinute: row.rate_per_minute,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    totalUploads: row.total_uploads,
    totalBytes: row.total_bytes,
    revokedAt: row.revoked_at,
  }
}

function randomHex(byteLength: number): string {
  const buf = new Uint8Array(byteLength)
  crypto.getRandomValues(buf)
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('')
}

function generatePlaintextKey(): string {
  // 32 random bytes → 64 hex chars after the prefix.
  return `${KEY_PREFIX}${randomHex(32)}`
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('')
}

function clampFileSize(bytes: number | null | undefined): number {
  if (bytes === undefined || bytes === null) return FILE_SIZE_LIMITS[0]
  // -1 means unlimited (capped to ABSOLUTE_FILE_SIZE_CEILING in the upload path)
  if (bytes < 0) return -1
  if (!Number.isFinite(bytes)) return FILE_SIZE_LIMITS[0]
  // Allow any numeric size in (0, ABSOLUTE_FILE_SIZE_CEILING] but the UI only
  // surfaces the four steps from FILE_SIZE_LIMITS.
  return Math.min(Math.max(Math.floor(bytes), 1), ABSOLUTE_FILE_SIZE_CEILING)
}

function clampRate(rpm: number | null | undefined): number {
  if (rpm === undefined || rpm === null) return RATE_LIMITS[0]
  if (rpm < 0) return -1
  if (!Number.isFinite(rpm)) return RATE_LIMITS[0]
  return Math.min(Math.max(Math.floor(rpm), 1), 100_000)
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'unnamed key'
  const trimmed = raw.trim().slice(0, MAX_NAME_LENGTH)
  return trimmed || 'unnamed key'
}

function jsonResponse(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })
}

function errorResponse(msg: string, status: number, cors: Record<string, string>): Response {
  return jsonResponse({ error: msg }, status, cors)
}

// ── Lookup by plaintext (used by the programmatic upload path) ───────────────

export async function findKeyByPlaintext(
  env: Env,
  plaintext: string,
): Promise<ApiKeyRecord | null> {
  if (!plaintext.startsWith(KEY_PREFIX)) return null
  const hash = await sha256Hex(plaintext)
  const row = await env.DB.prepare(
    `SELECT id, user_id, user_email, name, prefix, hash, max_file_bytes, rate_per_minute,
            created_at, last_used_at, total_uploads, total_bytes, revoked_at
     FROM api_keys WHERE hash = ? AND revoked_at IS NULL`
  ).bind(hash).first<ApiKeyRow>()
  return row ? rowToRecord(row) : null
}

export async function recordKeyUsage(
  env: Env,
  keyId: string,
  bytes: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE api_keys
     SET last_used_at = unixepoch(),
         total_uploads = total_uploads + 1,
         total_bytes = total_bytes + ?
     WHERE id = ?`
  ).bind(Math.max(0, Math.floor(bytes)), keyId).run()
}

// ── Rate limiting (KV-backed sliding minute bucket) ──────────────────────────

interface RateState {
  remaining: number
  limit: number
  resetSeconds: number
}

export async function checkAndConsumeRate(
  env: Env,
  key: ApiKeyRecord,
): Promise<{ ok: true; state: RateState } | { ok: false; state: RateState }> {
  if (key.ratePerMinute < 0) {
    // Unlimited — no KV write
    return { ok: true, state: { remaining: -1, limit: -1, resetSeconds: 60 } }
  }
  const now = Math.floor(Date.now() / 1000)
  const minuteBucket = Math.floor(now / 60)
  const kvKey = `apirate:${key.id}:${minuteBucket}`
  const raw = await env.UPLOAD_QUOTA.get(kvKey)
  const used = raw ? parseInt(raw, 10) || 0 : 0
  const resetSeconds = (minuteBucket + 1) * 60 - now
  if (used + 1 > key.ratePerMinute) {
    return { ok: false, state: { remaining: 0, limit: key.ratePerMinute, resetSeconds } }
  }
  // 90s TTL gives us comfortable buffer at minute boundaries.
  await env.UPLOAD_QUOTA.put(kvKey, String(used + 1), { expirationTtl: 90 })
  return {
    ok: true,
    state: { remaining: Math.max(0, key.ratePerMinute - used - 1), limit: key.ratePerMinute, resetSeconds },
  }
}

export async function peekRate(
  env: Env,
  key: ApiKeyRecord,
): Promise<RateState> {
  if (key.ratePerMinute < 0) return { remaining: -1, limit: -1, resetSeconds: 60 }
  const now = Math.floor(Date.now() / 1000)
  const minuteBucket = Math.floor(now / 60)
  const kvKey = `apirate:${key.id}:${minuteBucket}`
  const raw = await env.UPLOAD_QUOTA.get(kvKey)
  const used = raw ? parseInt(raw, 10) || 0 : 0
  const resetSeconds = (minuteBucket + 1) * 60 - now
  return { remaining: Math.max(0, key.ratePerMinute - used), limit: key.ratePerMinute, resetSeconds }
}

// ── Endpoint handlers ────────────────────────────────────────────────────────

export async function handleApiKeyCreate(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = req.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  let body: {
    name?: string
    email?: string
    maxFileBytes?: number
    ratePerMinute?: number
  } = {}
  try { body = await req.json() } catch { /* allow empty body */ }

  // Cap on per-user keys to prevent runaway minting.
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(uid).first<{ n: number }>()
  const count = countRow?.n ?? 0
  if (count >= MAX_KEYS_PER_USER) {
    return errorResponse(
      `Per-user key limit reached (${MAX_KEYS_PER_USER}). Revoke an existing key before minting a new one.`,
      429, cors,
    )
  }

  const plaintext = generatePlaintextKey()
  const hash = await sha256Hex(plaintext)
  const id = `ck_id_${randomHex(16)}`
  const prefix = plaintext.slice(0, KEY_PREFIX_VISIBLE_LEN)
  const name = sanitizeName(body.name)
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 320) : null
  const maxFileBytes = clampFileSize(body.maxFileBytes)
  const ratePerMinute = clampRate(body.ratePerMinute)
  const createdAt = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    `INSERT INTO api_keys (id, user_id, user_email, name, prefix, hash, max_file_bytes, rate_per_minute, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, uid, email, name, prefix, hash, maxFileBytes, ratePerMinute, createdAt).run()

  // The plaintext is returned exactly once — clients store it themselves. We
  // never echo it again.
  return jsonResponse(
    {
      key: {
        id,
        userId: uid,
        userEmail: email,
        name,
        prefix,
        maxFileBytes,
        ratePerMinute,
        createdAt,
        lastUsedAt: null,
        totalUploads: 0,
        totalBytes: 0,
        revokedAt: null,
      },
      plaintext,
    },
    201,
    cors,
  )
}

export async function handleApiKeyList(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = req.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  const result = await env.DB.prepare(
    `SELECT id, user_id, user_email, name, prefix, hash, max_file_bytes, rate_per_minute,
            created_at, last_used_at, total_uploads, total_bytes, revoked_at
     FROM api_keys
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`
  ).bind(uid).all<ApiKeyRow>()

  const keys = (result.results ?? []).map(rowToRecord)
  return jsonResponse({ keys, limits: { fileSize: FILE_SIZE_LIMITS, ratePerMinute: RATE_LIMITS } }, 200, cors)
}

export async function handleApiKeyUpdate(
  keyId: string,
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = req.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  let body: { name?: string; maxFileBytes?: number; ratePerMinute?: number } = {}
  try { body = await req.json() } catch { /* allow no body */ }

  const existing = await env.DB.prepare(
    `SELECT id, user_id, user_email, name, prefix, hash, max_file_bytes, rate_per_minute,
            created_at, last_used_at, total_uploads, total_bytes, revoked_at
     FROM api_keys WHERE id = ? AND user_id = ? AND revoked_at IS NULL`
  ).bind(keyId, uid).first<ApiKeyRow>()
  if (!existing) return errorResponse('Key not found', 404, cors)

  const name = body.name !== undefined ? sanitizeName(body.name) : existing.name
  const maxFileBytes = body.maxFileBytes !== undefined
    ? clampFileSize(body.maxFileBytes)
    : existing.max_file_bytes
  const ratePerMinute = body.ratePerMinute !== undefined
    ? clampRate(body.ratePerMinute)
    : existing.rate_per_minute

  await env.DB.prepare(
    `UPDATE api_keys SET name = ?, max_file_bytes = ?, rate_per_minute = ? WHERE id = ?`
  ).bind(name, maxFileBytes, ratePerMinute, keyId).run()

  return jsonResponse(
    {
      key: {
        ...rowToRecord(existing),
        name,
        maxFileBytes,
        ratePerMinute,
      },
    },
    200,
    cors,
  )
}

export async function handleApiKeyRevoke(
  keyId: string,
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = req.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  const result = await env.DB.prepare(
    `UPDATE api_keys SET revoked_at = unixepoch()
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`
  ).bind(keyId, uid).run()

  if (result.meta.changes === 0) return errorResponse('Key not found', 404, cors)
  return jsonResponse({ ok: true }, 200, cors)
}

export async function handleApiKeyUsage(
  keyId: string,
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = req.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  const row = await env.DB.prepare(
    `SELECT id, user_id, user_email, name, prefix, hash, max_file_bytes, rate_per_minute,
            created_at, last_used_at, total_uploads, total_bytes, revoked_at
     FROM api_keys WHERE id = ? AND user_id = ?`
  ).bind(keyId, uid).first<ApiKeyRow>()
  if (!row) return errorResponse('Key not found', 404, cors)
  const record = rowToRecord(row)
  const rate = await peekRate(env, record)

  return jsonResponse({ key: record, rate }, 200, cors)
}

export const apiKeysModule = {
  ABSOLUTE_FILE_SIZE_CEILING,
  FILE_SIZE_LIMITS,
  RATE_LIMITS,
}
