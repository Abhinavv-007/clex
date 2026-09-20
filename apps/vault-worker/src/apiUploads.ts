/**
 * Programmatic upload + share endpoints.
 *
 * POST   /vault/api/uploads
 *   Body:    raw file bytes (multipart not required — keep it CLI-friendly)
 *   Headers:
 *     X-Filename:  original filename (URL-encoded)
 *     Content-Type: file MIME type
 *     X-Expires-In: optional, seconds (default 86400 / 24h, max 7d)
 *   Returns: { id, shareToken, downloadUrl, signedUrl, filename, sizeBytes, mimeType,
 *              expiresAt, rate: { remaining, limit, resetSeconds } }
 *
 * GET    /vault/api/uploads
 *   Auth:    API key (Bearer clex_…) or Firebase ID token
 *   Returns: list of the caller's non-expired uploads
 *
 * GET    /vault/api/uploads/:shareToken
 *   No auth required. Returns a signed Supabase download URL valid 1h.
 *
 * DELETE /vault/api/uploads/:id
 *   Auth: API key (Bearer clex_…) or Firebase ID token.
 *   Soft-revokes + deletes from Supabase.
 *
 * Files are billed against `api_keys.total_bytes` so users can see how much
 * they've shipped through each key on the management page.
 */

import { putObject, getObject, deleteObjects, downloadUrlFor, isConfigured } from './storage'
import {
  checkAndConsumeRate,
  findKeyByPlaintext,
  recordKeyUsage,
  apiKeysModule,
} from './apiKeys'
import type { Env } from './index'
import { requireOwner } from './auth'

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
  // Resolve identity. Two accepted callers:
  //   1. a programmatic client presenting an API key  (Authorization: Bearer clex_…)
  //   2. a signed-in browser presenting a Firebase ID token (Authorization: Bearer <jwt>)
  //
  // The browser path previously accepted a bare `X-Vault-UID` header, which
  // is client-controlled: anyone could upload files attributed to any user,
  // against that user's quota and into their upload list. See auth.ts.
  const authHeader = request.headers.get('Authorization') ?? ''
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''
  const isApiKey = bearer.startsWith('clex_')

  let uid = ''
  let apiKeyId: string | null = null
  let perKeyMaxBytes = -1
  let rateState: { remaining: number; limit: number; resetSeconds: number } | null = null

  if (isApiKey) {
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
  } else {
    const auth = await requireOwner(request, env)
    if (!auth.ok) {
      return errorResponse(
        `${auth.error} Programmatic callers should send an API key instead: Authorization: Bearer clex_…`,
        auth.status,
        cors,
      )
    }
    uid = auth.owner.uid
    // FILE_SIZE_LIMITS has a single element, so the old `[1]` was `undefined`.
    // `undefined < 0` is false, so the ceiling below became
    // `Math.min(undefined, …)` = NaN, and `fileBytes > NaN` is always false —
    // the size check silently never fired on this path.
    perKeyMaxBytes = apiKeysModule.UI_UPLOAD_MAX_BYTES
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

  if (!isConfigured(env)) {
    return errorResponse('Object storage is not configured on this deployment.', 503, cors)
  }

  try {
    await putObject(env, storagePath, buffer, contentType)
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

  // The worker serves the bytes itself, so the access check and the download
  // travel the same path and a revoke takes effect immediately.
  const downloadUrl = downloadUrlFor(new URL(request.url).origin, shareToken)

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

/**
 * Resolves the owner for the list/delete routes.
 *
 * Two legitimate callers, and only two:
 *   · a programmatic client holding an API key (`Authorization: Bearer clex_…`),
 *     which is a server-side secret we can verify by hash lookup;
 *   · a signed-in browser holding a Firebase ID token.
 *
 * A bare `X-Vault-UID` header is NOT accepted — it is client-controlled, so
 * it would let anyone enumerate and delete another user's uploads.
 */
async function resolveUploadOwner(
  request: Request,
  env: Env,
): Promise<{ ok: true; uid: string } | { ok: false; status: 401 | 403; error: string }> {
  const authHeader = request.headers.get('Authorization') ?? ''
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : ''

  if (bearer.startsWith('clex_')) {
    const key = await findKeyByPlaintext(env, bearer)
    if (!key) return { ok: false, status: 401, error: 'Invalid or revoked API key' }
    return { ok: true, uid: key.userId }
  }

  const auth = await requireOwner(request, env)
  if (!auth.ok) return { ok: false, status: auth.status, error: auth.error }
  return { ok: true, uid: auth.owner.uid }
}

export async function handleApiUploadList(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const auth = await resolveUploadOwner(request, env)
  if (!auth.ok) return errorResponse(auth.error, auth.status, cors)
  const uid = auth.uid

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
  const auth = await resolveUploadOwner(request, env)
  if (!auth.ok) return errorResponse(auth.error, auth.status, cors)
  const uid = auth.uid

  const row = await env.DB.prepare(
    `SELECT id, user_id, api_key_id, storage_path, share_token, filename, size_bytes, mime_type,
            upload_at, expires_at, download_count, revoked_at
     FROM api_uploads WHERE id = ? AND user_id = ?`
  ).bind(uploadId, uid).first<UploadRow>()
  if (!row) return errorResponse('Upload not found', 404, cors)

  await deleteObjects(env, [row.storage_path])
  await env.DB.batch([
    env.DB.prepare('UPDATE api_uploads SET revoked_at = unixepoch() WHERE id = ?').bind(uploadId),
    env.DB.prepare('DELETE FROM pending_deletions WHERE id = ?').bind(uploadId),
  ])
  return jsonResponse({ ok: true }, 200, cors)
}

export async function handleApiUploadShare(
  shareToken: string,
  origin: string,
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

  const downloadUrl = downloadUrlFor(origin, row.share_token)

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

/**
 * Streams the stored bytes for a share token.
 *
 * Revocation and expiry are checked here, on the request that actually serves
 * the file. The previous design handed out a one-hour signed URL from the
 * storage provider, which stayed downloadable for the rest of that hour even
 * after the owner revoked the share.
 */
export async function handleApiUploadDownload(
  shareToken: string,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, storage_path, filename, size_bytes, mime_type, expires_at, revoked_at
     FROM api_uploads WHERE share_token = ?`
  ).bind(shareToken).first<UploadRow>()

  if (!row) return errorResponse('Share not found', 404, cors)
  if (row.revoked_at) return errorResponse('Share revoked', 410, cors)
  if (Math.floor(Date.now() / 1000) > row.expires_at) {
    return errorResponse('Share expired', 410, cors)
  }
  if (!isConfigured(env)) {
    return errorResponse('Object storage is not configured on this deployment.', 503, cors)
  }

  const object = await getObject(env, row.storage_path)
  if (!object) return errorResponse('Stored file is no longer available', 404, cors)

  await env.DB.prepare(
    'UPDATE api_uploads SET download_count = download_count + 1 WHERE id = ?'
  ).bind(row.id).run().catch(() => undefined)

  // `attachment` with an RFC 5987 filename so non-ASCII names survive.
  const disposition =
    `attachment; filename="${row.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; ` +
    `filename*=UTF-8''${encodeURIComponent(row.filename)}`

  return new Response(object.body, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': row.mime_type || 'application/octet-stream',
      'Content-Length': String(row.size_bytes),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, no-store',
    },
  })
}
