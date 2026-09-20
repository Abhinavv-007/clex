import { describe, expect, it } from 'vitest'

import { ChunkTracker } from './chunkTracker'
import { RELIABLE_PROTOCOL_VERSION, type TransferManifest } from '../types'

function makeManifest(): TransferManifest {
  return {
    version: RELIABLE_PROTOCOL_VERSION,
    transferId: 't',
    createdAt: 0,
    chunkSize: 1024,
    totalSize: 3072,
    totalChunks: 3,
    perChunkHash: false,
    files: [
      {
        fileId: 'a',
        fileIndex: 0,
        name: 'a',
        mimeType: 'application/octet-stream',
        size: 3072,
        totalChunks: 3,
      },
    ],
  }
}

describe('ChunkTracker', () => {
  it('picks chunks in order until exhausted', () => {
    const tracker = new ChunkTracker(makeManifest())
    expect(tracker.pickNextSendable(0)?.chunkIndex).toBe(0)
    tracker.markSent(0, 0, 0)
    expect(tracker.pickNextSendable(0)?.chunkIndex).toBe(1)
    tracker.markSent(0, 1, 0)
    expect(tracker.pickNextSendable(0)?.chunkIndex).toBe(2)
    tracker.markSent(0, 2, 0)
    // All in_flight — nothing further pickable until ack/retry.
    expect(tracker.pickNextSendable(0)).toBeNull()
  })

  it('marks chunks acked and reports completion', () => {
    const tracker = new ChunkTracker(makeManifest())
    for (let i = 0; i < 3; i++) {
      tracker.markSent(0, i, 0)
      tracker.markAcked(0, i)
    }
    expect(tracker.isComplete()).toBe(true)
    expect(tracker.snapshot().acked).toBe(3)
    expect(tracker.snapshot().bytesAcked).toBe(3072)
  })

  it('schedules retries with backoff and counts them', () => {
    const tracker = new ChunkTracker(makeManifest(), {
      maxAttempts: 3,
      initialDelayMs: 100,
      backoffFactor: 2,
    })
    // Send + ack chunks 1 and 2 so the only thing left in the pool is the
    // retry of chunk 0; otherwise pickNextSendable would pick the next
    // never-sent chunk regardless of the retry timer.
    for (let i = 0; i < 3; i++) tracker.markSent(0, i, 0)
    tracker.markAcked(0, 1)
    tracker.markAcked(0, 2)
    expect(tracker.scheduleRetry(0, 0, 100)).toBe(true)
    expect(tracker.pickNextSendable(150)).toBeNull()
    expect(tracker.pickNextSendable(250)?.chunkIndex).toBe(0)
    tracker.markSent(0, 0, 250)
    expect(tracker.totalRetriesCount()).toBe(1)
  })

  it('marks chunk as failed once retries exhaust the budget', () => {
    const tracker = new ChunkTracker(makeManifest(), {
      maxAttempts: 2,
      initialDelayMs: 0,
      backoffFactor: 1,
    })
    tracker.markSent(0, 0, 0)
    expect(tracker.scheduleRetry(0, 0, 0)).toBe(true)
    tracker.markSent(0, 0, 0)
    expect(tracker.scheduleRetry(0, 0, 0)).toBe(false)
    expect(tracker.snapshot().failed).toBe(1)
    expect(tracker.failedChunkCount()).toBe(1)
  })

  it('forceResend pulls a chunk back into the sendable pool immediately', () => {
    const tracker = new ChunkTracker(makeManifest())
    tracker.markSent(0, 0, 0)
    tracker.markAcked(0, 0)
    expect(tracker.pickNextSendable(0)?.chunkIndex).toBe(1)
    tracker.forceResend(0, 0)
    expect(tracker.pickNextSendable(0)?.chunkIndex).toBe(0)
  })

  it('missingChunks lists chunks the receiver still needs', () => {
    const tracker = new ChunkTracker(makeManifest())
    tracker.markSent(0, 0, 0)
    tracker.markAcked(0, 0)
    tracker.markSent(0, 1, 0)
    // 1 is in-flight; 2 is pending; both are "missing" from receiver's view.
    const missing = tracker.missingChunks().map(m => m.chunkIndex).sort()
    expect(missing).toEqual([1, 2])
  })

  it('resetInFlight requeues in-flight chunks for resume', () => {
    const tracker = new ChunkTracker(makeManifest())
    tracker.markSent(0, 0, 0)
    tracker.markSent(0, 1, 0)
    tracker.resetInFlight()
    const snap = tracker.snapshot()
    expect(snap.inFlight).toBe(0)
    expect(snap.pending).toBe(3)
  })
})

// ── Regression guards for the incremental bookkeeping ─────────────────────
//
// snapshot(), pickNextSendable(), isComplete() and failedChunkCount() are
// called once per chunk by the send loop. They used to walk every chunk in
// the transfer, making a send O(chunks^2) — a 1 GB file is 16,384 chunks at
// 64 KB, so roughly 5x10^8 record visits on the UI thread. They are now
// driven by counters maintained in setStatus(). These tests cover the two
// ways that can go wrong: the counters drifting from reality, and someone
// reintroducing a full scan.

function makeBigManifest(totalChunks: number, chunkSize = 1024): TransferManifest {
  return {
    version: RELIABLE_PROTOCOL_VERSION,
    transferId: 'big',
    createdAt: 0,
    chunkSize,
    totalSize: totalChunks * chunkSize,
    totalChunks,
    perChunkHash: false,
    files: [{
      fileId: 'f',
      fileIndex: 0,
      name: 'f',
      mimeType: 'application/octet-stream',
      size: totalChunks * chunkSize,
      totalChunks,
    }],
  }
}

describe('ChunkTracker bookkeeping', () => {
  it('keeps counters consistent with the records through a full lifecycle', () => {
    const total = 400
    const tracker = new ChunkTracker(makeBigManifest(total), { maxAttempts: 3 })

    const invariant = (label: string) => {
      const s = tracker.snapshot()
      expect(s.pending + s.inFlight + s.acked + s.verified + s.failed, label).toBe(total)
      expect(s.totalChunks, label).toBe(total)
      expect(s.bytesAcked, label).toBe((s.acked + s.verified) * 1024)
      expect(s.failedChunks, label).toBe(tracker.failedChunkCount())
      // missingChunks() is an independent, non-incremental view.
      expect(tracker.missingChunks().length, label).toBe(total - s.acked - s.verified)
      expect(tracker.isComplete(), label).toBe(s.acked + s.verified === total)
    }

    invariant('seeded')

    // Deterministic mixed workload: send everything, ack most, retry some,
    // verify some, and let a few exhaust their retry budget.
    for (let i = 0; i < total; i++) {
      const rec = tracker.pickNextSendable(0)
      expect(rec?.chunkIndex).toBe(i)
      tracker.markSent(0, i, 0)
    }
    invariant('all sent')

    for (let i = 0; i < total; i++) {
      if (i % 7 === 0) {
        tracker.scheduleRetry(0, i, 0)
      } else if (i % 3 === 0) {
        tracker.markAcked(0, i)
        tracker.markVerified(0, i)
      } else {
        tracker.markAcked(0, i)
      }
    }
    invariant('mixed ack/verify/retry')

    // Drain the retried chunks, exhausting the budget on a few.
    let guard = 0
    let rec = tracker.pickNextSendable(0)
    while (rec && guard++ < total * 5) {
      const { fileIndex, chunkIndex } = rec
      tracker.markSent(fileIndex, chunkIndex, 0)
      if (chunkIndex % 14 === 0) {
        tracker.scheduleRetry(fileIndex, chunkIndex, 0)
      } else {
        tracker.markAcked(fileIndex, chunkIndex)
      }
      rec = tracker.pickNextSendable(0)
    }
    invariant('retries drained')
    expect(guard).toBeLessThan(total * 5)
  })

  it('re-counts correctly after resetInFlight requeues a resumed transfer', () => {
    const total = 50
    const tracker = new ChunkTracker(makeBigManifest(total))
    for (let i = 0; i < total; i++) tracker.markSent(0, i, 0)
    for (let i = 0; i < 20; i++) tracker.markAcked(0, i)

    tracker.resetInFlight()
    const s = tracker.snapshot()
    expect(s.inFlight).toBe(0)
    expect(s.acked).toBe(20)
    expect(s.pending).toBe(30)
    expect(s.bytesAcked).toBe(20 * 1024)

    // The requeued chunks must still be reachable in order.
    expect(tracker.pickNextSendable(0)?.chunkIndex).toBe(20)
  })

  it('tracks in-flight bytes so the window is independent of chunk size', () => {
    const tracker = new ChunkTracker(makeBigManifest(10))
    expect(tracker.inFlightBytes()).toBe(0)
    tracker.markSent(0, 0, 0)
    tracker.markSent(0, 1, 0)
    expect(tracker.inFlightBytes()).toBe(2 * 1024)
    tracker.markAcked(0, 0)
    expect(tracker.inFlightBytes()).toBe(1024)
    tracker.scheduleRetry(0, 1, 0)
    expect(tracker.inFlightBytes()).toBe(0)
  })

  it('drives a large transfer without per-chunk full scans', () => {
    // 60k chunks. Linear bookkeeping is ~6x10^4 operations; the previous
    // implementation was ~3.6x10^9 and would not finish in any sane time.
    const total = 60_000
    const tracker = new ChunkTracker(makeBigManifest(total))

    const started = Date.now()
    for (let i = 0; i < total; i++) {
      const rec = tracker.pickNextSendable(0)
      if (!rec) throw new Error(`ran out of sendable chunks at ${i}`)
      tracker.markSent(rec.fileIndex, rec.chunkIndex, 0)
      tracker.markAcked(rec.fileIndex, rec.chunkIndex)
      tracker.snapshot()
      tracker.isComplete()
    }
    const elapsed = Date.now() - started

    expect(tracker.isComplete()).toBe(true)
    expect(tracker.snapshot().acked).toBe(total)

    // The ceiling is deliberately enormous. Linear bookkeeping finishes this
    // in tens of milliseconds; the quadratic version it replaced would need
    // ~3.6x10^9 record visits, which is minutes. Anything between those two
    // is not a real signal, and a tight bound just makes the test fail when
    // something else is loading the machine — which is exactly what it did.
    expect(elapsed).toBeLessThan(30_000)
  })
})

describe('markAckedThrough (cumulative ack)', () => {
  /**
   * One ACK per chunk floods the reverse direction of a busy association.
   * Measured with raw WebRTC and no Clex code in the path, 5 MB over loopback
   * took 3s with no ACKs, 6s with a per-chunk ACK, and 3s again once ACKs were
   * batched — so the receiver now sends one "through index N" per batch.
   * These cover the accounting that makes that safe.
   */
  function bigManifest(chunks: number): TransferManifest {
    return {
      version: RELIABLE_PROTOCOL_VERSION,
      transferId: 't',
      createdAt: 0,
      chunkSize: 1024,
      totalSize: 1024 * chunks,
      totalChunks: chunks,
      perChunkHash: false,
      files: [{ fileId: 'a', fileIndex: 0, name: 'a', mimeType: 'application/octet-stream',
                size: 1024 * chunks, totalChunks: chunks }],
    }
  }

  it('acks every chunk through the given index', () => {
    const tracker = new ChunkTracker(bigManifest(10))
    for (let i = 0; i < 10; i++) tracker.markSent(0, i)
    tracker.markAckedThrough(0, 4)
    const snap = tracker.snapshot()
    expect(snap.acked).toBe(5)
    expect(snap.inFlight).toBe(5)
  })

  it('completes the transfer when the final index is acked', () => {
    const tracker = new ChunkTracker(bigManifest(10))
    for (let i = 0; i < 10; i++) tracker.markSent(0, i)
    expect(tracker.isComplete()).toBe(false)
    tracker.markAckedThrough(0, 9)
    expect(tracker.isComplete()).toBe(true)
  })

  it('is idempotent — a repeated or stale ack changes nothing', () => {
    const tracker = new ChunkTracker(bigManifest(10))
    for (let i = 0; i < 10; i++) tracker.markSent(0, i)
    tracker.markAckedThrough(0, 6)
    const after = tracker.snapshot().acked
    tracker.markAckedThrough(0, 6)
    tracker.markAckedThrough(0, 3) // stale, arrives late
    expect(tracker.snapshot().acked).toBe(after)
  })

  it('advances from where the previous batch stopped', () => {
    const tracker = new ChunkTracker(bigManifest(10))
    for (let i = 0; i < 10; i++) tracker.markSent(0, i)
    tracker.markAckedThrough(0, 2)
    tracker.markAckedThrough(0, 7)
    expect(tracker.snapshot().acked).toBe(8)
  })

  it('never downgrades a chunk that was already verified', () => {
    const tracker = new ChunkTracker(bigManifest(5))
    for (let i = 0; i < 5; i++) tracker.markSent(0, i)
    tracker.markVerified(0, 1)
    tracker.markAckedThrough(0, 4)
    const snap = tracker.snapshot()
    expect(snap.verified).toBe(1)
    expect(snap.acked).toBe(4)
    expect(tracker.isComplete()).toBe(true)
  })

  it('keeps acked bytes consistent with the per-chunk path', () => {
    const cumulative = new ChunkTracker(bigManifest(8))
    const perChunk = new ChunkTracker(bigManifest(8))
    for (let i = 0; i < 8; i++) { cumulative.markSent(0, i); perChunk.markSent(0, i) }
    cumulative.markAckedThrough(0, 7)
    for (let i = 0; i < 8; i++) perChunk.markAcked(0, i)
    expect(cumulative.snapshot().bytesAcked).toBe(perChunk.snapshot().bytesAcked)
    expect(cumulative.snapshot().acked).toBe(perChunk.snapshot().acked)
  })

  it('scopes the high-water mark per file', () => {
    const manifest: TransferManifest = {
      version: RELIABLE_PROTOCOL_VERSION, transferId: 't', createdAt: 0, chunkSize: 1024,
      totalSize: 4096, totalChunks: 4, perChunkHash: false,
      files: [
        { fileId: 'a', fileIndex: 0, name: 'a', mimeType: 'application/octet-stream', size: 2048, totalChunks: 2 },
        { fileId: 'b', fileIndex: 1, name: 'b', mimeType: 'application/octet-stream', size: 2048, totalChunks: 2 },
      ],
    }
    const tracker = new ChunkTracker(manifest)
    for (const f of [0, 1]) for (let i = 0; i < 2; i++) tracker.markSent(f, i)
    tracker.markAckedThrough(0, 1)
    expect(tracker.snapshot().acked).toBe(2)
    expect(tracker.isComplete()).toBe(false)
    tracker.markAckedThrough(1, 1)
    expect(tracker.isComplete()).toBe(true)
  })
})
