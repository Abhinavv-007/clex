export type TransferRole = 'sender' | 'receiver'
export type TransferProfile = 'webrtc' | 'local'
export type RoomErrorCode = 'ROOM_FULL' | 'INVALID_ROLE' | 'NO_PEER'

export interface IceCandidatePayload {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

// ─── Client → Server ─────────────────────────────────────────────────────────
export type ClientMessage =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidatePayload }
  | { type: 'ping' }

// ─── Server → Client ─────────────────────────────────────────────────────────
export type ServerMessage =
  | { type: 'joined'; role: TransferRole; mode: TransferProfile }
  | { type: 'peer_joined'; mode: TransferProfile; peerChainId?: string }
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'ice'; candidate: IceCandidatePayload }
  | { type: 'peer_left' }
  | { type: 'error'; code: RoomErrorCode }
  | { type: 'pong' }

export interface Env {
  ROOMS: DurableObjectNamespace
  ALLOWED_ORIGIN: string
}
