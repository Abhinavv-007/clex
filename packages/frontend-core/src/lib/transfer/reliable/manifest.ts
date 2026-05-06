import {
  CHUNK_SIZE,
  MAX_CHUNK_HASH_FILE_SIZE,
  PER_CHUNK_HASH_DEFAULT,
  RELIABLE_PROTOCOL_VERSION,
  type ManifestFileEntry,
  type TransferFile,
  type TransferManifest,
} from '../types'

export interface BuildManifestOptions {
  chunkSize?: number
  perChunkHash?: boolean
  /** When true, also compute a SHA-256 root hash of the manifest body. */
  computeRootHash?: boolean
  senderClientVersion?: string
  route?: string
  transferId?: string
  /** Skip per-chunk hashing for files larger than this (default 4 GB). */
  maxHashFileSize?: number
}

const HEX_TABLE = (() => {
  const t: string[] = []
  for (let i = 0; i < 256; i++) t.push(i.toString(16).padStart(2, '0'))
  return t
})()

export function bufToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf)
  let out = ''
  for (let i = 0; i < view.length; i++) out += HEX_TABLE[view[i]]
  return out
}

export async function digestSha256(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return bufToHex(hash)
}

export function computeChunkCount(fileSize: number, chunkSize: number): number {
  if (fileSize <= 0) return 0
  return Math.ceil(fileSize / chunkSize)
}

export function chunkRange(chunkIndex: number, chunkSize: number, fileSize: number): { start: number; end: number } {
  const start = chunkIndex * chunkSize
  const end = Math.min(start + chunkSize, fileSize)
  return { start, end }
}

async function hashBlobChunks(
  blob: Blob,
  chunkSize: number,
  totalChunks: number
): Promise<string[]> {
  const hashes: string[] = new Array(totalChunks)
  for (let i = 0; i < totalChunks; i++) {
    const { start, end } = chunkRange(i, chunkSize, blob.size)
    const slice = blob.slice(start, end)
    // arrayBuffer() on a sliced Blob does not pull the whole file into memory —
    // each iteration releases the previous slice to GC.
    const buf = await slice.arrayBuffer()
    hashes[i] = await digestSha256(buf)
  }
  return hashes
}

export async function buildManifest(
  files: TransferFile[],
  options: BuildManifestOptions = {}
): Promise<TransferManifest> {
  const chunkSize = options.chunkSize ?? CHUNK_SIZE
  const perChunkHash = options.perChunkHash ?? PER_CHUNK_HASH_DEFAULT
  const maxHashFileSize = options.maxHashFileSize ?? MAX_CHUNK_HASH_FILE_SIZE
  const transferId = options.transferId ?? generateTransferId()

  const entries: ManifestFileEntry[] = []
  let totalSize = 0
  let totalChunks = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileChunks = computeChunkCount(file.size, chunkSize)
    let chunkHashes: string[] | undefined

    if (perChunkHash && file.size > 0 && file.size <= maxHashFileSize) {
      try {
        chunkHashes = await hashBlobChunks(file.blob, chunkSize, fileChunks)
      } catch {
        // Hashing is best-effort. If the slice fails (rare; e.g. file handle
        // revoked), we proceed without per-chunk hashes — receiver still
        // verifies size and final completeness.
        chunkHashes = undefined
      }
    }

    entries.push({
      fileId: file.id,
      fileIndex: i,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      totalChunks: fileChunks,
      chunkHashes,
    })

    totalSize += file.size
    totalChunks += fileChunks
  }

  const manifest: TransferManifest = {
    version: RELIABLE_PROTOCOL_VERSION,
    transferId,
    createdAt: Date.now(),
    chunkSize,
    totalSize,
    totalChunks,
    perChunkHash,
    senderClientVersion: options.senderClientVersion,
    route: options.route,
    files: entries,
  }

  if (options.computeRootHash) {
    manifest.rootHash = await digestSha256(
      new TextEncoder().encode(JSON.stringify(manifest.files)).buffer
    )
  }

  return manifest
}

export function generateTransferId(): string {
  // crypto.randomUUID is available in modern browsers and Node 19+; we keep a
  // small fallback for the very rare runtime that lacks it. Both transferIds
  // only need to be unique within a single signaling room — they are not
  // load-bearing for security.
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export function manifestToHumanLabel(manifest: TransferManifest): string {
  const fileCount = manifest.files.length
  const sizeMb = manifest.totalSize / (1024 * 1024)
  return `${fileCount} file${fileCount === 1 ? '' : 's'} · ${sizeMb.toFixed(1)} MB · ${manifest.totalChunks} chunks`
}
