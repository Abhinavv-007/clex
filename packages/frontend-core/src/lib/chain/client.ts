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
  hash: string | null
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
    files: ChainFile[],
    meta?: Record<string, unknown>
  ): Promise<CreateSessionResult | null> {
    const res = await this.post('/chain/session', {
      sender_chain_id: senderChainId,
      route,
      files,
      // `meta` is an additive, optional payload — older Chain workers silently
      // ignore it; newer ones may persist a summary in the future.
      ...(meta ? { meta } : {}),
    })
    if (!res) return null
    return res as CreateSessionResult
  }

  async appendEvent(
    sessionId: string,
    status: string,
    receiverChainId?: string,
    meta?: Record<string, unknown>
  ): Promise<void> {
    await this.post(`/chain/session/${sessionId}/event`, {
      status,
      ...(receiverChainId ? { receiver_chain_id: receiverChainId } : {}),
      ...(meta ? { meta } : {}),
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

// ── File category mappings ────────────────────────────────────────────────
//
// The chain ledger records a coarse, privacy-preserving category for every
// file in a transfer (no filename, no content). We classify by MIME type
// first, then fall back to the file extension when MIME is missing or
// generic ("application/octet-stream") — common for APKs, archives, fonts,
// etc. uploaded from native pickers. Anything we don't recognise becomes
// "other".

const MIME_CATEGORY_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['image/', 'image'],
  ['video/', 'video'],
  ['audio/', 'audio'],
  ['font/',  'font'],
]

const MIME_CATEGORY_EXACT: Record<string, string> = {
  // Documents — PDFs are their own bucket for readability in the explorer.
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/rtf': 'document',
  'text/rtf': 'document',
  // Spreadsheets
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheet',
  // Presentations
  'application/vnd.ms-powerpoint': 'presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
  'application/vnd.oasis.opendocument.presentation': 'presentation',
  // Archives
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-tar': 'archive',
  'application/gzip': 'archive',
  'application/x-bzip2': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/vnd.rar': 'archive',
  // Mobile / desktop apps
  'application/vnd.android.package-archive': 'apk',
  'application/x-msdownload': 'executable',
  'application/x-msi': 'executable',
  'application/x-apple-diskimage': 'executable',
  // Books
  'application/epub+zip': 'ebook',
  'application/x-mobipocket-ebook': 'ebook',
  // Fonts (some browsers send specific subtypes)
  'application/font-woff': 'font',
  'application/font-woff2': 'font',
  'application/x-font-ttf': 'font',
  'application/x-font-otf': 'font',
  // Data
  'application/json': 'data',
  'application/ld+json': 'data',
  'application/xml': 'data',
  'application/x-yaml': 'data',
  'application/sql': 'data',
  // Code / text
  'text/plain': 'text',
  'text/markdown': 'text',
  'text/csv': 'spreadsheet',
  'text/tab-separated-values': 'spreadsheet',
  'text/html': 'code',
  'text/css': 'code',
  'text/javascript': 'code',
  'application/javascript': 'code',
  'application/typescript': 'code',
  'application/x-sh': 'code',
}

const EXTENSION_CATEGORY: Record<string, string> = {
  // Images
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  bmp: 'image', svg: 'image', heic: 'image', heif: 'image', avif: 'image',
  ico: 'image', tiff: 'image', tif: 'image',
  // Video
  mp4: 'video', m4v: 'video', mov: 'video', avi: 'video', mkv: 'video',
  webm: 'video', flv: 'video', wmv: 'video', mpg: 'video', mpeg: 'video',
  '3gp': 'video', '3gpp': 'video',
  // Audio
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', flac: 'audio',
  aac: 'audio', m4a: 'audio', opus: 'audio', wma: 'audio', aiff: 'audio',
  // Documents
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document', pages: 'document',
  // Spreadsheets
  xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet', csv: 'spreadsheet',
  tsv: 'spreadsheet', numbers: 'spreadsheet',
  // Presentations
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation', key: 'presentation',
  // Text
  txt: 'text', md: 'text', markdown: 'text', log: 'text',
  // Code / config
  js: 'code', mjs: 'code', cjs: 'code', ts: 'code', tsx: 'code', jsx: 'code',
  json: 'code', yml: 'code', yaml: 'code', toml: 'code', xml: 'code',
  html: 'code', htm: 'code', css: 'code', scss: 'code', sass: 'code', less: 'code',
  py: 'code', rb: 'code', go: 'code', rs: 'code', java: 'code', kt: 'code',
  c: 'code', h: 'code', cpp: 'code', cc: 'code', hpp: 'code', cs: 'code',
  swift: 'code', php: 'code', sh: 'code', bash: 'code', zsh: 'code',
  sql: 'code', dart: 'code', lua: 'code', r: 'code',
  // Archives
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  bz2: 'archive', xz: 'archive', tgz: 'archive', tbz: 'archive', zst: 'archive',
  // Mobile / desktop apps
  apk: 'apk', aab: 'apk',
  ipa: 'ios',
  exe: 'executable', msi: 'executable', dmg: 'executable', pkg: 'executable',
  deb: 'executable', rpm: 'executable', appimage: 'executable',
  // Books
  epub: 'ebook', mobi: 'ebook', azw: 'ebook', azw3: 'ebook',
  // Fonts
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font', eot: 'font',
  // Design / 3D
  psd: 'design', ai: 'design', sketch: 'design', fig: 'design', xd: 'design',
  obj: 'model', fbx: 'model', gltf: 'model', glb: 'model', stl: 'model',
  blend: 'model',
  // Disk / iso
  iso: 'archive',
}

function getExtension(name: string | undefined): string | null {
  if (!name) return null
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return null
  return name.slice(idx + 1).toLowerCase()
}

const GENERIC_MIMES = new Set([
  '', 'application/octet-stream', 'application/x-binary', 'binary/octet-stream',
])

export function fileCategory(mimeType: string, fileName?: string): string {
  const mime = (mimeType || '').toLowerCase()

  // 1. Specific MIME match (most reliable when present and non-generic)
  if (!GENERIC_MIMES.has(mime)) {
    const exact = MIME_CATEGORY_EXACT[mime]
    if (exact) return exact
    for (const [prefix, category] of MIME_CATEGORY_PREFIXES) {
      if (mime.startsWith(prefix)) return category
    }
  }

  // 2. Extension fallback — handles APKs, fonts, code, etc. when MIME is
  //    generic or missing (common from native file pickers).
  const ext = getExtension(fileName)
  if (ext) {
    const byExt = EXTENSION_CATEGORY[ext]
    if (byExt) return byExt
  }

  // 3. Last-resort prefix sweep for unusual MIMEs (covers e.g. text/x-shellscript)
  if (mime.startsWith('text/')) return 'text'

  return 'other'
}
