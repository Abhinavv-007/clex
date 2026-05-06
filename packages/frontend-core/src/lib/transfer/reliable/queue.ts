import { writable, type Readable } from 'svelte/store'

import type { QueueEntry, QueueEntryStatus, TransferReceipt } from '../types'

const STORAGE_KEY = 'clex.transfer.queue.v1'
const MAX_ENTRIES = 100

export interface QueueState {
  entries: QueueEntry[]
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function load(): QueueEntry[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry).slice(0, MAX_ENTRIES).map(reviveEntry)
  } catch {
    return []
  }
}

/**
 * Active in-memory transfers can't survive a page reload — the WebRTC peer
 * connection and any open file handles are gone. Anything still tagged
 * pending/active/paused after a reload is a zombie; mark it failed so the UI
 * doesn't show a phantom "in flight" row forever.
 */
function reviveEntry(entry: QueueEntry): QueueEntry {
  if (entry.status === 'pending' || entry.status === 'active' || entry.status === 'paused') {
    return {
      ...entry,
      status: 'failed',
      error: entry.error ?? 'Session ended before the transfer finished.',
      updatedAt: Date.now(),
    }
  }
  return entry
}

function persist(entries: QueueEntry[]): void {
  if (!isBrowser()) return
  try {
    const trimmed = entries.slice(0, MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Best-effort persistence; quota errors etc. are intentionally swallowed.
  }
}

function isValidEntry(entry: unknown): entry is QueueEntry {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    (typeof e.transferId === 'string' || e.transferId === null) &&
    (e.direction === 'send' || e.direction === 'receive') &&
    Array.isArray(e.fileNames) &&
    typeof e.totalSize === 'number' &&
    typeof e.totalChunks === 'number' &&
    typeof e.status === 'string' &&
    typeof e.createdAt === 'number' &&
    typeof e.updatedAt === 'number'
  )
}

const TERMINAL: QueueEntryStatus[] = ['completed', 'failed', 'cancelled']

export interface TransferQueueStore extends Readable<QueueState> {
  enqueue(entry: Omit<QueueEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): QueueEntry
  update(id: string, patch: Partial<QueueEntry>): void
  setStatus(id: string, status: QueueEntryStatus, extra?: Partial<QueueEntry>): void
  attachReceipt(id: string, receipt: TransferReceipt): void
  remove(id: string): void
  clearCompleted(): void
  clearAll(): void
}

function createQueueStore(): TransferQueueStore {
  const initial: QueueState = { entries: load() }
  const { subscribe, update } = writable<QueueState>(initial)

  function commit(next: QueueEntry[]): void {
    persist(next)
  }

  function mutate(producer: (entries: QueueEntry[]) => QueueEntry[]): void {
    update(state => {
      const next = producer(state.entries)
      commit(next)
      return { entries: next }
    })
  }

  return {
    subscribe,
    enqueue(entry) {
      const now = Date.now()
      const id = entry.id ?? `q_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      const created: QueueEntry = {
        id,
        transferId: entry.transferId ?? null,
        direction: entry.direction,
        fileNames: entry.fileNames,
        totalSize: entry.totalSize,
        totalChunks: entry.totalChunks,
        route: entry.route,
        status: entry.status ?? 'pending',
        createdAt: now,
        updatedAt: now,
        error: entry.error,
        receipt: entry.receipt,
        resumable: entry.resumable ?? false,
      }
      mutate(entries => [created, ...entries.filter(e => e.id !== id)].slice(0, MAX_ENTRIES))
      return created
    },
    update(id, patch) {
      mutate(entries =>
        entries.map(e => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e))
      )
    },
    setStatus(id, status, extra) {
      mutate(entries =>
        entries.map(e =>
          e.id === id ? { ...e, ...extra, status, updatedAt: Date.now() } : e
        )
      )
    },
    attachReceipt(id, receipt) {
      mutate(entries =>
        entries.map(e =>
          e.id === id
            ? {
                ...e,
                receipt,
                status: receipt.verified ? 'completed' : 'failed',
                updatedAt: Date.now(),
              }
            : e
        )
      )
    },
    remove(id) {
      mutate(entries => entries.filter(e => e.id !== id))
    },
    clearCompleted() {
      mutate(entries => entries.filter(e => !TERMINAL.includes(e.status)))
    },
    clearAll() {
      mutate(() => [])
    },
  }
}

export const transferQueueStore = createQueueStore()
