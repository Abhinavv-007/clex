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

// Monotonic precedence so out-of-order or duplicate event posts can never
// regress a session's status (e.g. a late "connecting" can't overwrite "completed").
// All terminal statuses share the highest rank — once any terminal state is
// recorded it stays sticky.
const STATUS_RANK: Record<string, number> = {
  registered:   0,
  waiting_peer: 1,
  connecting:   2,
  transferring: 3,
  completed:    4,
  cancelled:    4,
  failed:       4,
  abandoned:    4,
}

export function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 0
}

export function shouldAdvanceStatus(current: string, next: string): boolean {
  // Terminal status is sticky.
  if (isFinalStatus(current)) return false
  return statusRank(next) > statusRank(current)
}

// Statuses strictly below the given rank — used to build atomic UPDATE
// guards. The current status must be in this set for the update to
// commit, which prevents two concurrent requests from regressing each
// other (e.g. a late "transferring" overwriting a "completed" because
// both read the same pre-update status before either UPDATE landed).
export function statusesBelow(status: string): string[] {
  const rank = statusRank(status)
  return Object.keys(STATUS_RANK).filter(s => STATUS_RANK[s] < rank)
}

export const VALID_ROUTES = ['webrtc', 'local', 'drive'] as const

export type D1Row = Record<string, string | number | null>
