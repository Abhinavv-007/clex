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
  let prevState: TransferState = 'idle'
  let registered = false

  // Eagerly register this client's chain ID
  void (async () => {
    const chainId = getChainId()
    await client.register(chainId)
    registered = true
  })()

  const unsub = transferStore.subscribe(async store => {
    const { state, method, roomCode } = store

    // No-op when state hasn't changed
    if (state === prevState) return
    const prev = prevState
    prevState = state

    // ── Session creation: idle/failed → waiting_peer (sender starts sending) ──
    if (state === 'waiting_peer' && (prev === 'idle' || prev === 'preparing' || prev === 'failed')) {
      // Avoid double-creating if already have a session for this transfer
      if (active?.route === method) return

      const chainId = getChainId()
      if (!registered) await client.register(chainId)

      // Build file metadata — hash all blobs concurrently
      const files = get(filesStore)
      let chainFiles: ChainFile[] = []
      try {
        chainFiles = await Promise.all(
          files.map(async f => {
            const blob = f.processed?.blob ?? f.file
            const hash = await hashBlob(blob)
            return {
              category: fileCategory(f.type),
              type: f.type || 'application/octet-stream',
              size: f.size,
              hash,
            }
          })
        )
      } catch {
        // If hashing fails, use placeholder hashes — don't block the transfer
        chainFiles = files.map(f => ({
          category: fileCategory(f.type),
          type: f.type || 'application/octet-stream',
          size: f.size,
          hash: '0'.repeat(64),
        }))
      }

      if (chainFiles.length === 0) return

      const route = method === 'drive' ? 'drive' : method === 'local' ? 'local' : 'webrtc'
      const result = await client.createSession(chainId, route, chainFiles)
      if (result) {
        active = { sessionId: result.session_id, route, startedAt: Date.now() }
        // Append the initial waiting_peer event
        void client.appendEvent(result.session_id, 'waiting_peer')
      }
      return
    }

    // ── Event appends for subsequent state transitions ──────────────────────
    if (!active) return

    const chainStatus = STATE_TO_CHAIN[state]
    if (!chainStatus) return

    void client.appendEvent(active.sessionId, chainStatus)

    // Clear session on terminal states
    if (['completed', 'failed', 'cancelled', 'abandoned'].includes(chainStatus)) {
      active = null
    }
  })

  return unsub
}

export function createChainClient(baseUrl: string): ChainClient {
  return new ChainClient(baseUrl)
}

export { ChainClient }
