/**
 * Thin client over the Clex upload API.
 *
 * Every call that needs an identity sends `Authorization: Bearer <api key>`.
 * The worker looks the key up by SHA-256 hash, so the key never appears in a
 * URL, a query string or a log line.
 */

export class ClexApiError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message)
    this.name = 'ClexApiError'
    this.status = status
  }
}

/** Turns a non-2xx response into a message worth printing to a human. */
async function toError(res) {
  let detail = ''
  try {
    const body = await res.json()
    detail = typeof body?.error === 'string' ? body.error : ''
  } catch {
    detail = (await res.text().catch(() => '')).slice(0, 300)
  }

  if (res.status === 401) {
    return new ClexApiError(
      detail || 'Unauthorized — the API key is missing, invalid or revoked. Run `clex login`.',
      401,
    )
  }
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After')
    return new ClexApiError(
      `${detail || 'Rate limited.'}${retry ? ` Retry in ${retry}s.` : ''}`,
      429,
    )
  }
  if (res.status === 413) {
    return new ClexApiError(detail || 'File is larger than this key allows.', 413)
  }
  return new ClexApiError(detail || `Request failed (HTTP ${res.status})`, res.status)
}

/**
 * @param {object} opts
 * @param {string} opts.apiBase
 * @param {string} [opts.apiKey]
 * @param {string} opts.path
 * @param {string} [opts.method]
 * @param {BodyInit} [opts.body]
 * @param {Record<string,string>} [opts.headers]
 */
export async function apiFetch({ apiBase, apiKey, path, method = 'GET', body, headers = {} }) {
  const url = `${apiBase}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...headers,
    },
    body,
    // Node streams a Buffer body fine; duplex is only needed for streams.
  }).catch((err) => {
    throw new ClexApiError(
      `Could not reach ${new URL(url).origin} — ${err?.message || 'network error'}`,
      0,
    )
  })

  if (!res.ok) throw await toError(res)
  if (res.status === 204) return null
  return res.json()
}

/**
 * Uploads raw bytes. `X-Filename` is URL-encoded because header values are
 * latin-1 and filenames are not.
 *
 * @returns {Promise<{id:string, shareToken:string, downloadUrl?:string, filename:string,
 *   sizeBytes:number, mimeType:string, expiresAt:number,
 *   rate?:{remaining:number,limit:number,resetSeconds:number}}>}
 */
export function uploadFile({ apiBase, apiKey, filename, bytes, mimeType, expiresIn }) {
  return apiFetch({
    apiBase,
    apiKey,
    path: '/uploads',
    method: 'POST',
    body: bytes,
    headers: {
      'X-Filename': encodeURIComponent(filename),
      'Content-Type': mimeType || 'application/octet-stream',
      ...(expiresIn ? { 'X-Expires-In': String(expiresIn) } : {}),
    },
  })
}

export function listUploads({ apiBase, apiKey }) {
  return apiFetch({ apiBase, apiKey, path: '/uploads' })
}

export function deleteUpload({ apiBase, apiKey, id }) {
  return apiFetch({
    apiBase,
    apiKey,
    path: `/uploads/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
}

/** Resolving a share token needs no credentials — the token is the capability. */
export function resolveShare({ apiBase, token }) {
  return apiFetch({ apiBase, path: `/uploads/${encodeURIComponent(token)}` })
}
