import { normalizeStunServerUrls } from './network'

export interface TransferFile {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}

export type TransferProfile = 'webrtc' | 'local'
export type ConnectionKind = 'lan' | 'internet' | 'unknown'

export interface IceCandidatePayload {
  candidate: string
  sdpMid?: string | null
  sdpMLineIndex?: number | null
  usernameFragment?: string | null
}

export const CHUNK_SIZE = 64 * 1024 // 64 KB — safe for WebRTC DataChannel
export const DC_LABEL = 'clex-transfer'

// DataChannel message types (JSON control messages)
export type DCControlMessage =
  | { type: 'file-start'; fileId: string; name: string; mimeType: string; totalChunks: number; totalSize: number }
  | { type: 'file-end'; fileId: string }
  | { type: 'transfer-complete' }

export interface RTCConfig {
  iceServers: RTCIceServer[]
}

export function getDefaultRTCConfig(): RTCConfig {
  const raw =
    typeof window !== 'undefined'
      ? (import.meta.env.PUBLIC_STUN_SERVERS as string | undefined)
      : undefined
  const iceServers = normalizeStunServerUrls(raw).map(url => ({ urls: url }))
  return { iceServers }
}
