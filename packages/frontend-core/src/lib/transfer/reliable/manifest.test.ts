import { describe, expect, it } from 'vitest'

import { buildManifest, chunkRange, computeChunkCount } from './manifest'
import type { TransferFile } from '../types'

function makeFile(id: string, size: number, type = 'application/octet-stream'): TransferFile {
  // Single 0xab byte stream of the requested size.
  const buf = new Uint8Array(size).fill(0xab)
  const blob = new Blob([buf], { type })
  return { id, name: `${id}.bin`, type, size, blob }
}

describe('manifest helpers', () => {
  it('computes chunk counts using ceiling division', () => {
    expect(computeChunkCount(0, 1024)).toBe(0)
    expect(computeChunkCount(1, 1024)).toBe(1)
    expect(computeChunkCount(1024, 1024)).toBe(1)
    expect(computeChunkCount(1025, 1024)).toBe(2)
    expect(computeChunkCount(64 * 1024 + 1, 64 * 1024)).toBe(2)
  })

  it('produces correct chunk ranges, clamped to file size', () => {
    expect(chunkRange(0, 1024, 1500)).toEqual({ start: 0, end: 1024 })
    expect(chunkRange(1, 1024, 1500)).toEqual({ start: 1024, end: 1500 })
    expect(chunkRange(2, 1024, 1500)).toEqual({ start: 2048, end: 1500 })
  })

  it('builds a manifest with per-chunk hashes when enabled', async () => {
    const file = makeFile('a', 5 * 1024) // 5 chunks at 1 KB
    const manifest = await buildManifest([file], { chunkSize: 1024, perChunkHash: true })

    expect(manifest.totalChunks).toBe(5)
    expect(manifest.totalSize).toBe(5 * 1024)
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0].fileIndex).toBe(0)
    expect(manifest.files[0].totalChunks).toBe(5)
    expect(manifest.files[0].chunkHashes).toHaveLength(5)
    expect(manifest.files[0].chunkHashes![0]).toMatch(/^[0-9a-f]{64}$/)
  })

  it('omits per-chunk hashes when disabled', async () => {
    const file = makeFile('a', 1024)
    const manifest = await buildManifest([file], { chunkSize: 256, perChunkHash: false })
    expect(manifest.files[0].chunkHashes).toBeUndefined()
    expect(manifest.perChunkHash).toBe(false)
  })

  it('respects maxHashFileSize and skips per-chunk hashing for huge files', async () => {
    const file = makeFile('a', 1024)
    const manifest = await buildManifest([file], {
      chunkSize: 256,
      perChunkHash: true,
      maxHashFileSize: 100, // arbitrarily low so we skip hashing
    })
    expect(manifest.files[0].chunkHashes).toBeUndefined()
  })

  it('computes a stable rootHash when requested', async () => {
    const file = makeFile('a', 4096)
    const manifest1 = await buildManifest([file], {
      chunkSize: 1024,
      perChunkHash: true,
      computeRootHash: true,
      transferId: 'tid-1',
    })
    const manifest2 = await buildManifest([file], {
      chunkSize: 1024,
      perChunkHash: true,
      computeRootHash: true,
      transferId: 'tid-2',
    })
    expect(manifest1.rootHash).toMatch(/^[0-9a-f]{64}$/)
    // Same files → same rootHash even with different transferIds.
    expect(manifest1.rootHash).toBe(manifest2.rootHash)
  })

  it('aggregates totals across multiple files', async () => {
    const a = makeFile('a', 2048)
    const b = makeFile('b', 1024)
    const manifest = await buildManifest([a, b], { chunkSize: 1024, perChunkHash: false })
    expect(manifest.files).toHaveLength(2)
    expect(manifest.totalSize).toBe(3072)
    expect(manifest.totalChunks).toBe(3)
    expect(manifest.files[0].fileIndex).toBe(0)
    expect(manifest.files[1].fileIndex).toBe(1)
  })
})
