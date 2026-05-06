import {
  RETRY_BACKOFF_FACTOR,
  RETRY_INITIAL_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  type ManifestFileEntry,
  type TransferManifest,
} from '../types'

export type ChunkStatus = 'pending' | 'in_flight' | 'acked' | 'verified' | 'failed'

export interface ChunkRecord {
  fileIndex: number
  chunkIndex: number
  size: number
  status: ChunkStatus
  attempts: number
  lastSentAt: number | null
  nextEligibleAt: number
  /** Optional per-chunk SHA-256 hex hash, copied from the manifest. */
  expectedHash?: string
}

export interface ChunkTrackerSnapshot {
  totalChunks: number
  pending: number
  inFlight: number
  acked: number
  verified: number
  failed: number
  retries: number
  failedChunks: number
  bytesAcked: number
  bytesTotal: number
}

export interface ChunkTrackerOptions {
  maxAttempts?: number
  initialDelayMs?: number
  backoffFactor?: number
}

const ackKey = (fileIndex: number, chunkIndex: number): string => `${fileIndex}/${chunkIndex}`

/**
 * Tracks the lifecycle of every chunk in a reliable transfer:
 *   pending → in_flight → acked/verified
 *               ↘ failed (retry budget exhausted)
 *
 * The tracker is shared between the sender (drives retransmits) and the
 * receiver (drives verification + progress).
 */
export class ChunkTracker {
  private readonly chunks = new Map<string, ChunkRecord>()
  private readonly orderedKeys: string[] = []
  private readonly maxAttempts: number
  private readonly initialDelayMs: number
  private readonly backoffFactor: number
  private totalBytes = 0
  private totalRetries = 0

  constructor(manifest: TransferManifest, options: ChunkTrackerOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? RETRY_MAX_ATTEMPTS
    this.initialDelayMs = options.initialDelayMs ?? RETRY_INITIAL_DELAY_MS
    this.backoffFactor = options.backoffFactor ?? RETRY_BACKOFF_FACTOR

    for (const file of manifest.files) {
      this.seedFile(file, manifest.chunkSize)
    }
  }

  private seedFile(file: ManifestFileEntry, chunkSize: number): void {
    for (let i = 0; i < file.totalChunks; i++) {
      const key = ackKey(file.fileIndex, i)
      const isLast = i === file.totalChunks - 1
      const size = isLast ? file.size - i * chunkSize : chunkSize
      const record: ChunkRecord = {
        fileIndex: file.fileIndex,
        chunkIndex: i,
        size: Math.max(0, size),
        status: 'pending',
        attempts: 0,
        lastSentAt: null,
        nextEligibleAt: 0,
        expectedHash: file.chunkHashes?.[i],
      }
      this.chunks.set(key, record)
      this.orderedKeys.push(key)
      this.totalBytes += record.size
    }
  }

  // ── Sender helpers ──────────────────────────────────────────────────────

  /** Returns the next chunk eligible to (re)send, or null if nothing is ready. */
  pickNextSendable(now: number = Date.now()): ChunkRecord | null {
    for (const key of this.orderedKeys) {
      const rec = this.chunks.get(key)
      if (!rec) continue
      if (rec.status === 'acked' || rec.status === 'verified' || rec.status === 'failed') continue
      if (rec.status === 'in_flight') continue
      if (rec.nextEligibleAt <= now) return rec
    }
    return null
  }

  markSent(fileIndex: number, chunkIndex: number, now: number = Date.now()): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    if (rec.attempts > 0) this.totalRetries++
    rec.attempts++
    rec.status = 'in_flight'
    rec.lastSentAt = now
  }

  markAcked(fileIndex: number, chunkIndex: number): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    if (rec.status === 'verified') return
    rec.status = 'acked'
  }

  markVerified(fileIndex: number, chunkIndex: number): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    rec.status = 'verified'
  }

  /** Schedule a retry; if the budget is exceeded, mark the chunk failed. */
  scheduleRetry(fileIndex: number, chunkIndex: number, now: number = Date.now()): boolean {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return false
    if (rec.attempts >= this.maxAttempts) {
      rec.status = 'failed'
      return false
    }
    const delay = this.initialDelayMs * Math.pow(this.backoffFactor, Math.max(0, rec.attempts - 1))
    rec.status = 'pending'
    rec.nextEligibleAt = now + delay
    return true
  }

  forceResend(fileIndex: number, chunkIndex: number): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    rec.status = 'pending'
    rec.nextEligibleAt = 0
  }

  /** Reissue every chunk that's currently in-flight as pending — used on resume. */
  resetInFlight(): void {
    for (const rec of this.chunks.values()) {
      if (rec.status === 'in_flight') {
        rec.status = 'pending'
        rec.nextEligibleAt = 0
      }
    }
  }

  /** Returns the chunks the receiver still needs, for resume after disconnect. */
  missingChunks(): Array<{ fileIndex: number; chunkIndex: number }> {
    const missing: Array<{ fileIndex: number; chunkIndex: number }> = []
    for (const rec of this.chunks.values()) {
      if (rec.status !== 'verified' && rec.status !== 'acked') {
        missing.push({ fileIndex: rec.fileIndex, chunkIndex: rec.chunkIndex })
      }
    }
    return missing
  }

  isComplete(): boolean {
    for (const rec of this.chunks.values()) {
      if (rec.status !== 'verified' && rec.status !== 'acked') return false
    }
    return true
  }

  failedChunkCount(): number {
    let n = 0
    for (const rec of this.chunks.values()) if (rec.status === 'failed') n++
    return n
  }

  // ── Snapshot for UI / health ────────────────────────────────────────────

  snapshot(): ChunkTrackerSnapshot {
    let pending = 0
    let inFlight = 0
    let acked = 0
    let verified = 0
    let failed = 0
    let bytesAcked = 0

    for (const rec of this.chunks.values()) {
      switch (rec.status) {
        case 'pending': pending++; break
        case 'in_flight': inFlight++; break
        case 'acked': acked++; bytesAcked += rec.size; break
        case 'verified': verified++; bytesAcked += rec.size; break
        case 'failed': failed++; break
      }
    }

    return {
      totalChunks: this.chunks.size,
      pending,
      inFlight,
      acked,
      verified,
      failed,
      retries: this.totalRetries,
      failedChunks: failed,
      bytesAcked,
      bytesTotal: this.totalBytes,
    }
  }

  totalRetriesCount(): number {
    return this.totalRetries
  }

  // ── Receiver helpers ────────────────────────────────────────────────────

  hasReceived(fileIndex: number, chunkIndex: number): boolean {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    return rec ? rec.status === 'verified' || rec.status === 'acked' : false
  }

  expectedHashFor(fileIndex: number, chunkIndex: number): string | undefined {
    return this.chunks.get(ackKey(fileIndex, chunkIndex))?.expectedHash
  }
}
