import type { IceCandidatePayload, TransferProfile } from './types'

// ─── Signaling message types (mirrors apps/signaling/src/types.ts) ───────────
export type ClientMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidatePayload }
  | { type: 'ping' }

export type ServerMessage =
  | { type: 'joined'; role: 'sender' | 'receiver'; mode: TransferProfile }
  | { type: 'peer_joined'; mode: TransferProfile }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidatePayload }
  | { type: 'peer_left' }
  | { type: 'error'; code: string }
  | { type: 'pong' }

export type SignalingEvent = ServerMessage

type SignalingListener = (event: SignalingEvent) => void

export class SignalingClient {
  private ws: WebSocket | null = null
  private listeners: Set<SignalingListener> = new Set()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private readonly url: string
  private joinedResolve: (() => void) | null = null
  private joinedReject: ((e: Error) => void) | null = null

  constructor(baseUrl: string, roomCode: string) {
    this.url = `${baseUrl}/room/${roomCode}`
  }

  connect(role: 'sender' | 'receiver', mode?: TransferProfile): Promise<void> {
    return new Promise((resolve, reject) => {
      this.joinedResolve = resolve
      this.joinedReject = reject

      const params = new URLSearchParams({ role })
      if (mode) params.set('mode', mode)

      const ws = new WebSocket(`${this.url}?${params.toString()}`)
      this.ws = ws

      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        this.startPing()
      }

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data !== 'string') return
        let msg: ServerMessage
        try {
          msg = JSON.parse(event.data) as ServerMessage
        } catch {
          return
        }

        if (msg.type === 'joined') {
          this.joinedResolve?.()
          this.joinedResolve = null
          this.joinedReject = null
        }

        this.emit(msg)
      }

      ws.onerror = () => {
        const err = new Error('Signaling WebSocket connection failed')
        this.joinedReject?.(err)
        this.joinedResolve = null
        this.joinedReject = null
        this.emit({ type: 'error', code: 'WS_ERROR' })
      }

      ws.onclose = (event) => {
        this.stopPing()
        if (this.joinedReject) {
          this.joinedReject(new Error(`WebSocket closed: ${event.code}`))
          this.joinedResolve = null
          this.joinedReject = null
          return
        }
        // Notify listeners as a peer_left event
        this.emit({ type: 'peer_left' })
      }
    })
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  on(listener: SignalingListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  disconnect(): void {
    this.stopPing()
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      try { this.ws.close(1000, 'client disconnect') } catch { /* ignore */ }
      this.ws = null
    }
  }

  private emit(event: SignalingEvent): void {
    this.listeners.forEach(l => {
      try { l(event) } catch { /* ignore listener errors */ }
    })
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => this.send({ type: 'ping' }), 25_000)
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}
