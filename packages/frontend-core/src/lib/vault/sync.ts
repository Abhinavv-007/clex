/**
 * Vault P2P Sync Engine
 *
 * Uses yjs as the CRDT and y-webrtc for peer connection via the existing
 * clex signaling server.  y-indexeddb persists the doc locally so the app
 * boots instantly from disk with zero network.
 *
 * Install required packages:
 *   pnpm --filter @clex/frontend-core add yjs y-indexeddb y-webrtc
 *
 * Room ID is derived from the master key hash so only paired devices
 * that share the same key will find each other.
 */

import type { StoredFolder, StoredNote } from './db'

export interface SyncState {
  connected: boolean
  peerCount: number
  syncing: boolean
  lastSync: number | null
  error: string | null
}

export type SyncListener = (state: SyncState) => void

let provider: unknown = null
let ydoc: unknown = null
let notesMap: SyncMap<StoredNote> | null = null
let foldersMap: SyncMap<StoredFolder> | null = null
const listeners = new Set<SyncListener>()
let currentState: SyncState = {
  connected: false,
  peerCount: 0,
  syncing: false,
  lastSync: null,
  error: null,
}
let syncHandlers: SyncHandlers = {}
let reconciled = false

const LOCAL_SYNC_ORIGIN = 'vault-local-sync'

type MapChangeAction = 'add' | 'update' | 'delete'

interface SyncMapEvent {
  changes: { keys: Map<string, { action: MapChangeAction }> }
  transaction: { origin: unknown }
}

interface SyncMap<T> {
  size: number
  get: (key: string) => T | undefined
  set: (key: string, value: T) => void
  delete: (key: string) => void
  forEach: (callback: (value: T, key: string) => void) => void
  observe: (callback: (event: SyncMapEvent) => void) => void
}

export interface SyncSeedState {
  notes: StoredNote[]
  folders: StoredFolder[]
}

interface SyncHandlers {
  upsertNote?: (note: StoredNote) => Promise<void> | void
  deleteNote?: (id: string) => Promise<void> | void
  upsertFolder?: (folder: StoredFolder) => Promise<void> | void
  deleteFolder?: (id: string) => Promise<void> | void
}

function notify(partial: Partial<SyncState>): void {
  currentState = { ...currentState, ...partial }
  for (const fn of listeners) fn(currentState)
}

export function onSyncState(fn: SyncListener): () => void {
  listeners.add(fn)
  fn(currentState)
  return () => listeners.delete(fn)
}

export function getSyncState(): SyncState {
  return currentState }

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function snapshotMap<T>(map: SyncMap<T> | null): Map<string, T> {
  const snapshot = new Map<string, T>()
  map?.forEach((value, key) => {
    snapshot.set(key, cloneRecord(value))
  })
  return snapshot
}

function transactLocal(fn: () => void): void {
  const doc = ydoc as { transact?: (callback: () => void, origin?: unknown) => void } | null
  if (doc?.transact) {
    doc.transact(fn, LOCAL_SYNC_ORIGIN)
    return
  }
  fn()
}

async function handleNoteMapChange(event: SyncMapEvent): Promise<void> {
  if (event.transaction.origin === LOCAL_SYNC_ORIGIN) return
  notify({ syncing: true, error: null })

  for (const [id, change] of event.changes.keys) {
    if (change.action === 'delete') {
      await syncHandlers.deleteNote?.(id)
      continue
    }

    const record = notesMap?.get(id)
    if (record) {
      await syncHandlers.upsertNote?.(cloneRecord(record))
    }
  }

  notify({ syncing: false, lastSync: Date.now(), connected: true, error: null })
}

async function handleFolderMapChange(event: SyncMapEvent): Promise<void> {
  if (event.transaction.origin === LOCAL_SYNC_ORIGIN) return
  notify({ syncing: true, error: null })

  for (const [id, change] of event.changes.keys) {
    if (change.action === 'delete') {
      await syncHandlers.deleteFolder?.(id)
      continue
    }

    const record = foldersMap?.get(id)
    if (record) {
      await syncHandlers.upsertFolder?.(cloneRecord(record))
    }
  }

  notify({ syncing: false, lastSync: Date.now(), connected: true, error: null })
}

async function reconcileSeed(seed: SyncSeedState, force = false, authoritative = false): Promise<void> {
  if (!notesMap || !foldersMap) return
  if (!force && reconciled) return
  if (!force) {
    reconciled = true
  }

  const remoteNotes = snapshotMap(notesMap)
  const remoteFolders = snapshotMap(foldersMap)
  const localNotes = new Map(seed.notes.map((note) => [note.id, cloneRecord(note)]))
  const localFolders = new Map(seed.folders.map((folder) => [folder.id, cloneRecord(folder)]))

  for (const [id, localNote] of localNotes) {
    const remoteNote = remoteNotes.get(id)
    if (!remoteNote) {
      transactLocal(() => notesMap?.set(id, cloneRecord(localNote)))
      continue
    }

    if (localNote.updatedAt > remoteNote.updatedAt) {
      transactLocal(() => notesMap?.set(id, cloneRecord(localNote)))
    } else if (remoteNote.updatedAt > localNote.updatedAt) {
      await syncHandlers.upsertNote?.(cloneRecord(remoteNote))
    }
  }

  if (authoritative) {
    for (const [id] of remoteNotes) {
      if (!localNotes.has(id)) {
        transactLocal(() => notesMap?.delete(id))
      }
    }
  } else {
    for (const [id, remoteNote] of remoteNotes) {
      if (!localNotes.has(id)) {
        await syncHandlers.upsertNote?.(cloneRecord(remoteNote))
      }
    }
  }

  for (const [id, localFolder] of localFolders) {
    if (!remoteFolders.has(id)) {
      transactLocal(() => foldersMap?.set(id, cloneRecord(localFolder)))
    }
  }

  if (authoritative) {
    for (const [id] of remoteFolders) {
      if (!localFolders.has(id)) {
        transactLocal(() => foldersMap?.delete(id))
      }
    }
  } else {
    for (const [id, remoteFolder] of remoteFolders) {
      if (!localFolders.has(id)) {
        await syncHandlers.upsertFolder?.(cloneRecord(remoteFolder))
      }
    }
  }

  notify({ syncing: false, lastSync: Date.now(), error: null })
}

export function setSyncHandlers(nextHandlers: SyncHandlers): void {
  syncHandlers = nextHandlers
}

/**
 * Initialize yjs doc with IndexedDB persistence + WebRTC provider.
 * Safe to call multiple times — will reuse existing provider.
 *
 * @param roomId  First 32 chars of key hash (vault room namespace prefix: "vault:")
 * @param signalingUrl  Existing clex signaling server URL
 */
export async function initSync(
  roomId: string,
  signalingUrl: string,
  seedState?: SyncSeedState,
): Promise<void> {
  if (provider) return // already initialized

  try {
    // Dynamic import — requires yjs, y-indexeddb, y-webrtc installed
    const [{ Doc }, { IndexeddbPersistence }, { WebrtcProvider }] = await Promise.all([
      import('yjs'),
      import('y-indexeddb'),
      import('y-webrtc'),
    ])

    ydoc = new Doc()
    const fullRoomId = `vault:${roomId}`
    notesMap = (ydoc as InstanceType<typeof Doc>).getMap('notes') as SyncMap<StoredNote>
    foldersMap = (ydoc as InstanceType<typeof Doc>).getMap('folders') as SyncMap<StoredFolder>
    notesMap.observe((event) => { void handleNoteMapChange(event) })
    foldersMap.observe((event) => { void handleFolderMapChange(event) })

    // IndexedDB persistence — loads instantly from local state
    const persistence = new IndexeddbPersistence(fullRoomId, ydoc as InstanceType<typeof Doc>)
    persistence.on('synced', () => {
      notify({ syncing: false, lastSync: Date.now() })
      if (seedState) {
        void reconcileSeed(seedState)
      }
    })

    // WebRTC provider using existing clex signaling server
    provider = new WebrtcProvider(fullRoomId, ydoc as InstanceType<typeof Doc>, {
      signaling: [signalingUrl.replace(/^http/, 'ws').replace(/^https/, 'wss')],
      maxConns: 3,
      filterBcConns: false,
    })

    const p = provider as {
      on: (event: string, fn: (...args: unknown[]) => void) => void
      awareness: { on: (event: string, fn: (...args: unknown[]) => void) => void; getStates: () => Map<unknown, unknown> }
    }

    p.on('synced', () => {
      notify({ connected: true, syncing: false, lastSync: Date.now(), error: null })
    })

    p.awareness.on('change', () => {
      const peers = p.awareness.getStates().size
      notify({ peerCount: Math.max(0, peers - 1) }) // exclude self
    })

    p.on('connection-error', (err: unknown) => {
      notify({ error: String(err), connected: false })
    })

    notify({ syncing: true })
  } catch (e) {
    // yjs packages not installed — sync unavailable, local-only mode
    notify({ error: 'Sync packages not installed. Run: pnpm --filter @clex/frontend-core add yjs y-indexeddb y-webrtc', connected: false })
    console.warn('[vault/sync] yjs sync unavailable:', e)
  }
}

export function getYDoc(): unknown {
  return ydoc
}

export function syncNoteRecord(note: StoredNote): void {
  if (!notesMap) return
  transactLocal(() => {
    notesMap?.set(note.id, cloneRecord(note))
  })
  notify({ lastSync: Date.now(), error: null })
}

export function syncDeleteNote(id: string): void {
  if (!notesMap) return
  transactLocal(() => {
    notesMap?.delete(id)
  })
  notify({ lastSync: Date.now(), error: null })
}

export function syncFolderRecord(folder: StoredFolder): void {
  if (!foldersMap) return
  transactLocal(() => {
    foldersMap?.set(folder.id, cloneRecord(folder))
  })
  notify({ lastSync: Date.now(), error: null })
}

export function syncDeleteFolder(id: string): void {
  if (!foldersMap) return
  transactLocal(() => {
    foldersMap?.delete(id)
  })
  notify({ lastSync: Date.now(), error: null })
}

export async function runManualSync(seed: SyncSeedState, options: { authoritative?: boolean } = {}): Promise<void> {
  if (!notesMap || !foldersMap) {
    notify({ error: 'Sync room is not ready yet', connected: false })
    return
  }

  notify({ syncing: true, error: null })
  await reconcileSeed(seed, true, options.authoritative === true)
  notify({ syncing: false, lastSync: Date.now(), error: null })
}

export function destroySync(): void {
  if (provider) {
    const p = provider as { destroy?: () => void }
    p.destroy?.()
    provider = null
  }
  if (ydoc) {
    const d = ydoc as { destroy?: () => void }
    d.destroy?.()
    ydoc = null
  }
  notesMap = null
  foldersMap = null
  reconciled = false
  notify({ connected: false, peerCount: 0, syncing: false })
}
