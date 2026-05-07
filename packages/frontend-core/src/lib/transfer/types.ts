import { normalizeStunServerUrls } from './network'

export interface TransferFile {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}

export type TransferProfile = 'webrtc' | 'local'
export type ConnectionKind = 'lan' | 'internet' | 'unknown'

export interface IceCandidatePayload {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

// 256 KB — within the safe per-message DataChannel limit on every modern
// browser. Larger frames mean fewer trips through the JS event loop, fewer
// store updates, and fewer ACK round-trips per MB.
export const CHUNK_SIZE = 256 * 1024
export const DC_LABEL = 'clex-transfer'

// Backpressure window. We let bufferedAmount climb to HIGH before pausing the
// send loop, then resume once it drains below LOW (via bufferedamountlow).
// Sized so a healthy LAN can hold ~32 chunks in flight, which is plenty to
// keep the wire busy while still bounding peak memory at a few MB.
export const BUFFERED_AMOUNT_HIGH_WATER = 8 * 1024 * 1024 // 8 MB
export const BUFFERED_AMOUNT_LOW_WATER = 2 * 1024 * 1024 // 2 MB
export const MAX_IN_FLIGHT_CHUNKS = 32

// UI store writes are coalesced to this interval — without it, a 50 MB
// transfer fires hundreds of Svelte updates per second and re-renders the
// whole transfer card on every chunk.
export const UI_UPDATE_INTERVAL_MS = 150

// ─── Reliable transfer protocol (Clex Direct+) ───────────────────────────────
//
// Capability negotiation lets new peers opt in to ACK/retry/hash/resume while
// old peers (which never send `capability`) silently fall back to the legacy
// per-file streaming path. Both sides exchange `capability` once the data
// channel opens; if the grace window elapses with no peer capabilities, the
// transfer downgrades to legacy mode.

export const RELIABLE_PROTOCOL_VERSION = 1
// Both sides announce capabilities the moment the data channel opens, so on a
// healthy WAN connection the round-trip completes well under 200 ms. We use
// 280 ms here to absorb mobile RTTs without leaving sub-second files idling.
export const CAPABILITY_GRACE_MS = 280
export const RECEIVER_PROGRESS_INTERVAL_MS = 250

// Per-chunk hashing is skipped for files larger than this so the manifest
// build doesn't block the UI on large transfers (each chunk costs one
// crypto.subtle.digest call). At 256 KB chunks, 256 MB ≈ 1024 chunks — under a
// second on a modern laptop. Bigger files fall back to the receiver's size +
// chunk-count check, which is still strong (size mismatches fail fast).
export const MAX_CHUNK_HASH_FILE_SIZE = 256 * 1024 * 1024 // 256 MB
export const PER_CHUNK_HASH_DEFAULT = true

export const RETRY_MAX_ATTEMPTS = 4
export const RETRY_INITIAL_DELAY_MS = 600
export const RETRY_BACKOFF_FACTOR = 1.7
export const ACK_TIMEOUT_MS = 8000
export const RETRY_BACKOFF_MS = RETRY_INITIAL_DELAY_MS

export interface ReliableCapabilities {
  reliable: true
  version: number
  supportsChunkAck: boolean
  supportsResume: boolean
  supportsChunkHash: boolean
  supportsTransferReceipt: boolean
  supportsTransferQueue: boolean
}

export const DEFAULT_RELIABLE_CAPS: ReliableCapabilities = {
  reliable: true,
  version: RELIABLE_PROTOCOL_VERSION,
  supportsChunkAck: true,
  supportsResume: true,
  supportsChunkHash: true,
  supportsTransferReceipt: true,
  supportsTransferQueue: true,
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export interface ManifestFileEntry {
  fileId: string
  fileIndex: number
  name: string
  mimeType: string
  size: number
  totalChunks: number
  /** Optional per-chunk SHA-256 hex hashes; omitted if hashing was skipped. */
  chunkHashes?: string[]
  /** Optional whole-file SHA-256 hex hash; omitted for huge files. */
  fileHash?: string
}

export interface TransferManifest {
  version: number
  transferId: string
  createdAt: number
  chunkSize: number
  totalSize: number
  totalChunks: number
  perChunkHash: boolean
  /** SHA-256 hex root hash over the manifest entries — feasibility-bounded. */
  rootHash?: string
  senderClientVersion?: string
  route?: string
  files: ManifestFileEntry[]
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface TransferReceipt {
  transferId: string
  totalSize: number
  totalChunks: number
  chunkSize: number
  fileCount: number
  verified: boolean
  startedAt: number
  completedAt: number
  durationMs: number
  route: string
  retryCount: number
  failedChunkCount: number
  rootHash?: string
  healthScore: number
  /** receipt revision — bump if shape changes. */
  rev: number
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface TransferHealth {
  /** 0–100 composite score. */
  score: number
  /** Bucketed label used by UI text/colour. */
  label: 'stable' | 'recovering' | 'unstable' | 'reconnecting' | 'verified' | 'failed' | 'idle'
  retries: number
  failedChunks: number
  verifiedChunks: number
  ackedChunks: number
  totalChunks: number
  bufferedAmount: number
  bufferedHigh: boolean
  averageSpeedBps: number
  connectionStable: boolean
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export type QueueEntryStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface QueueEntry {
  id: string
  transferId: string | null
  direction: 'send' | 'receive'
  fileNames: string[]
  totalSize: number
  totalChunks: number
  route: 'webrtc' | 'local' | 'drive' | 'unknown'
  status: QueueEntryStatus
  createdAt: number
  updatedAt: number
  error?: string
  receipt?: TransferReceipt
  resumable: boolean
}

// ─── DataChannel control messages (additive union) ───────────────────────────
//
// Every legacy variant from v0 still appears here unchanged so old peers stay
// compatible. The new reliable protocol adds:
//   - capability, manifest, manifest_ack, chunk_ack, chunk_nack, retry_request,
//     receiver_progress, pause, resume, verify_success, verify_failed, cancel,
//     error
//
// A control message arriving with an unknown `type` is silently ignored by both
// parsers, which is what makes the union safe to extend.

export type DCControlMessage =
  // ── Legacy v0 ────────────────────────────────────────────────────────────
  | { type: 'receiver-chain'; chainId: string }
  | { type: 'file-start'; fileId: string; name: string; mimeType: string; totalChunks: number; totalSize: number }
  | { type: 'file-end'; fileId: string }
  | { type: 'transfer-complete' }
  // ── Reliable v1 (Clex Direct+) ───────────────────────────────────────────
  | { type: 'capability'; caps: ReliableCapabilities }
  | { type: 'manifest'; manifest: TransferManifest }
  | { type: 'manifest_ack'; transferId: string; ok: boolean; error?: string }
  | { type: 'chunk_ack'; transferId: string; fileIndex: number; chunkIndex: number }
  | {
      type: 'chunk_nack'
      transferId: string
      fileIndex: number
      chunkIndex: number
      reason: 'hash_mismatch' | 'size_mismatch' | 'parse_error' | 'unknown'
    }
  | {
      type: 'retry_request'
      transferId: string
      chunks: Array<{ fileIndex: number; chunkIndex: number }>
    }
  | {
      type: 'receiver_progress'
      transferId: string
      receivedChunks: number
      verifiedChunks: number
      bytesReceived: number
      lastChunkIndex: number
      lastFileIndex: number
    }
  | { type: 'pause'; transferId: string; by: 'sender' | 'receiver' }
  | { type: 'resume'; transferId: string; by: 'sender' | 'receiver' }
  | { type: 'verify_success'; transferId: string; rootHash?: string }
  | { type: 'verify_failed'; transferId: string; reason: string; missing?: number[] }
  | { type: 'cancel'; transferId: string; reason?: string }
  | { type: 'error'; transferId?: string; code: string; message?: string }

// ─── Reliable chunk binary frame ─────────────────────────────────────────────
//
// One DataChannel binary message per chunk in reliable mode. The 16-byte
// header lets the receiver demultiplex by file and detect retransmissions
// without a second JSON envelope per chunk.
//
//   bytes  0..3   u32 LE  fileIndex
//   bytes  4..7   u32 LE  chunkIndex
//   bytes  8..11  u32 LE  chunkLength
//   bytes 12..15  u32 LE  flags (bit0: retransmit, bit1: last_chunk_of_file)

export const RELIABLE_CHUNK_HEADER_BYTES = 16
export const RELIABLE_CHUNK_FLAG_RETRANSMIT = 1 << 0
export const RELIABLE_CHUNK_FLAG_LAST = 1 << 1

export interface ReliableChunkFrame {
  fileIndex: number
  chunkIndex: number
  chunkLength: number
  flags: number
  payload: ArrayBuffer
}

// ─── RTC config (unchanged) ──────────────────────────────────────────────────

export interface RTCConfig {
  iceServers: RTCIceServer[]
}

export function getRTCConfig(profile: TransferProfile = 'webrtc'): RTCConfig {
  if (profile === 'local') {
    return { iceServers: [] }
  }

  const raw =
    typeof window !== 'undefined'
      ? (import.meta.env.PUBLIC_STUN_SERVERS as string | undefined)
      : undefined
  const iceServers = normalizeStunServerUrls(raw).map(url => ({ urls: url }))
  return { iceServers }
}
