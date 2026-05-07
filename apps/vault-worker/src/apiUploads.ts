/**
 * Programmatic upload + share endpoints.
 *
 * POST   /vault/api/uploads
 *   Auth:    Authorization: Bearer ck_live_<plaintext>  OR  X-Vault-UID (UI mode)
 *   Body:    raw file bytes (multipart not required — keep it CLI-friendly)
 *   Headers:
 *     X-Filename:  original filename (URL-encoded)
 *     Content-Type: file MIME type
 *     X-Expires-In: optional, seconds (default 86400 / 24h, max 7d)
 *   Returns: { id, shareToken, downloadUrl, signedUrl, filename, sizeBytes, mimeType,
 *              expiresAt, rate: { remaining, limit, resetSeconds } }
 *
 * GET    /vault/api/uploads
 *   Auth:    X-Vault-UID
 *   Returns: list of the caller's non-expired uploads
 *
 * GET    /vault/api/uploads/:shareToken
 *   No auth required. Returns a signed Supabase download URL valid 1h.
 *
 * DELETE /vault/api/uploads/:id
 *   Auth: X-Vault-UID. Soft-revokes + deletes from Supabase.
 *
 * Files are billed against `api_keys.total_bytes` so users can see how much
 * they've shipped through each key on the management page.
 */

import {
  checkAndConsumeRate,
  findKeyByPlaintext,
  recordKeyUsage,
  apiKeysModule,
} from './apiKeys'
import type { Env } from './index'

const MAX_EXPIRES_IN = 7 * 24 * 60 * 60   // 7 days
const DEFAULT_EXPIRES_IN = 24 * 60 * 60    // 24 hours
const MIN_EXPIRES_IN = 5 * 60              // 5 minutes
const STORAGE_BUCKET = 'attachments'
const SHARE_BASE_URL = 'https://clex.in/share'

interface UploadRow {
  id: string
  user_id: string
  api_key_id: string | null
  storage_path: string
  share_token: string
  filename: string
  size_bytes: number
  mime_type: string
  upload_at: number
  expires_at: number
  download_count: number
  revoked_at: number | null
}

function jsonResponse(data: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors, ...extra },
  })
}

function errorResponse(msg: string, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return jsonResponse({ error: msg }, status, cors, extra)
}

function randomHex(byteLength: number): string {
  const buf = new Uint8Array(byteLength)
  crypto.getRandomValues(buf)
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('')
}

const SHARE_TOKEN_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
function randomShareToken(): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  let out = ''
  for (let i = 0; i < buf.length; i += 1) {
    out += SHARE_TOKEN_ALPHABET[buf[i] % SHARE_TOKEN_ALPHABET.length]
  }
  return out
}

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
  return `${env.SUPABASE_URL}${data.signedURL}`
}

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
  ).catch(() => { /* best effort */ })
}

function rowToRecord(row: UploadRow): {
  id: string
  apiKeyId: string | null
  storagePath: string
  shareToken: string
  shareUrl: string
  filename: string
  sizeBytes: number
  mimeType: string
  uploadAt: number
  expiresAt: number
  downloadCount: number
} {
  return {
    id: row.id,
    apiKeyId: row.api_key_id,
    storagePath: row.storage_path,
    shareToken: row.share_token,
    shareUrl: `${SHARE_BASE_URL}/${row.share_token}`,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    uploadAt: row.upload_at * 1000,
    expiresAt: row.expires_at * 1000,
    downloadCount: row.download_count,
  }
}

export async function handleApiUploadCreate(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  // Resolve identity. Bearer api-key path takes precedence; if absent we fall
  // back to UI-mode (X-Vault-UID).
  const authHeader = request.headers.get('Authorization') ?? ''
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const explicitUid = request.headers.get('X-Vault-UID') ?? ''

  let uid = ''
  let apiKeyId: string | null = null
  let perKeyMaxBytes = -1
  let rateState: { remaining: number; limit: number; resetSeconds: number } | null = null

  if (bearer) {
    const key = await findKeyByPlaintext(env, bearer)
    if (!key) return errorResponse('Invalid or revoked API key', 401, cors)
    const rate = await checkAndConsumeRate(env, key)
    if (!rate.ok) {
      return errorResponse(
        `Rate limit hit (${key.ratePerMinute}/min). Retry in ${rate.state.resetSeconds}s.`,
        429,
        cors,
        {
          'X-RateLimit-Limit': String(rate.state.limit),
          'X-RateLimit-Remaining': String(rate.state.remaining),
          'X-RateLimit-Reset': String(rate.state.resetSeconds),
          'Retry-After': String(rate.state.resetSeconds),
        },
      )
    }
    rateState = rate.state
    uid = key.userId
    apiKeyId = key.id
    perKeyMaxBytes = key.maxFileBytes
  } else if (explicitUid) {
    uid = explicitUid
    perKeyMaxBytes = apiKeysModule.FILE_SIZE_LIMITS[1] // UI default = 100 MB
  } else {
    return errorResponse('Authorization: Bearer ck_live_… or X-Vault-UID required', 401, cors)
  }

  const rawFilename = request.headers.get('X-Filename')
  if (!rawFilename) return errorResponse('X-Filename header required', 400, cors)
  const filename = decodeURIComponent(rawFilename).slice(0, 255)
  const contentType = request.headers.get('Content-Type') ?? 'application/octet-stream'

  const expiresInRaw = parseInt(request.headers.get('X-Expires-In') ?? '', 10)
  const expiresIn = Number.isFinite(expiresInRaw)
    ? Math.min(MAX_EXPIRES_IN, Math.max(MIN_EXPIRES_IN, expiresInRaw))
    : DEFAULT_EXPIRES_IN

  const buffer = await request.arrayBuffer()
  const fileBytes = buffer.byteLength
  if (fileBytes <= 0) return errorResponse('Empty request body', 400, cors)

  const effectiveCeiling = perKeyMaxBytes < 0
    ? apiKeysModule.ABSOLUTE_FILE_SIZE_CEILING
    : Math.min(perKeyMaxBytes, apiKeysModule.ABSOLUTE_FILE_SIZE_CEILING)
  if (fileBytes > effectiveCeiling) {
    const limitMB = (effectiveCeiling / 1024 / 1024).toFixed(0)
    return errorResponse(
      `File exceeds the per-key limit (${limitMB} MB). Raise it on the key settings page.`,
      413,
      cors,
    )
  }

  const id = randomHex(16)
  const shareToken = randomShareToken()
  const storagePath = `api-uploads/${uid}/${Date.now()}_${id}/${filename}`

  try {
    await supabaseUpload(env, storagePath, buffer, contentType)
  } catch (e: unknown) {
    return errorResponse(e instanceof Error ? e.message : 'Upload failed', 502, cors)
  }

  const uploadAt = Math.floor(Date.now() / 1000)
  const expiresAt = uploadAt + expiresIn

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO api_uploads
       (id, user_id, api_key_id, storage_path, share_token, filename, size_bytes, mime_type, upload_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, uid, apiKeyId, storagePath, shareToken, filename, fileBytes, contentType, uploadAt, expiresAt),
    env.DB.prepare(
      `INSERT INTO pending_deletions (id, storage_path, delete_at) VALUES (?, ?, ?)`
    ).bind(id, storagePath, expiresAt),
  ])

  if (apiKeyId) {
    await recordKeyUsage(env, apiKeyId, fileBytes)
  }

  let downloadUrl = ''
  try {
    downloadUrl = await supabaseSignedUrl(env, storagePath, 3600)
  } catch (e) {
    // We persisted the upload — the share link still works for download via
    // the GET /vault/api/uploads/:shareToken endpoint.
    downloadUrl = `${SHARE_BASE_URL}/${shareToken}`
  }

  const responseHeaders: Record<string, string> = rateState
    ? {
        'X-RateLimit-Limit': String(rateState.limit),
        'X-RateLimit-Remaining': String(rateState.remaining),
        'X-RateLimit-Reset': String(rateState.resetSeconds),
      }
    : {}

  return jsonResponse(
    {
      id,
      shareToken,
      shareUrl: `${SHARE_BASE_URL}/${shareToken}`,
      downloadUrl,
      filename,
      sizeBytes: fileBytes,
      mimeType: contentType,
      uploadAt: uploadAt * 1000,
      expiresAt: expiresAt * 1000,
      apiKeyId,
      rate: rateState,
    },
    201,
    cors,
    responseHeaders,
  )
}

export async function handleApiUploadList(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = request.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  const now = Math.floor(Date.now() / 1000)
  const rows = await env.DB.prepare(
    `SELECT id, user_id, api_key_id, storage_path, share_token, filename, size_bytes, mime_type,
            upload_at, expires_at, download_count, revoked_at
     FROM api_uploads
     WHERE user_id = ? AND expires_at > ? AND revoked_at IS NULL
     ORDER BY upload_at DESC
     LIMIT 200`
  ).bind(uid, now).all<UploadRow>()

  const uploads = (rows.results ?? []).map(rowToRecord)
  return jsonResponse({ uploads }, 200, cors)
}

export async function handleApiUploadDelete(
  uploadId: string,
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const uid = request.headers.get('X-Vault-UID')
  if (!uid) return errorResponse('X-Vault-UID required', 401, cors)

  const row = await env.DB.prepare(
    `SELECT id, user_id, api_key_id, storage_path, share_token, filename, size_bytes, mime_type,
            upload_at, expires_at, download_count, revoked_at
     FROM api_uploads WHERE id = ? AND user_id = ?`
  ).bind(uploadId, uid).first<UploadRow>()
  if (!row) return errorResponse('Upload not found', 404, cors)

  await supabaseDelete(env, [row.storage_path])
  await env.DB.batch([
    env.DB.prepare('UPDATE api_uploads SET revoked_at = unixepoch() WHERE id = ?').bind(uploadId),
    env.DB.prepare('DELETE FROM pending_deletions WHERE id = ?').bind(uploadId),
  ])
  return jsonResponse({ ok: true }, 200, cors)
}

export async function handleApiUploadShare(
  shareToken: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, user_id, api_key_id, storage_path, share_token, filename, size_bytes, mime_type,
            upload_at, expires_at, download_count, revoked_at
     FROM api_uploads WHERE share_token = ?`
  ).bind(shareToken).first<UploadRow>()
  if (!row) return errorResponse('Share not found', 404, cors)
  if (row.revoked_at) return errorResponse('Share revoked', 410, cors)
  if (Math.floor(Date.now() / 1000) > row.expires_at) {
    return errorResponse('Share expired', 410, cors)
  }

  let downloadUrl = ''
  try {
    downloadUrl = await supabaseSignedUrl(env, row.storage_path, 3600)
  } catch {
    return errorResponse('Could not generate download URL', 502, cors)
  }

  // Best-effort download counter — never fails the request.
  await env.DB.prepare(
    'UPDATE api_uploads SET download_count = download_count + 1 WHERE id = ?'
  ).bind(row.id).run().catch(() => undefined)

  return jsonResponse(
    {
      filename: row.filename,
      sizeBytes: row.size_bytes,
      mimeType: row.mime_type,
      downloadUrl,
      expiresAt: row.expires_at * 1000,
    },
    200,
    cors,
  )
}
