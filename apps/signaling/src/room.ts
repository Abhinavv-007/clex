import { normalizeRequestedMode, planJoin } from './room-session'
import type { ClientMessage, ServerMessage, TransferProfile, TransferRole } from './types'

const ROOM_TTL_MS = 30 * 60 * 1000 // 30 minutes
const ROOM_MODE_KEY = 'mode'
const CHAIN_TAG_PREFIX = 'chain:'
const CHAIN_ID_RE = /^[0-9a-f]{32}$/

function normalizeChainId(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  return CHAIN_ID_RE.test(trimmed) ? trimmed : null
}

function extractChainId(tags: readonly string[]): string | undefined {
  for (const tag of tags) {
    if (tag.startsWith(CHAIN_TAG_PREFIX)) return tag.slice(CHAIN_TAG_PREFIX.length)
  }
  return undefined
}

export class Room implements DurableObject {
  private state: DurableObjectState
  private roomMode: TransferProfile | null = null

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const url = new URL(request.url)
    const role = url.searchParams.get('role') as TransferRole | null
    if (role !== 'sender' && role !== 'receiver') {
      return new Response('role query param must be sender or receiver', { status: 400 })
    }

    const requestedMode = normalizeRequestedMode(url.searchParams.get('mode'))
    const currentMode = await this.readRoomMode()
    const joinPlan = planJoin(this.getPresence(), role, requestedMode, currentMode)
    if (!joinPlan.ok) {
      return new Response(joinPlan.code, { status: 409 })
    }

    await this.writeRoomMode(joinPlan.mode)

    // Optional chain ID for the public ledger — opaque, no PII.
    const chainId = normalizeChainId(url.searchParams.get('chainId'))

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]

    // Hibernatable WebSocket API — survives DO hibernation. Tags are persisted with the WS.
    const tags = chainId ? [role, `${CHAIN_TAG_PREFIX}${chainId}`] : [role]
    this.state.acceptWebSocket(server, tags)

    // Confirm join to new client
    this.send(server, { type: 'joined', role, mode: joinPlan.mode })

    // Notify both peers when the room becomes complete. Each side learns the OTHER
    // peer's chain ID (if shared) so the public ledger can record receiver_chain_id
    // without depending on data-channel timing.
    if (joinPlan.becameReady) {
      const sockets = this.state.getWebSockets()
      sockets.forEach(ws => {
        const peerWs = sockets.find(other => other !== ws)
        const peerChainId = peerWs ? extractChainId(this.state.getTags(peerWs)) : undefined
        this.send(ws, { type: 'peer_joined', mode: joinPlan.mode, ...(peerChainId ? { peerChainId } : {}) })
      })
    }

    await this.refreshRoomTtl()

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return

    let msg: ClientMessage
    try {
      msg = JSON.parse(message) as ClientMessage
    } catch {
      return
    }

    const tags = this.state.getTags(ws)
    const myRole = tags[0] as 'sender' | 'receiver'
    const peerRole = myRole === 'sender' ? 'receiver' : 'sender'
    const peers = this.getWebSocketsByRole(peerRole)

    switch (msg.type) {
      case 'offer':
      case 'answer':
      case 'ice':
        if (peers.length === 0) {
          this.send(ws, { type: 'error', code: 'NO_PEER' })
        } else {
          // Relay SDP/ICE opaquely to the peer
          peers.forEach(peer => peer.send(message))
        }
        await this.refreshRoomTtl()
        break

      case 'ping':
        this.send(ws, { type: 'pong' })
        await this.refreshRoomTtl()
        break
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    await this.handleDisconnect(ws)
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    await this.handleDisconnect(ws)
  }

  async alarm(): Promise<void> {
    // Expire: close all open sockets and let the DO clean up
    const all = this.state.getWebSockets()
    all.forEach(ws => {
      try { ws.close(1001, 'Room expired') } catch { /* already closed */ }
    })
    await this.clearRoomMode()
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const tags = this.state.getTags(ws)
    const closedRole = tags[0] as TransferRole | undefined
    if (!closedRole) return

    const peerRole = closedRole === 'sender' ? 'receiver' : 'sender'

    // Notify peer
    const peers = this.getWebSocketsByRole(peerRole)
    peers.forEach(peer => {
      try { this.send(peer, { type: 'peer_left' }) } catch { /* already closed */ }
    })

    if (this.state.getWebSockets().length === 0) {
      await this.clearRoomMode()
      await this.state.storage.deleteAlarm()
      return
    }

    await this.refreshRoomTtl()
  }

  private getWebSocketsByRole(role: TransferRole): WebSocket[] {
    return this.state.getWebSockets(role)
  }

  private getPresence(): { sender: number; receiver: number } {
    return {
      sender: this.getWebSocketsByRole('sender').length,
      receiver: this.getWebSocketsByRole('receiver').length,
    }
  }

  private async refreshRoomTtl(): Promise<void> {
    await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS)
  }

  private async readRoomMode(): Promise<TransferProfile | null> {
    if (this.roomMode !== null) return this.roomMode
    const stored = await this.state.storage.get<TransferProfile>(ROOM_MODE_KEY)
    this.roomMode = stored ?? null
    return this.roomMode
  }

  private async writeRoomMode(mode: TransferProfile): Promise<void> {
    this.roomMode = mode
    await this.state.storage.put(ROOM_MODE_KEY, mode)
  }

  private async clearRoomMode(): Promise<void> {
    this.roomMode = null
    await this.state.storage.delete(ROOM_MODE_KEY)
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch { /* ws may be closing */ }
  }
}
