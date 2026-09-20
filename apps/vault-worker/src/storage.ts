/**
 * Object storage for vault + API uploads.
 *
 * This used to call Supabase Storage over HTTP from the worker. That backend
 * stopped resolving entirely — every upload failed with a Cloudflare 1016
 * (origin DNS error) wrapped in a 502, so `POST /vault/api/uploads` had been
 * dead while key minting, listing and revocation all still worked. Depending
 * on a second provider's DNS for the one operation that has to succeed was the
 * weak point, so the bytes now live in R2, in the same account as the Worker,
 * D1 and KV.
 *
 * Two consequences worth knowing:
 *
 *   · There are no signed URLs. R2 is reached through the binding, so a
 *     download is served by this worker, which means the access check and the
 *     bytes travel the same path and a share can be revoked instantly rather
 *     than staying live until a signed URL expires.
 *
 *   · `isConfigured()` lets every caller degrade to a clear 503 instead of
 *     throwing, so a deploy without the binding reports the truth rather than
 *     surfacing an opaque runtime error.
 */

export interface StorageEnv {
  /** R2 bucket binding. Optional so the worker still boots without it. */
  FILES?: R2Bucket
}

/** True when an R2 bucket is bound and usable. */
export function isConfigured(env: StorageEnv): boolean {
  return Boolean(env.FILES)
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured on this deployment.')
    this.name = 'StorageNotConfiguredError'
  }
}

function bucket(env: StorageEnv): R2Bucket {
  if (!env.FILES) throw new StorageNotConfiguredError()
  return env.FILES
}

/**
 * Writes an object. Refuses to overwrite, matching the `x-upsert: false` the
 * Supabase path used — storage paths carry a random id, so a collision means
 * something is wrong rather than something is being replaced.
 */
export async function putObject(
  env: StorageEnv,
  storagePath: string,
  body: ArrayBuffer | Uint8Array | ReadableStream,
  contentType: string,
): Promise<void> {
  const b = bucket(env)

  const existing = await b.head(storagePath)
  if (existing) throw new Error(`Object already exists at ${storagePath}`)

  await b.put(storagePath, body as ArrayBuffer | ReadableStream, {
    httpMetadata: { contentType: contentType || 'application/octet-stream' },
  })
}

/** Reads an object, or null when it is not there. */
export async function getObject(
  env: StorageEnv,
  storagePath: string,
): Promise<R2ObjectBody | null> {
  return (await bucket(env).get(storagePath)) ?? null
}

/** Best-effort delete. Never throws: cleanup must not fail the request. */
export async function deleteObjects(env: StorageEnv, paths: string[]): Promise<void> {
  if (paths.length === 0 || !env.FILES) return
  try {
    await env.FILES.delete(paths)
  } catch {
    /* best effort, same as the previous implementation */
  }
}

/**
 * The URL a client fetches to get the bytes.
 *
 * Served by this worker rather than by the storage provider, so revocation and
 * expiry are enforced at request time. `origin` comes from the incoming
 * request so the link is correct on both clex.in and workers.dev.
 */
export function downloadUrlFor(origin: string, shareToken: string): string {
  return `${origin.replace(/\/+$/, '')}/vault/api/uploads/${shareToken}/download`
}
