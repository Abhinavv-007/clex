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
import { receiptToChainMeta } from '$transfer/reliable'
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
  // Retain the session id after a terminal state so that a peer chain id
  // arriving late (e.g. via the DataChannel fallback after we've already
  // marked completed) can still backfill receiver_chain_id on the server.
  let lastTerminalSessionId: string | null = null
  let lastTerminalStatus: string | null = null

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
            // Filename is used only for client-side category fallback; it is
            // never sent to the chain server (privacy-preserving).
            category: fileCategory(f.type, f.name),
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
      // New session starting — drop any backfill pointers from the prior one.
      lastTerminalSessionId = null
      lastTerminalStatus = null
      lastPeerChainId = null
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
      // peerChainId can arrive at any point — early via signaling tags or
      // late via the DataChannel fallback. We backfill it on the active
      // session if there is one, or on the last terminal session if the
      // transfer has already finished.
      if (peerChainId && peerChainId !== lastPeerChainId) {
        const session = active ?? await activePromise
        if (session && lastEventStatus) {
          lastPeerChainId = peerChainId
          void client.appendEvent(session.sessionId, lastEventStatus, peerChainId)
        } else if (lastTerminalSessionId && lastTerminalStatus) {
          // Late receiver-chain after we've already posted a terminal status.
          // Server uses COALESCE for receiver_chain_id and refuses to regress
          // status, so this is safe.
          lastPeerChainId = peerChainId
          void client.appendEvent(lastTerminalSessionId, lastTerminalStatus, peerChainId)
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

    // Attach the privacy-safe receipt summary on terminal events when one is
    // available. The Chain worker accepts this `meta` field additively; older
    // deployments simply ignore it.
    const isTerminal = ['completed', 'failed', 'cancelled', 'abandoned'].includes(chainStatus)
    const meta = isTerminal && store.receipt ? receiptToChainMeta(store.receipt) : undefined
    void client.appendEvent(session.sessionId, chainStatus, receiverChainId, meta)

    if (isTerminal) {
      lastTerminalSessionId = session.sessionId
      lastTerminalStatus = chainStatus
      active = null
      lastEventStatus = null
      // Note: we deliberately do NOT clear lastPeerChainId or
      // lastTerminalSessionId here — they remain valid backfill targets.
    }
  })

  return unsub
}

export function createChainClient(baseUrl: string): ChainClient {
  return new ChainClient(baseUrl)
}

export { ChainClient }
