import { describe, expect, it } from 'vitest'

import { buildReceipt, receiptToChainMeta } from './receipt'
import type { TransferHealth, TransferManifest } from '../types'

function manifest(): TransferManifest {
  return {
    version: 1,
    transferId: 't-1',
    createdAt: 0,
    chunkSize: 1024,
    totalSize: 4096,
    totalChunks: 4,
    perChunkHash: true,
    rootHash: 'a'.repeat(64),
    files: [
      { fileId: 'a', fileIndex: 0, name: 'a.bin', mimeType: 'application/octet-stream', size: 4096, totalChunks: 4 },
    ],
  }
}

const health: TransferHealth = {
  score: 92,
  label: 'verified',
  retries: 1,
  failedChunks: 0,
  verifiedChunks: 4,
  ackedChunks: 4,
  totalChunks: 4,
  bufferedAmount: 0,
  bufferedHigh: false,
  averageSpeedBps: 1_000_000,
  connectionStable: true,
}

describe('buildReceipt', () => {
  it('captures verified, retry, hash, route, and timing', () => {
    const r = buildReceipt({
      manifest: manifest(),
      health,
      startedAt: 1_000,
      completedAt: 5_000,
      route: 'webrtc',
      retryCount: 1,
      failedChunkCount: 0,
      verified: true,
    })

    expect(r.transferId).toBe('t-1')
    expect(r.totalChunks).toBe(4)
    expect(r.chunkSize).toBe(1024)
    expect(r.fileCount).toBe(1)
    expect(r.verified).toBe(true)
    expect(r.startedAt).toBe(1_000)
    expect(r.completedAt).toBe(5_000)
    expect(r.durationMs).toBe(4_000)
    expect(r.route).toBe('webrtc')
    expect(r.retryCount).toBe(1)
    expect(r.failedChunkCount).toBe(0)
    expect(r.healthScore).toBe(92)
    expect(r.rootHash).toBe('a'.repeat(64))
    expect(r.rev).toBeGreaterThan(0)
  })

  it('clamps duration to non-negative values when timing is reversed', () => {
    const r = buildReceipt({
      manifest: manifest(),
      health,
      startedAt: 9_000,
      completedAt: 5_000,
      route: 'local',
      retryCount: 0,
      failedChunkCount: 0,
      verified: true,
    })
    expect(r.durationMs).toBe(0)
  })

  it('produces a privacy-preserving chain meta payload (no filenames, no content)', () => {
    const r = buildReceipt({
      manifest: manifest(),
      health,
      startedAt: 0,
      completedAt: 100,
      route: 'webrtc',
      retryCount: 0,
      failedChunkCount: 0,
      verified: true,
    })
    const meta = receiptToChainMeta(r)
    const json = JSON.stringify(meta)
    expect(json).not.toContain('a.bin')
    expect(meta).toHaveProperty('verified', true)
    expect(meta).toHaveProperty('chunk_count', 4)
    expect(meta).toHaveProperty('proof_root_hash')
  })
})
