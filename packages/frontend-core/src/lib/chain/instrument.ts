/**
 * Clex Chain Instrumentation
 *
 * Subscribes to the transfer store and fires-and-forgets chain API calls.
 * Never blocks or throws — if the chain API is down, transfers continue normally.
 *
 * Usage (in WorkspaceApp.svelte or app init):
 *   import { initChainInstrumentation } from '$chain/instrument'
 *   onMount(() => initChainInstrumentation(chainClient))
 */

import { get } from 'svelte/store'
import { transferStore, type TransferState } from '$stores/transfer'
import { filesStore } from '$stores/files'
import { getChainId } from '$utils/chainId'
import { ChainClient, hashBlob, fileCategory, type ChainFile } from './client'

// Map internal transfer states to chain statuses
const STATE_TO_CHAIN: Partial<Record<TransferState, string>> = {
  waiting_peer: 'waiting_peer',
  connecting:   'connecting',
  transferring: 'transferring',
  complete:     'completed',
  failed:       'failed',
}

interface ActiveSession {
  sessionId: string
  route: string
  startedAt: number
}

export function initChainInstrumentation(client: ChainClient): () => void {
  let active: ActiveSession | null = null
  let activePromise: Promise<ActiveSession | null> | null = null
  let prevState: TransferState = 'idle'
  let registered = false
  let lastEventStatus: string | null = null
  let lastPeerChainId: string | null = null

  async function createSessionForTransfer(method: string): Promise<ActiveSession | null> {
    const route = method === 'drive' ? 'drive' : method === 'local' ? 'local' : 'webrtc'

    if (active?.route === route) return active
    if (activePromise) return activePromise

    activePromise = (async () => {
      const chainId = getChainId()
      if (!registered) {
        await client.register(chainId)
        registered = true
      }

      // Build file metadata — hash all blobs concurrently
      const files = get(filesStore)
      const chainFiles: ChainFile[] = await Promise.all(
        files.map(async f => {
          const blob = f.processed?.blob ?? f.file
          let hash: string | null = null

          try {
            hash = await hashBlob(blob)
          } catch {
            hash = null
          }

          return {
            category: fileCategory(f.type),
            type: f.type || 'application/octet-stream',
            size: f.size,
            hash,
          }
        })
      )

      if (chainFiles.length === 0) return null

      const result = await client.createSession(chainId, route, chainFiles)
      if (!result) return null

      const nextSession = { sessionId: result.session_id, route, startedAt: Date.now() }
      active = nextSession
      lastEventStatus = 'waiting_peer'
      await client.appendEvent(result.session_id, 'waiting_peer')
      return nextSession
    })().finally(() => {
      activePromise = null
    })

    return activePromise
  }

  // Eagerly register this client's chain ID
  void (async () => {
    const chainId = getChainId()
    await client.register(chainId)
    registered = true
  })()

  const unsub = transferStore.subscribe(async store => {
    const { state, method, peerChainId } = store

    if (state === prevState) {
      if (peerChainId && peerChainId !== lastPeerChainId && lastEventStatus) {
        const session = active ?? await activePromise
        if (session) {
          lastPeerChainId = peerChainId
          void client.appendEvent(session.sessionId, lastEventStatus, peerChainId)
        }
      }
      return
    }
    const prev = prevState
    prevState = state

    // ── Session creation: idle/failed → waiting_peer (sender starts sending) ──
    if (state === 'waiting_peer' && (prev === 'idle' || prev === 'preparing' || prev === 'failed')) {
      void createSessionForTransfer(method)
      return
    }

    // ── Event appends for subsequent state transitions ──────────────────────
    const chainStatus = STATE_TO_CHAIN[state]
    if (!chainStatus) return
    if (chainStatus === lastEventStatus) return

    const session = active ?? await activePromise
    if (!session) return

    lastEventStatus = chainStatus
    const receiverChainId = store.peerChainId ?? undefined
    if (receiverChainId) {
      lastPeerChainId = receiverChainId
    }
    void client.appendEvent(session.sessionId, chainStatus, receiverChainId)

    // Clear session on terminal states
    if (['completed', 'failed', 'cancelled', 'abandoned'].includes(chainStatus)) {
      active = null
      lastEventStatus = null
      lastPeerChainId = null
    }
  })

  return unsub
}

export function createChainClient(baseUrl: string): ChainClient {
  return new ChainClient(baseUrl)
}

export { ChainClient }
