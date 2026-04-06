/**
 * Clex Vault Worker
 *
 * Routes:
 *   POST   /vault/api/secret          — create view-once secret
 *   GET    /vault/api/secret/:id      — fetch encrypted payload (marks as opened)
 *   GET    /vault/api/secret/:id/status — sender status poll (opened timestamp)
 *   POST   /vault/api/files           — get signed upload URL
 *   GET    /vault/api/files/:key      — download encrypted file
 *   DELETE /vault/api/files/:key      — delete file
 *   GET    /vault/api/files           — list user's files
 *   POST   /vault/api/pairing/offer   — device A stores pairing offer with 8-digit code
 *   GET    /vault/api/pairing/:code   — device B fetches offer by code
 *   DELETE /vault/api/pairing/:code   — delete code after use
 *   GET    /vault/api/health          — health check
 */

export interface Env {
  VAULT_SECRETS: KVNamespace
  VAULT_TOKENS: KVNamespace
  VAULT_SIGNALS: KVNamespace
  VAULT_FILES: R2Bucket
  DB: D1Database
  ALLOWED_ORIGIN: string
  MAX_SECRET_SIZE: string
  MAX_FILE_SIZE: string
  STORAGE_QUOTA_BYTES: string
}

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Vault-UID',
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomId(len = 24): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function random8Digit(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000
  return n.toString().padStart(8, '0')
}

// ── Secret Share ──────────────────────────────────────────────────────────────

interface SecretRecord {
  encryptedPayload: string   // base64 AES-GCM ciphertext (server is zero-knowledge)
  iv: string                  // base64 IV
  title?: string              // optional encrypted title (server zero-knowledge)
  createdAt: number
  expiresAt: number
  alreadyOpened: boolean
  openedAt?: number
}

async function handleSecretCreate(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  let body: { encryptedPayload?: string; iv?: string; title?: string; ttlSeconds?: number }
  try { body = await req.json() } catch { return err('Invalid JSON', 400, cors) }

  const { encryptedPayload, iv, title, ttlSeconds = 86400 } = body
  if (!encryptedPayload || !iv) return err('encryptedPayload and iv required', 400, cors)

  const maxSize = parseInt(env.MAX_SECRET_SIZE ?? '50000')
  if (encryptedPayload.length > maxSize * 1.4) return err('Payload too large', 413, cors)

  const validTtls = [3600, 21600, 86400, 604800]
  const ttl = validTtls.includes(ttlSeconds) ? ttlSeconds : 86400

  const id = randomId(16)
  const now = Date.now()
  const record: SecretRecord = {
    encryptedPayload,
    iv,
    ...(title ? { title } : {}),
    createdAt: now,
    expiresAt: now + ttl * 1000,
    alreadyOpened: false,
  }

  await env.VAULT_SECRETS.put(`secret:${id}`, JSON.stringify(record), { expirationTtl: ttl })

  return json({ id, expiresAt: record.expiresAt }, 201, cors)
}

async function handleSecretFetch(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_SECRETS.get(`secret:${id}`)
  if (!raw) {
    return json({ gone: true, reason: 'not_found' }, 410, cors)
  }

  const record: SecretRecord = JSON.parse(raw)

  if (record.alreadyOpened) {
    return json({ gone: true, reason: 'already_opened', openedAt: record.openedAt }, 410, cors)
  }

  if (Date.now() > record.expiresAt) {
    await env.VAULT_SECRETS.delete(`secret:${id}`)
    return json({ gone: true, reason: 'expired' }, 410, cors)
  }

  // Mark as opened atomically before returning payload
  const openedAt = Date.now()
  const updated: SecretRecord = { ...record, alreadyOpened: true, openedAt }
  const remainingTtl = Math.ceil((record.expiresAt - Date.now()) / 1000)
  await env.VAULT_SECRETS.put(
    `secret:${id}`,
    JSON.stringify(updated),
    { expirationTtl: Math.max(remainingTtl, 300) } // keep for 5 min so sender can poll status
  )

  return json({
    encryptedPayload: record.encryptedPayload,
    iv: record.iv,
    ...(record.title ? { title: record.title } : {}),
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  }, 200, cors)
}

async function handleSecretStatus(id: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_SECRETS.get(`secret:${id}`)
  if (!raw) return json({ exists: false }, 200, cors)

  const record: SecretRecord = JSON.parse(raw)
  return json({
    exists: true,
    alreadyOpened: record.alreadyOpened,
    openedAt: record.openedAt ?? null,
    expiresAt: record.expiresAt,
  }, 200, cors)
}

// ── File Upload / Download ────────────────────────────────────────────────────

interface FileTokenRecord {
  uid: string
  r2Key: string
  filename: string
  sizeBytes: number
  mimeType: string
  expiresAt: number
  downloadOnce: boolean
  downloadCount: number
}

async function handleFileUpload(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const uid = req.headers.get('X-Vault-UID')
  if (!uid) return err('X-Vault-UID header required (must be authenticated)', 401, cors)

  let meta: { filename?: string; sizeBytes?: number; mimeType?: string; ttlSeconds?: number; downloadOnce?: boolean }
  try { meta = await req.json() } catch { return err('Invalid JSON', 400, cors) }

  const { filename, sizeBytes, mimeType, ttlSeconds = 86400, downloadOnce = false } = meta
  if (!filename || !sizeBytes || !mimeType) return err('filename, sizeBytes, mimeType required', 400, cors)

  const maxFileSize = parseInt(env.MAX_FILE_SIZE ?? '20971520')
  if (sizeBytes > maxFileSize) return err('File exceeds 20MB limit', 413, cors)

  const r2Key = `vault/${uid}/${randomId(12)}/${filename}`
  const tokenId = randomId(16)
  const validTtls = [3600, 21600, 86400]
  const ttl = validTtls.includes(ttlSeconds) ? ttlSeconds : 86400
  const expiresAt = Date.now() + ttl * 1000

  const record: FileTokenRecord = { uid, r2Key, filename, sizeBytes, mimeType, expiresAt, downloadOnce, downloadCount: 0 }
  await env.VAULT_TOKENS.put(`upload:${tokenId}`, JSON.stringify(record), { expirationTtl: 300 }) // 5 min to complete upload

  // Return a token the client uses to PUT directly to our worker
  return json({ tokenId, r2Key, expiresAt }, 201, cors)
}

async function handleFileComplete(tokenId: string, req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_TOKENS.get(`upload:${tokenId}`)
  if (!raw) return err('Upload token not found or expired', 404, cors)

  const record: FileTokenRecord = JSON.parse(raw)
  const body = req.body
  if (!body) return err('No file body', 400, cors)

  await env.VAULT_FILES.put(record.r2Key, body, {
    httpMetadata: { contentType: record.mimeType },
    customMetadata: {
      uid: record.uid,
      filename: record.filename,
      expiresAt: record.expiresAt.toString(),
    },
  })

  // Move token to download token
  const dlRecord: FileTokenRecord = { ...record, downloadCount: 0 }
  const ttlRemaining = Math.ceil((record.expiresAt - Date.now()) / 1000)
  await env.VAULT_TOKENS.put(`file:${record.r2Key}`, JSON.stringify(dlRecord), { expirationTtl: ttlRemaining })
  await env.VAULT_TOKENS.delete(`upload:${tokenId}`)

  // Update storage accounting in D1
  await env.DB.prepare(`
    INSERT INTO vault_files (id, uid, r2_key, filename, size_bytes, mime_type, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).bind(randomId(8), record.uid, record.r2Key, record.filename, record.sizeBytes, record.mimeType, Math.floor(record.expiresAt / 1000)).run()

  return json({ ok: true, r2Key: record.r2Key, expiresAt: record.expiresAt }, 200, cors)
}

async function handleFileDownload(r2Key: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_TOKENS.get(`file:${r2Key}`)
  if (!raw) return err('File not found or expired', 404, cors)

  const record: FileTokenRecord = JSON.parse(raw)
  if (Date.now() > record.expiresAt) {
    await env.VAULT_FILES.delete(record.r2Key)
    await env.VAULT_TOKENS.delete(`file:${r2Key}`)
    return err('File expired', 410, cors)
  }

  if (record.downloadOnce && record.downloadCount > 0) {
    return err('File already downloaded', 410, cors)
  }

  const obj = await env.VAULT_FILES.get(record.r2Key)
  if (!obj) return err('File not found in storage', 404, cors)

  // Increment download count
  const updated: FileTokenRecord = { ...record, downloadCount: record.downloadCount + 1 }
  const ttlRemaining = Math.ceil((record.expiresAt - Date.now()) / 1000)
  await env.VAULT_TOKENS.put(`file:${r2Key}`, JSON.stringify(updated), { expirationTtl: ttlRemaining })

  // If download-once, delete after serving
  if (record.downloadOnce) {
    await env.VAULT_FILES.delete(record.r2Key)
    await env.VAULT_TOKENS.delete(`file:${r2Key}`)
  }

  const headers = new Headers(cors)
  headers.set('Content-Type', record.mimeType)
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(record.filename)}"`)
  headers.set('Content-Length', record.sizeBytes.toString())

  return new Response(obj.body, { headers })
}

async function handleFileDelete(r2Key: string, uid: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const raw = await env.VAULT_TOKENS.get(`file:${r2Key}`)
  if (raw) {
    const record: FileTokenRecord = JSON.parse(raw)
    if (record.uid !== uid) return err('Forbidden', 403, cors)
    await env.VAULT_FILES.delete(record.r2Key)
    await env.VAULT_TOKENS.delete(`file:${r2Key}`)
    await env.DB.prepare('DELETE FROM vault_files WHERE r2_key = ? AND uid = ?').bind(r2Key, uid).run()
  }
  return json({ ok: true }, 200, cors)
}

async function handleFileList(uid: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const result = await env.DB.prepare(`
    SELECT id, r2_key, filename, size_bytes, mime_type, expires_at
    FROM vault_files WHERE uid = ? ORDER BY expires_at DESC
  `).bind(uid).all()

  const now = Math.floor(Date.now() / 1000)
  const files = (result.results ?? [])
    .filter((f: Record<string, unknown>) => (f.expires_at as number) > now)
    .map((f: Record<string, unknown>) => ({
      id: f.id,
      r2Key: f.r2_key,
      filename: f.filename,
      sizeBytes: f.size_bytes,
      mimeType: f.mime_type,
      expiresAt: (f.expires_at as number) * 1000,
    }))

  return json({ files }, 200, cors)
}

// ── Device Pairing Signals ────────────────────────────────────────────────────

interface PairingOffer {
  code: string
  offer: string       // JSON-encoded WebRTC SDP offer + ICE candidates
  deviceInfo: string  // JSON-encoded device name/fingerprint
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
    expiresAt: now + 300_000, // 5 minutes
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

// ── Main Fetch Handler ────────────────────────────────────────────────────────

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

    // ── Files ─────────────────────────────────────────────────────────────────
    if (path === '/vault/api/files' && method === 'POST') {
      return handleFileUpload(request, env, cors)
    }

    if (path === '/vault/api/files' && method === 'GET') {
      const uid = request.headers.get('X-Vault-UID')
      if (!uid) return err('X-Vault-UID required', 401, cors)
      return handleFileList(uid, env, cors)
    }

    const uploadCompleteMatch = path.match(/^\/vault\/api\/files\/upload\/([a-f0-9]+)$/)
    if (uploadCompleteMatch && method === 'PUT') {
      return handleFileComplete(uploadCompleteMatch[1], request, env, cors)
    }

    const fileKeyMatch = path.match(/^\/vault\/api\/files\/(.+)$/)
    if (fileKeyMatch) {
      const r2Key = decodeURIComponent(fileKeyMatch[1])
      if (method === 'GET') return handleFileDownload(r2Key, env, cors)
      if (method === 'DELETE') {
        const uid = request.headers.get('X-Vault-UID')
        if (!uid) return err('X-Vault-UID required', 401, cors)
        return handleFileDelete(r2Key, uid, env, cors)
      }
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
}
