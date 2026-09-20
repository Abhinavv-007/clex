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
 *
 * PERFORMANCE CONTRACT
 * --------------------
 * The sender calls `pickNextSendable()`, `snapshot()` and `isComplete()` once
 * per chunk. Each of those used to walk every chunk in the transfer, so the
 * cost of sending a file grew with the square of its size: a 1 GB file is
 * 16,384 chunks at 64 KB, which meant ~5x10^8 record visits just to bookkeep,
 * on the same main thread that runs the UI. Large transfers crawled and got
 * quadratically worse the bigger the file.
 *
 * So the counts are maintained incrementally, and the scan for the next
 * sendable chunk is a cursor that only moves forward. Every method on the hot
 * path is now O(1) amortised. `missingChunks()` and `resetInFlight()` are
 * still linear, but they run once per resume, not once per chunk.
 *
 * Every status change must go through `setStatus()` so the counters cannot
 * drift out of sync with the records.
 */
export class ChunkTracker {
  private readonly chunks = new Map<string, ChunkRecord>()
  /** Send order. Parallel to the map, for O(1) positional access. */
  private readonly ordered: ChunkRecord[] = []
  private readonly maxAttempts: number
  private readonly initialDelayMs: number
  private readonly backoffFactor: number
  private totalBytes = 0
  private totalRetries = 0

  // ── Incrementally maintained counters (see PERFORMANCE CONTRACT) ────────
  private nPending = 0
  private nInFlight = 0
  private nAcked = 0
  private nVerified = 0
  private nFailed = 0
  private bytesAcked = 0
  private bytesInFlight = 0

  /**
   * Index into `ordered` of the first chunk that has never been sent.
   * Only ever moves forward; chunks that come back for a retry are held in
   * `retryable` instead, so the cursor never has to walk backwards.
   */
  private cursor = 0

  /** Chunks that returned to `pending` after having been sent at least once. */
  private readonly retryable = new Set<ChunkRecord>()

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
      this.ordered.push(record)
      this.totalBytes += record.size
      this.nPending++
    }
  }

  /**
   * The single place a chunk's status changes. Keeps the counters, the
   * acked-byte total and the retry set consistent with the records.
   */
  private setStatus(rec: ChunkRecord, next: ChunkStatus): void {
    const prev = rec.status
    if (prev === next) return

    switch (prev) {
      case 'pending': this.nPending--; break
      case 'in_flight': this.nInFlight--; this.bytesInFlight -= rec.size; break
      case 'acked': this.nAcked--; this.bytesAcked -= rec.size; break
      case 'verified': this.nVerified--; this.bytesAcked -= rec.size; break
      case 'failed': this.nFailed--; break
    }
    switch (next) {
      case 'pending': this.nPending++; break
      case 'in_flight': this.nInFlight++; this.bytesInFlight += rec.size; break
      case 'acked': this.nAcked++; this.bytesAcked += rec.size; break
      case 'verified': this.nVerified++; this.bytesAcked += rec.size; break
      case 'failed': this.nFailed++; break
    }

    rec.status = next
    if (next !== 'pending') this.retryable.delete(rec)
  }

  // ── Sender helpers ──────────────────────────────────────────────────────

  /** Returns the next chunk eligible to (re)send, or null if nothing is ready. */
  pickNextSendable(now: number = Date.now()): ChunkRecord | null {
    // Retries come first and win ties by send order, matching the old
    // front-to-back scan. The set holds only chunks that have already been
    // sent once, so it stays small on a healthy link.
    let best: ChunkRecord | null = null
    if (this.retryable.size > 0) {
      for (const rec of this.retryable) {
        if (rec.status !== 'pending') { this.retryable.delete(rec); continue }
        if (rec.nextEligibleAt > now) continue
        if (
          best === null ||
          rec.fileIndex < best.fileIndex ||
          (rec.fileIndex === best.fileIndex && rec.chunkIndex < best.chunkIndex)
        ) {
          best = rec
        }
      }
    }

    // Then the first never-sent chunk. Anything before the cursor is either
    // in flight, settled, failed, or already tracked in `retryable`.
    while (this.cursor < this.ordered.length) {
      const rec = this.ordered[this.cursor]
      if (rec.status === 'pending') {
        if (rec.nextEligibleAt > now) break
        // A retried chunk that still sits at the cursor is already the best
        // candidate by order, so prefer it over anything found above.
        return best !== null && this.isEarlier(best, rec) ? best : rec
      }
      this.cursor++
    }

    return best
  }

  private isEarlier(a: ChunkRecord, b: ChunkRecord): boolean {
    if (a.fileIndex !== b.fileIndex) return a.fileIndex < b.fileIndex
    return a.chunkIndex < b.chunkIndex
  }

  markSent(fileIndex: number, chunkIndex: number, now: number = Date.now()): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    if (rec.attempts > 0) this.totalRetries++
    rec.attempts++
    this.setStatus(rec, 'in_flight')
    rec.lastSentAt = now
  }

  markAcked(fileIndex: number, chunkIndex: number): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    if (rec.status === 'verified') return
    this.setStatus(rec, 'acked')
  }

  markVerified(fileIndex: number, chunkIndex: number): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    this.setStatus(rec, 'verified')
  }

  /** Schedule a retry; if the budget is exceeded, mark the chunk failed. */
  scheduleRetry(fileIndex: number, chunkIndex: number, now: number = Date.now()): boolean {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return false
    if (rec.attempts >= this.maxAttempts) {
      this.setStatus(rec, 'failed')
      return false
    }
    const delay = this.initialDelayMs * Math.pow(this.backoffFactor, Math.max(0, rec.attempts - 1))
    this.setStatus(rec, 'pending')
    rec.nextEligibleAt = now + delay
    this.retryable.add(rec)
    return true
  }

  forceResend(fileIndex: number, chunkIndex: number): void {
    const rec = this.chunks.get(ackKey(fileIndex, chunkIndex))
    if (!rec) return
    this.setStatus(rec, 'pending')
    rec.nextEligibleAt = 0
    this.retryable.add(rec)
  }

  /** Reissue every chunk that's currently in-flight as pending — used on resume. */
  resetInFlight(): void {
    for (const rec of this.ordered) {
      if (rec.status === 'in_flight') {
        this.setStatus(rec, 'pending')
        rec.nextEligibleAt = 0
        this.retryable.add(rec)
      }
    }
  }

  /** Returns the chunks the receiver still needs, for resume after disconnect. */
  missingChunks(): Array<{ fileIndex: number; chunkIndex: number }> {
    const missing: Array<{ fileIndex: number; chunkIndex: number }> = []
    for (const rec of this.ordered) {
      if (rec.status !== 'verified' && rec.status !== 'acked') {
        missing.push({ fileIndex: rec.fileIndex, chunkIndex: rec.chunkIndex })
      }
    }
    return missing
  }

  isComplete(): boolean {
    return this.nAcked + this.nVerified === this.ordered.length
  }

  failedChunkCount(): number {
    return this.nFailed
  }

  // ── Snapshot for UI / health ────────────────────────────────────────────

  snapshot(): ChunkTrackerSnapshot {
    return {
      totalChunks: this.ordered.length,
      pending: this.nPending,
      inFlight: this.nInFlight,
      acked: this.nAcked,
      verified: this.nVerified,
      failed: this.nFailed,
      retries: this.totalRetries,
      failedChunks: this.nFailed,
      bytesAcked: this.bytesAcked,
      bytesTotal: this.totalBytes,
    }
  }

  /**
   * Bytes currently on the wire. The sender gates on this rather than on a
   * chunk count, so the window means the same thing regardless of how large
   * a chunk the connection negotiated.
   */
  inFlightBytes(): number {
    return this.bytesInFlight
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
