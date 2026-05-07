import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { transferQueueStore } from './queue'

function read(): ReturnType<typeof getState> {
  return getState()
}

function getState() {
  let snapshot: any
  const unsub = transferQueueStore.subscribe(s => { snapshot = s })
  unsub()
  return snapshot
}

beforeEach(() => {
  transferQueueStore.clearAll()
})

afterEach(() => {
  transferQueueStore.clearAll()
})

describe('transferQueueStore', () => {
  it('starts empty', () => {
    expect(read().entries).toEqual([])
  })

  it('enqueues and assigns a stable id + timestamps', () => {
    const entry = transferQueueStore.enqueue({
      transferId: null,
      direction: 'send',
      fileNames: ['a.bin'],
      totalSize: 100,
      totalChunks: 1,
      route: 'webrtc',
      status: 'pending',
      resumable: false,
    })
    expect(entry.id).toMatch(/^q_/)
    expect(entry.status).toBe('pending')
    expect(entry.createdAt).toBeGreaterThan(0)
    expect(entry.updatedAt).toBe(entry.createdAt)
    expect(read().entries[0].id).toBe(entry.id)
  })

  it('transitions through pending → active → completed', () => {
    const entry = transferQueueStore.enqueue({
      transferId: 't',
      direction: 'send',
      fileNames: ['a'],
      totalSize: 10,
      totalChunks: 1,
      route: 'webrtc',
      status: 'pending',
      resumable: false,
    })

    transferQueueStore.setStatus(entry.id, 'active')
    expect(read().entries[0].status).toBe('active')

    transferQueueStore.setStatus(entry.id, 'completed')
    expect(read().entries[0].status).toBe('completed')
  })

  it('attaches a receipt and marks the entry verified or failed', () => {
    const entry = transferQueueStore.enqueue({
      transferId: 't',
      direction: 'send',
      fileNames: ['a'],
      totalSize: 10,
      totalChunks: 1,
      route: 'webrtc',
      status: 'active',
      resumable: false,
    })
    transferQueueStore.attachReceipt(entry.id, {
      transferId: 't',
      totalSize: 10,
      totalChunks: 1,
      chunkSize: 1024,
      fileCount: 1,
      verified: true,
      startedAt: 0,
      completedAt: 1,
      durationMs: 1,
      route: 'webrtc',
      retryCount: 0,
      failedChunkCount: 0,
      healthScore: 100,
      rev: 1,
    })
    expect(read().entries[0].status).toBe('completed')
    expect(read().entries[0].receipt).toBeDefined()
  })

  it('clearCompleted prunes only terminal entries', () => {
    const a = transferQueueStore.enqueue({
      transferId: null, direction: 'send', fileNames: [], totalSize: 0, totalChunks: 0,
      route: 'webrtc', status: 'completed', resumable: false,
    })
    transferQueueStore.enqueue({
      transferId: null, direction: 'send', fileNames: [], totalSize: 0, totalChunks: 0,
      route: 'webrtc', status: 'active', resumable: false,
    })
    transferQueueStore.clearCompleted()
    const ids = read().entries.map((e: any) => e.id)
    expect(ids).not.toContain(a.id)
    expect(read().entries.find((e: any) => e.status === 'active')).toBeDefined()
  })

  it('removes a single entry by id', () => {
    const a = transferQueueStore.enqueue({
      transferId: null, direction: 'send', fileNames: [], totalSize: 0, totalChunks: 0,
      route: 'webrtc', status: 'pending', resumable: false,
    })
    transferQueueStore.remove(a.id)
    expect(read().entries).toEqual([])
  })
})
