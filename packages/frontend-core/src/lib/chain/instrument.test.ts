/**
 * Reproduces the bug where transfer status remains stuck at "transferring"
 * in the chain ledger after a successful local/WebRTC transfer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { filesStore } from '../stores/files'
import { transferStore, type TransferState } from '../stores/transfer'

import { initChainInstrumentation } from './instrument'
import type { ChainClient } from './client'

// Provide a localStorage stub for getChainId in node env
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear() { this.store.clear() }
  getItem(k: string) { return this.store.get(k) ?? null }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null }
  removeItem(k: string) { this.store.delete(k) }
  setItem(k: string, v: string) { this.store.set(k, v) }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  // Reset stores between tests
  transferStore.reset()
  filesStore.reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

interface RecordedEvent {
  sessionId: string
  status: string
  receiverChainId?: string
}

function makeStubClient() {
  const events: RecordedEvent[] = []
  const sessions: Array<{ chainId: string; route: string; files: unknown[] }> = []
  let sessionCounter = 0
  let resolveCreate: ((value: { session_id: string; ledger_index: number }) => void) | null = null
  let createPromise: Promise<{ session_id: string; ledger_index: number }> | null = null

  const client: ChainClient = {
    register: vi.fn(async (_: string) => undefined),
    createSession: vi.fn(async (chainId: string, route: string, files: unknown[]) => {
      sessions.push({ chainId, route, files })
      sessionCounter += 1
      const result = { session_id: `session-${sessionCounter}`, ledger_index: sessionCounter }
      // Allow tests to control createSession resolution timing
      createPromise = new Promise(resolve => {
        resolveCreate = resolve
      })
      const settled = await createPromise
      return settled
    }),
    appendEvent: vi.fn(async (sessionId: string, status: string, receiverChainId?: string) => {
      events.push({ sessionId, status, receiverChainId })
    }),
  } as unknown as ChainClient

  return {
    client,
    events,
    sessions,
    resolveCreate: () => resolveCreate?.({ session_id: `session-${sessionCounter}`, ledger_index: sessionCounter }),
    autoResolve: () => {
      // Default: resolve immediately when called
      const original = client.createSession as ReturnType<typeof vi.fn>
      original.mockImplementation(async (chainId: string, route: string, files: unknown[]) => {
        sessions.push({ chainId, route, files })
        sessionCounter += 1
        return { session_id: `session-${sessionCounter}`, ledger_index: sessionCounter }
      })
    },
  }
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

async function makeFile(name = 'test.txt', size = 100): Promise<File> {
  const blob = new Blob([new Uint8Array(size)], { type: 'text/plain' })
  return new File([blob], name, { type: 'text/plain' })
}

async function runStateSequence(states: TransferState[]) {
  for (const s of states) {
    transferStore.setState(s)
    // Yield for the async subscribe handler to run
    await flush()
  }
}

describe('initChainInstrumentation — sender flow', () => {
  it('emits completed when sender goes idle → … → complete', async () => {
    const { client, events, autoResolve } = makeStubClient()
    autoResolve()

    // Set up a file in the store as a "sender"
    filesStore.add([await makeFile()])

    const unsub = initChainInstrumentation(client)

    // Walk through sender state machine
    transferStore.setMethod('webrtc')
    await flush()
    await runStateSequence([
      'preparing',
      'waiting_peer',
      'connecting',
      'transferring',
      'complete',
    ])

    // Give the chain calls a few ticks to settle
    await flush()
    await flush()

    unsub()

    const statuses = events.map(e => e.status)
    expect(statuses).toContain('completed')
  })

  it('emits completed for local route too', async () => {
    const { client, events, autoResolve } = makeStubClient()
    autoResolve()

    filesStore.add([await makeFile()])

    const unsub = initChainInstrumentation(client)

    transferStore.setMethod('local')
    await flush()
    await runStateSequence([
      'preparing',
      'waiting_peer',
      'connecting',
      'transferring',
      'complete',
    ])

    await flush()
    await flush()

    unsub()

    const statuses = events.map(e => e.status)
    expect(statuses).toContain('completed')
  })

  it('emits completed even when state transitions happen rapidly while createSession is in flight', async () => {
    const { client, events, sessions, resolveCreate } = makeStubClient()

    filesStore.add([await makeFile()])

    const unsub = initChainInstrumentation(client)

    transferStore.setMethod('webrtc')
    await flush()

    // Fire all state transitions before createSession resolves
    transferStore.setState('preparing')
    transferStore.setState('waiting_peer')
    transferStore.setState('connecting')
    transferStore.setState('transferring')
    transferStore.setState('complete')
    await flush()
    await flush()

    // Now resolve the createSession promise that the instrument is awaiting
    resolveCreate()

    // Wait for instrument to settle
    for (let i = 0; i < 30; i++) await flush()

    unsub()

    expect(sessions.length).toBeGreaterThan(0)
    const statuses = events.map(e => e.status)
    expect(statuses).toContain('completed')
  })

  it('emits completed when state goes complete while sender is still in createSession (large-file hash race)', async () => {
    // Realistic scenario: large file hashing is slow, so createSession is
    // still in flight when the user actually starts sending small files.
    // The transfer races to "complete" while createSession is pending.
    const { client, events, resolveCreate } = makeStubClient()

    filesStore.add([await makeFile()])

    const unsub = initChainInstrumentation(client)

    transferStore.setMethod('webrtc')
    await flush()

    transferStore.setState('preparing')
    transferStore.setState('waiting_peer')
    await flush()

    // Fast peer-join and DC-open while createSession is still hashing
    transferStore.setState('connecting')
    transferStore.setState('transferring')
    transferStore.setState('complete')
    await flush()

    resolveCreate()
    for (let i = 0; i < 30; i++) await flush()

    unsub()

    const statuses = events.map(e => e.status)
    expect(statuses).toContain('completed')
  })
})
