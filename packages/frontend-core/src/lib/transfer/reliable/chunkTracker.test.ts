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
