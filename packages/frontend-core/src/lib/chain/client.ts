/**
 * Clex Chain API client
 *
 * Thin fetch wrapper for the chain ledger worker.
 * All calls are fire-and-forget — never blocks the transfer flow.
 */

export interface ChainFile {
  category: string
  type: string
  size: number
  hash: string
}

export interface CreateSessionResult {
  session_id: string
  ledger_index: number
}

export interface ExplorerSession {
  id: string
  sender_chain_id: string
  receiver_chain_id: string | null
  route: string
  files: ChainFile[]
  status: string
  started_at: number
  completed_at: number | null
  duration_ms: number | null
  ledger_index: number
  record_hash: string
}

export interface ExplorerResponse {
  sessions: ExplorerSession[]
  total: number
  page: number
  limit: number
}

export interface ChainEntry {
  id: string
  first_seen: number
  last_seen: number
  transfer_count: number
}

export interface ChainsResponse {
  chains: ChainEntry[]
  total: number
  page: number
  limit: number
}

export interface ChainStats {
  total_sessions: number
  total_chains: number
  completed_sessions: number
}

export interface SessionDetail extends ExplorerSession {
  previous_hash: string
  events: Array<{ id: number; status: string; ts: number }>
}

export class ChainClient {
  private readonly base: string

  constructor(baseUrl: string) {
    // Strip trailing slash
    this.base = baseUrl.replace(/\/$/, '')
  }

  // ── Write APIs (fire-and-forget) ──────────────────────────────────────────

  async register(chainId: string): Promise<void> {
    await this.post('/chain/register', { chain_id: chainId })
  }

  async createSession(
    senderChainId: string,
    route: string,
    files: ChainFile[]
  ): Promise<CreateSessionResult | null> {
    const res = await this.post('/chain/session', {
      sender_chain_id: senderChainId,
      route,
      files,
    })
    if (!res) return null
    return res as CreateSessionResult
  }

  async appendEvent(
    sessionId: string,
    status: string,
    receiverChainId?: string
  ): Promise<void> {
    await this.post(`/chain/session/${sessionId}/event`, {
      status,
      ...(receiverChainId ? { receiver_chain_id: receiverChainId } : {}),
    })
  }

  // ── Read APIs ─────────────────────────────────────────────────────────────

  async getExplorer(page = 1, limit = 20): Promise<ExplorerResponse> {
    const res = await this.get(`/chain/explorer?page=${page}&limit=${limit}`)
    return (res ?? { sessions: [], total: 0, page, limit }) as ExplorerResponse
  }

  async getSession(sessionId: string): Promise<SessionDetail | null> {
    const res = await this.get(`/chain/session/${sessionId}`)
    return res as SessionDetail | null
  }

  async getChains(page = 1, limit = 20): Promise<ChainsResponse> {
    const res = await this.get(`/chain/chains?page=${page}&limit=${limit}`)
    return (res ?? { chains: [], total: 0, page, limit }) as ChainsResponse
  }

  async getStats(): Promise<ChainStats> {
    const res = await this.get('/chain/stats')
    return (res ?? { total_sessions: 0, total_chains: 0, completed_sessions: 0 }) as ChainStats
  }

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  private async post(path: string, body: unknown): Promise<unknown> {
    try {
      const res = await fetch(`${this.base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return null
      return res.json()
    } catch {
      // Never surface network errors to the caller
      return null
    }
  }

  private async get(path: string): Promise<unknown> {
    try {
      const res = await fetch(`${this.base}${path}`)
      if (!res.ok) return null
      return res.json()
    } catch {
      return null
    }
  }
}

/** Compute SHA-256 of a Blob without streaming it fully into memory as a string. */
export async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Classify a MIME type into a display category. */
export function fileCategory(mimeType: string): string {
  if (!mimeType) return 'other'
  if (mimeType.startsWith('image/'))  return 'image'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('video/'))  return 'video'
  if (mimeType.startsWith('audio/'))  return 'audio'
  if ([
    'application/zip', 'application/x-zip-compressed',
    'application/x-tar', 'application/gzip', 'application/x-bzip2',
    'application/x-7z-compressed',
  ].includes(mimeType)) return 'archive'
  if ([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown',
  ].includes(mimeType)) return 'document'
  return 'other'
}
