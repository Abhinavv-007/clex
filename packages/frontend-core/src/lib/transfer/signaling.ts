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

const SIGNALING_HEALTH_TIMEOUT_MS = 2_500
const DEFAULT_SIGNALING_PORT = '8787'
const LIVE_SIGNALING_HOST = 'clex-signaling-prod.abhnv.workers.dev'

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

function getDefaultHostedSignalingUrl(protocol: 'ws:' | 'wss:', hostname: string): string | null {
  const normalized = hostname.toLowerCase().replace(/^www\./, '')
  if (normalized === 'clex.in') {
    return `${protocol}//${LIVE_SIGNALING_HOST}`
  }

  return null
}

export function getSignalingBaseUrl(configuredUrl?: string): string {
  if (typeof window === 'undefined') {
    return configuredUrl ?? `ws://localhost:${DEFAULT_SIGNALING_PORT}`
  }

  const fallbackProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const pageHostname = window.location.hostname
  const fallbackUrl =
    getDefaultHostedSignalingUrl(fallbackProtocol, pageHostname) ??
    `${fallbackProtocol}//${pageHostname}:${DEFAULT_SIGNALING_PORT}`
  if (!configuredUrl) return fallbackUrl

  try {
    const resolved = new URL(configuredUrl)

    if (isLocalHostname(pageHostname) && isLocalHostname(resolved.hostname) && resolved.hostname !== pageHostname) {
      resolved.hostname = pageHostname
    }

    return resolved.toString().replace(/\/$/, '')
  } catch {
    return configuredUrl
  }
}

function getHealthUrl(roomUrl: string): string | null {
  try {
    const url = new URL(roomUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = '/health'
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

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
        void this.rejectInitialJoin()
        this.emit({ type: 'error', code: 'WS_ERROR' })
      }

      ws.onclose = (event) => {
        this.stopPing()
        if (this.joinedReject) {
          void this.rejectInitialJoin(event.code)
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

  private async rejectInitialJoin(closeCode?: number): Promise<void> {
    const reject = this.joinedReject
    if (!reject) return

    this.joinedResolve = null
    this.joinedReject = null
    reject(await this.createConnectionError(closeCode))
  }

  private async createConnectionError(closeCode?: number): Promise<Error> {
    const healthUrl = getHealthUrl(this.url)
    if (!healthUrl) {
      return new Error('Signaling WebSocket connection failed. Check PUBLIC_SIGNALING_URL.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SIGNALING_HEALTH_TIMEOUT_MS)

    try {
      const response = await fetch(healthUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (response.ok) {
        return new Error(
          closeCode
            ? `Signaling server is reachable, but the WebSocket handshake still failed (close code ${closeCode}). Check PUBLIC_SIGNALING_URL and signaling ALLOWED_ORIGIN.`
            : 'Signaling server is reachable, but the WebSocket handshake failed. Check PUBLIC_SIGNALING_URL and signaling ALLOWED_ORIGIN.'
        )
      }
    } catch {
      clearTimeout(timeout)
      return new Error(
        'Signaling server is unreachable. Start it with pnpm dev (or pnpm dev:signal) and verify PUBLIC_SIGNALING_URL points at the signaling server for this device.'
      )
    }

    return new Error(
      'Signaling server health check failed. Verify PUBLIC_SIGNALING_URL and signaling ALLOWED_ORIGIN, then restart pnpm dev.'
    )
  }
}
