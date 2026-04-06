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
const listeners = new Set<SyncListener>()
let currentState: SyncState = {
  connected: false,
  peerCount: 0,
  syncing: false,
  lastSync: null,
  error: null,
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

/**
 * Initialize yjs doc with IndexedDB persistence + WebRTC provider.
 * Safe to call multiple times — will reuse existing provider.
 *
 * @param roomId  First 32 chars of key hash (vault room namespace prefix: "vault:")
 * @param signalingUrl  Existing clex signaling server URL
 */
export async function initSync(roomId: string, signalingUrl: string): Promise<void> {
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

    // IndexedDB persistence — loads instantly from local state
    const persistence = new IndexeddbPersistence(fullRoomId, ydoc as InstanceType<typeof Doc>)
    persistence.on('synced', () => {
      notify({ syncing: false, lastSync: Date.now() })
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
  notify({ connected: false, peerCount: 0, syncing: false })
}
