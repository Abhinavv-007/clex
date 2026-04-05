// ─── Client → Server ─────────────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'join'; role: 'sender' | 'receiver' }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'ping' }

// ─── Server → Client ─────────────────────────────────────────────────────────
export type ServerMessage =
  | { type: 'joined'; role: 'sender' | 'receiver'; nearby: boolean }
  | { type: 'peer_joined'; nearby: boolean }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'peer_left' }
  | { type: 'error'; code: 'ROOM_FULL' | 'INVALID_ROLE' | 'NO_PEER' }
  | { type: 'pong' }

export interface Env {
  ROOMS: DurableObjectNamespace
  ALLOWED_ORIGIN: string
}
