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

// Keep each DataChannel binary message well below the practical per-message
// limits seen across Chromium, Firefox, Safari, and embedded Chromium shells.
// The reliable frame adds a 16-byte header on top of this payload, so using a
// full 256 KB payload can cross browser limits and surface as a generic
// `Data channel error` during real transfers.
export const CHUNK_SIZE = 64 * 1024
export const DC_LABEL = 'clex-transfer'

// Backpressure window.
//
// This is expressed in BYTES, not in a chunk count. A chunk count has to be
// re-tuned every time CHUNK_SIZE moves — the previous 32-chunk window capped
// progress around 2 MB and made the sender look stuck, and the 128 that
// replaced it only meant "8 MB" for as long as chunks stayed 64 KB. Bytes say
// what is actually meant and stay correct at any chunk size.
// These were 8 MB / 1 MB, which meant no backpressure at all for any file
// smaller than 8 MB: the send loop wrote the entire file into the DataChannel
// in one burst. Measured on loopback, a 5 MB burst wedges the SCTP
// association — bufferedAmount freezes around 2.6 MB and the receiver stops
// being handed messages. Keeping the queue near 1 MB keeps the wire busy
// without ever building a burst large enough to collapse the association.
export const BUFFERED_AMOUNT_HIGH_WATER = 512 * 1024 // 512 KB
export const BUFFERED_AMOUNT_LOW_WATER = 128 * 1024 // 128 KB
export const MAX_IN_FLIGHT_BYTES = 8 * 1024 * 1024 // 8 MB

// Derived hard ceiling, so a pathologically small chunk size can't produce an
// unbounded number of outstanding ACKs to track.
export const MAX_IN_FLIGHT_CHUNKS = Math.ceil(MAX_IN_FLIGHT_BYTES / CHUNK_SIZE)

// How many chunks the sender reads ahead from disk while earlier chunks are
// still on the wire. Without this the send loop awaits `blob.arrayBuffer()`
// for every chunk in turn, so throughput is bounded by per-chunk file-read
// latency rather than by the link.
export const SEND_READAHEAD_CHUNKS = 8

// UI store writes are coalesced to this interval — without it, a 50 MB
// transfer fires hundreds of Svelte updates per second and re-renders the
// whole transfer card and health panel on every chunk.
export const UI_UPDATE_INTERVAL_MS = 150

// ─── Reliable transfer protocol (Clex Direct+) ─────────────────────────────
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
// 250 ms of unconditional control messages in the reverse direction is enough
// to stop a congested association from ever recovering: reproduced with raw
// WebRTC (no Clex code), 5 MB stalls forever at 250 ms, completes at 1000 ms.
// The sender already derives progress from its own chunk ACKs, so this is
// redundant telemetry and is now also suppressed when nothing has changed.
export const RECEIVER_PROGRESS_INTERVAL_MS = 1000

// Per-chunk hashing is optional and intentionally disabled by default for live
// transfers. WebRTC DataChannel already provides ordered reliable delivery;
// keeping ACK/retry plus final size/chunk verification avoids the CPU spikes
// that made progress pause during the first few megabytes on real browsers.
export const MAX_CHUNK_HASH_FILE_SIZE = 32 * 1024 * 1024 // 32 MB
export const PER_CHUNK_HASH_DEFAULT = false

// How many chunks the receiver lets accumulate before sending one cumulative
// ACK. The DataChannel is reliable and ordered, so a single "through index N"
// covers everything before it; the batch simply keeps the reverse direction
// quiet. Flushed early on the last chunk of a file and by ACK_FLUSH_MS, so the
// tail of a transfer is never left waiting.
export const ACK_BATCH_CHUNKS = 16
export const ACK_FLUSH_MS = 120

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
  /**
   * Peer understands `chunk_ack_upto`, a cumulative acknowledgement covering
   * every chunk of a file through one index.
   *
   * One JSON ACK per chunk puts thousands of small messages into the reverse
   * direction of a busy association. Measured with raw WebRTC on loopback,
   * 5 MB takes 3s with no ACKs, 6s with a per-chunk ACK, and 3s again when
   * ACKs are batched every 16 chunks — the per-chunk chatter, not the
   * bandwidth, was the cost.
   */
  supportsCumulativeAck: boolean
}

export const DEFAULT_RELIABLE_CAPS: ReliableCapabilities = {
  reliable: true,
  version: RELIABLE_PROTOCOL_VERSION,
  supportsChunkAck: true,
  supportsResume: true,
  supportsChunkHash: false,
  supportsTransferReceipt: true,
  supportsTransferQueue: true,
  supportsCumulativeAck: true,
}

// ─── Manifest ─────────────────────────────────────────────────────────────

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

// ─── Receipt ──────────────────────────────────────────────────────────────

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

// ─── Health ───────────────────────────────────────────────────────────────

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

// ─── Queue ────────────────────────────────────────────────────────────────

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

// ─── DataChannel control messages (additive union) ─────────────────────────
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
      /** Acks every chunk of `fileIndex` from 0 through `throughChunkIndex`. */
      type: 'chunk_ack_upto'
      transferId: string
      fileIndex: number
      throughChunkIndex: number
    }
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

// ─── Reliable chunk binary frame ───────────────────────────────────────────
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

// ─── RTC config (unchanged) ────────────────────────────────────────────────

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
