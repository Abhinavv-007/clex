/**
 * y-webrtc signalling.
 *
 * Vault's cross-device sync uses yjs over y-webrtc, and `initSync()` points
 * y-webrtc's `WebrtcProvider` at this same worker. But y-webrtc speaks its own
 * protocol at the root path, while this worker only ever served `/room/:code`
 * with the transfer protocol — so the upgrade returned 404, every connection
 * failed its handshake, and Vault sync silently never connected. It had never
 * worked in production, despite "Paired-device sync" being advertised on the
 * site.
 *
 * The protocol is four client messages:
 *
 *   {type:'subscribe',   topics:[...]}   join those topics
 *   {type:'unsubscribe', topics:[...]}   leave them
 *   {type:'publish',     topic, ...}     broadcast to the topic's other members
 *   {type:'ping'}                        → {type:'pong'}
 *
 * Routing lives in `topic-router.ts` so it can be tested without a socket.
 */

import { TopicRouter, type TopicMember } from './topic-router'

/** Frames larger than this are dropped rather than parsed. */
const MAX_MESSAGE_BYTES = 128 * 1024

type ClientMessage =
  | { type: 'subscribe'; topics?: unknown }
  | { type: 'unsubscribe'; topics?: unknown }
  | { type: 'publish'; topic?: unknown; [k: string]: unknown }
  | { type: 'ping' }

export class YjsSignalRoom implements DurableObject {
  private readonly router = new TopicRouter<WebSocket & TopicMember>()

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket & TopicMember]
    server.accept()
    this.router.add(server)

    server.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(server, event.data)
    })

    const close = () => {
      this.router.remove(server)
      try { server.close() } catch { /* already closed */ }
    }
    server.addEventListener('close', close)
    server.addEventListener('error', close)

    return new Response(null, { status: 101, webSocket: client })
  }

  private handleMessage(socket: WebSocket & TopicMember, raw: unknown): void {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return

    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      return // a malformed frame is ignored rather than closing the socket
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return

    switch (msg.type) {
      case 'subscribe':
        this.router.subscribe(socket, msg.topics)
        return
      case 'unsubscribe':
        this.router.unsubscribe(socket, msg.topics)
        return
      case 'publish':
        this.router.publish(socket, msg.topic, raw)
        return
      case 'ping':
        try {
          socket.send(JSON.stringify({ type: 'pong' }))
        } catch {
          this.router.remove(socket)
        }
        return
      default:
        // Unknown types are ignored, which is what lets the protocol grow.
        return
    }
  }
}
