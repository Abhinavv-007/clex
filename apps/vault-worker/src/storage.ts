/**
 * Object storage for vault + API uploads.
 *
 * This used to call Supabase Storage over HTTP from the worker. That backend
 * stopped resolving entirely — every upload failed with a Cloudflare 1016
 * (origin DNS error) wrapped in a 502, so `POST /vault/api/uploads` had been
 * dead while key minting, listing and revocation all still worked. The bytes
 * now live in the same Cloudflare account as the Worker, D1 and KV.
 *
 * Two backends, chosen by which binding is present:
 *
 *   · R2 (`FILES`) — preferred. Objects of any size, streamed.
 *
 *   · Workers KV (`FILE_CHUNKS`) — used while R2 is not enabled on the
 *     account. KV caps a value at 25 MiB, so a file is stored as numbered
 *     chunks plus a small manifest, each written with an expiration so the
 *     store cleans itself up even if the hourly cron misses an entry.
 *
 * Either way there are no signed URLs: a download is served by this worker,
 * so the access check and the bytes travel the same path and a share can be
 * revoked instantly. `isConfigured()` lets every caller degrade to a clear
 * 503 instead of throwing when neither binding exists.
 */

export interface StorageEnv {
  /** R2 bucket binding. Optional so the worker still boots without it. */
  FILES?: R2Bucket
  /** KV namespace used for chunked storage when R2 is unavailable. */
  FILE_CHUNKS?: KVNamespace
}

/** Just what callers read from a stored object. */
export interface StoredObject {
  body: ReadableStream
}

/** Below KV's 25 MiB value limit, with room to spare. */
export const KV_CHUNK_BYTES = 20 * 1024 * 1024
/** Kept a little past the longest share (7 days); the cron deletes sooner. */
const DEFAULT_TTL_SECONDS = 8 * 24 * 60 * 60
/** KV refuses expirations shorter than a minute. */
const MIN_TTL_SECONDS = 60

interface KvManifest {
  size: number
  chunks: number
  contentType: string
}

/** True when some object store is bound and usable. */
export function isConfigured(env: StorageEnv): boolean {
  return Boolean(env.FILES || env.FILE_CHUNKS)
}

/** Which backend is in use, for health endpoints. */
export function backendName(env: StorageEnv): 'r2' | 'kv' | 'none' {
  if (env.FILES) return 'r2'
  if (env.FILE_CHUNKS) return 'kv'
  return 'none'
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured on this deployment.')
    this.name = 'StorageNotConfiguredError'
  }
}

const manifestKey = (path: string) => `${path}#meta`
const chunkKey = (path: string, i: number) => `${path}#${i}`

/**
 * Writes an object. Refuses to overwrite, matching the `x-upsert: false` the
 * Supabase path used — storage paths carry a random id, so a collision means
 * something is wrong rather than something is being replaced.
 *
 * `ttlSeconds` is how long the bytes must live (the share's expiry); the KV
 * backend uses it as the entries' expiration, R2 relies on the cron.
 */
export async function putObject(
  env: StorageEnv,
  storagePath: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const type = contentType || 'application/octet-stream'

  if (env.FILES) {
    const existing = await env.FILES.head(storagePath)
    if (existing) throw new Error(`Object already exists at ${storagePath}`)
    await env.FILES.put(storagePath, body, { httpMetadata: { contentType: type } })
    return
  }

  const kv = env.FILE_CHUNKS
  if (!kv) throw new StorageNotConfiguredError()

  if (await kv.get(manifestKey(storagePath))) {
    throw new Error(`Object already exists at ${storagePath}`)
  }

  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body)
  const chunks = Math.max(1, Math.ceil(bytes.byteLength / KV_CHUNK_BYTES))
  // An hour of slack past the share's own expiry, so a download that starts
  // right at the end of its window still finds every chunk.
  const expirationTtl = Math.max(MIN_TTL_SECONDS, Math.ceil(ttlSeconds) + 3600)

  for (let i = 0; i < chunks; i += 1) {
    const start = i * KV_CHUNK_BYTES
    const slice = bytes.subarray(start, Math.min(bytes.byteLength, start + KV_CHUNK_BYTES))
    await kv.put(chunkKey(storagePath, i), slice, { expirationTtl })
  }

  // The manifest goes last: an object is only visible once all of it exists.
  const manifest: KvManifest = { size: bytes.byteLength, chunks, contentType: type }
  await kv.put(manifestKey(storagePath), JSON.stringify(manifest), { expirationTtl })
}

/** Reads an object, or null when it is not there. */
export async function getObject(
  env: StorageEnv,
  storagePath: string,
): Promise<StoredObject | null> {
  if (env.FILES) {
    const object = await env.FILES.get(storagePath)
    return object ? { body: object.body } : null
  }

  const kv = env.FILE_CHUNKS
  if (!kv) throw new StorageNotConfiguredError()

  const manifest = await kv.get<KvManifest>(manifestKey(storagePath), 'json')
  if (!manifest) return null

  // Stream the chunks in order, fetching each only when the client is ready
  // for it, so a large file never sits in the worker's memory all at once.
  let next = 0
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (next >= manifest.chunks) {
        controller.close()
        return
      }
      const chunk = await kv.get(chunkKey(storagePath, next), 'arrayBuffer')
      next += 1
      if (!chunk) {
        controller.error(new Error('Stored file is incomplete'))
        return
      }
      controller.enqueue(new Uint8Array(chunk))
    },
  })
  return { body }
}

/** Best-effort delete. Never throws: cleanup must not fail the request. */
export async function deleteObjects(env: StorageEnv, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    if (env.FILES) {
      await env.FILES.delete(paths)
      return
    }
    const kv = env.FILE_CHUNKS
    if (!kv) return
    await Promise.all(paths.map(async (path) => {
      const manifest = await kv.get<KvManifest>(manifestKey(path), 'json').catch(() => null)
      const count = manifest?.chunks ?? 1
      await kv.delete(manifestKey(path))
      await Promise.all(Array.from({ length: count }, (_, i) => kv.delete(chunkKey(path, i))))
    }))
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
