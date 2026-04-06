export interface Env {
  DB: D1Database
  LEDGER: DurableObjectNamespace
  ALLOWED_ORIGIN: string
}

export interface TransferFile {
  category: string  // 'image' | 'pdf' | 'document' | 'archive' | 'video' | 'audio' | 'other'
  type: string      // MIME type — never a filename
  size: number      // bytes
  hash: string | null // SHA-256 hex of file content when available
}

export type TransferStatus =
  | 'registered'
  | 'waiting_peer'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'abandoned'

const FINAL_STATUSES = new Set<string>(['completed', 'cancelled', 'failed', 'abandoned'])

export function isFinalStatus(status: string): boolean {
  return FINAL_STATUSES.has(status)
}

export const VALID_STATUSES = [
  'registered', 'waiting_peer', 'connecting', 'transferring',
  'completed', 'cancelled', 'failed', 'abandoned',
] as const

export const VALID_ROUTES = ['webrtc', 'local', 'drive'] as const

export type D1Row = Record<string, string | number | null>
