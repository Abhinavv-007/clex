/**
 * Browser-side API-key client.
 *
 * Talks to the vault-worker endpoints we added in apps/vault-worker.
 * All calls assume the caller is signed in via Firebase Google and has
 * a `uid` available (pulled from `onVaultAuthChanged`).
 */

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

export interface CreateApiKeyRequest {
  name: string
  email?: string
  /** -1 means unlimited (clamped server-side to 5GB). */
  maxFileBytes?: number
  /** -1 means unlimited. */
  ratePerMinute?: number
}

export interface CreateApiKeyResponse {
  key: ApiKeyRecord
  /** Plaintext key — only returned once. */
  plaintext: string
}

export interface ApiKeyListResponse {
  keys: ApiKeyRecord[]
  limits: {
    fileSize: readonly number[]
    ratePerMinute: readonly number[]
  }
}

export interface ApiUploadRecord {
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
}

interface RequestOptions {
  baseUrl?: string
  uid: string
  token?: string | null
  signal?: AbortSignal
}

const DEFAULT_BASE = '/vault/api'

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions,
  body?: unknown,
): Promise<T> {
  const base = options.baseUrl ?? DEFAULT_BASE
  const headers: Record<string, string> = {
    'X-Vault-UID': options.uid,
  }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let payload: BodyInit | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(joinUrl(base, path), {
    method,
    headers,
    body: payload,
    signal: options.signal,
  })

  if (!res.ok) {
    let detail = ''
    try {
      const data = (await res.json()) as { error?: string }
      detail = data?.error ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }

  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export function listApiKeys(options: RequestOptions): Promise<ApiKeyListResponse> {
  return request<ApiKeyListResponse>('GET', '/keys', options)
}

export function createApiKey(
  body: CreateApiKeyRequest,
  options: RequestOptions,
): Promise<CreateApiKeyResponse> {
  return request<CreateApiKeyResponse>('POST', '/keys', options, body)
}

export function updateApiKey(
  keyId: string,
  body: Partial<CreateApiKeyRequest>,
  options: RequestOptions,
): Promise<{ key: ApiKeyRecord }> {
  return request('PATCH', `/keys/${encodeURIComponent(keyId)}`, options, body)
}

export function revokeApiKey(
  keyId: string,
  options: RequestOptions,
): Promise<{ ok: true }> {
  return request('DELETE', `/keys/${encodeURIComponent(keyId)}`, options)
}

export function getApiKeyUsage(
  keyId: string,
  options: RequestOptions,
): Promise<{ key: ApiKeyRecord; rate: { remaining: number; limit: number; resetSeconds: number } }> {
  return request('GET', `/keys/${encodeURIComponent(keyId)}/usage`, options)
}

export function listApiUploads(options: RequestOptions): Promise<{ uploads: ApiUploadRecord[] }> {
  return request('GET', '/uploads', options)
}

export function deleteApiUpload(
  uploadId: string,
  options: RequestOptions,
): Promise<{ ok: true }> {
  return request('DELETE', `/uploads/${encodeURIComponent(uploadId)}`, options)
}

// ── Display helpers ──────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 0) return 'unlimited'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export function formatRate(rpm: number): string {
  if (rpm < 0) return 'unlimited'
  return `${rpm}/min`
}

export const FILE_SIZE_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Unlimited', value: -1 },
]

export const RATE_PRESETS: Array<{ label: string; value: number }> = [
  { label: 'Unlimited', value: -1 },
]
