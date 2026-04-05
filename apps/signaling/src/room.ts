import type { ClientMessage, ServerMessage } from './types'

const ROOM_TTL_MS = 30 * 60 * 1000 // 30 minutes

export class Room implements DurableObject {
  private state: DurableObjectState
  private senderIP: string | null = null
  private receiverIP: string | null = null

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const url = new URL(request.url)
    const role = url.searchParams.get('role') as 'sender' | 'receiver' | null
    if (role !== 'sender' && role !== 'receiver') {
      return new Response('role query param must be sender or receiver', { status: 400 })
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown'

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]

    // Hibernatable WebSocket API — survives DO hibernation
    this.state.acceptWebSocket(server, [role])

    // Store IP by role for nearby detection
    if (role === 'sender') {
      this.senderIP = ip
    } else {
      this.receiverIP = ip
    }

    // Check if the opposite role is already connected
    const existing = this.getWebSocketsByRole(role === 'sender' ? 'receiver' : 'sender')
    const nearby = this.computeNearby()

    // Confirm join to new client
    this.send(server, { type: 'joined', role, nearby })

    // Notify existing peer that a new peer joined
    if (existing.length > 0) {
      existing.forEach(ws => this.send(ws, { type: 'peer_joined', nearby }))
    }

    // Set room expiry alarm on first connection
    const existing_alarm = await this.state.storage.getAlarm()
    if (existing_alarm === null) {
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS)
    }

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
        break

      case 'ping':
        this.send(ws, { type: 'pong' })
        break

      // 'join' is handled at connect time via role query param
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
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const tags = this.state.getTags(ws)
    const closedRole = tags[0] as 'sender' | 'receiver'
    const peerRole = closedRole === 'sender' ? 'receiver' : 'sender'

    // Clear the stored IP for the closed role
    if (closedRole === 'sender') this.senderIP = null
    else this.receiverIP = null

    // Notify peer
    const peers = this.getWebSocketsByRole(peerRole)
    peers.forEach(peer => {
      try { this.send(peer, { type: 'peer_left' }) } catch { /* already closed */ }
    })
  }

  private getWebSocketsByRole(role: 'sender' | 'receiver'): WebSocket[] {
    return this.state.getWebSockets(role)
  }

  private computeNearby(): boolean {
    return (
      this.senderIP !== null &&
      this.receiverIP !== null &&
      this.senderIP !== 'unknown' &&
      this.senderIP === this.receiverIP
    )
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch { /* ws may be closing */ }
  }
}
