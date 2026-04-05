export interface TransferFile {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
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
  const stunUrls = raw ?? 'stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478'
  const iceServers = stunUrls.split(',').map(url => ({ urls: url.trim() }))
  return { iceServers }
}
