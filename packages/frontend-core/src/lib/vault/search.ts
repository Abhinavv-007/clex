/**
 * Vault Full-Text Search
 *
 * A simple in-memory inverted index over decrypted note titles and bodies.
 * Built entirely from decrypted content — never stored, rebuilt on each load.
 * Results are ranked by term frequency; matching text is highlighted.
 */

export interface SearchEntry {
  id: string
  title: string
  body: string
  tags: string[]
  updatedAt: number
}

export interface SearchResult {
  id: string
  score: number
  titleHighlight: string
  snippet: string // short excerpt around first match
}

type InvertedIndex = Map<string, Set<string>> // token -> set of note IDs

let index: InvertedIndex = new Map()
let entries: Map<string, SearchEntry> = new Map()

// ── Tokenizer ─────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)
}

// ── Index Management ──────────────────────────────────────────────────────────

export function buildSearchIndex(notes: SearchEntry[]): void {
  index = new Map()
  entries = new Map()

  for (const note of notes) {
    entries.set(note.id, note)
    const tokens = [
      ...tokenize(note.title),
      ...tokenize(note.body),
      ...note.tags.flatMap(t => tokenize(t)),
    ]
    for (const token of tokens) {
      if (!index.has(token)) index.set(token, new Set())
      index.get(token)!.add(note.id)
    }
  }
}

export function addToIndex(note: SearchEntry): void {
  entries.set(note.id, note)
  const tokens = [
    ...tokenize(note.title),
    ...tokenize(note.body),
    ...note.tags.flatMap(t => tokenize(t)),
  ]
  for (const token of tokens) {
    if (!index.has(token)) index.set(token, new Set())
    index.get(token)!.add(note.id)
  }
}

export function removeFromIndex(id: string): void {
  entries.delete(id)
  for (const ids of index.values()) ids.delete(id)
}

export function updateInIndex(note: SearchEntry): void {
  removeFromIndex(note.id)
  addToIndex(note)
}

// ── Search ────────────────────────────────────────────────────────────────────

function highlight(text: string, terms: string[]): string {
  if (!terms.length) return text
  const pattern = new RegExp(`(${terms.map(t => escapeRe(t)).join('|')})`, 'gi')
  return text.replace(pattern, '<mark>$1</mark>')
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSnippet(body: string, terms: string[], maxLen = 160): string {
  const lower = body.toLowerCase()
  let bestPos = 0
  for (const term of terms) {
    const pos = lower.indexOf(term.toLowerCase())
    if (pos !== -1) { bestPos = Math.max(0, pos - 40); break }
  }
  const raw = body.slice(bestPos, bestPos + maxLen)
  const trimmed = (bestPos > 0 ? '…' : '') + raw + (bestPos + maxLen < body.length ? '…' : '')
  return highlight(trimmed, terms)
}

export function search(query: string, limit = 20): SearchResult[] {
  const terms = tokenize(query)
  if (!terms.length) return []

  // Score each note: +1 per term found, weighted by field
  const scores = new Map<string, number>()

  for (const term of terms) {
    // Exact match
    const exactIds = index.get(term)
    if (exactIds) {
      for (const id of exactIds) {
        const entry = entries.get(id)
        if (!entry) continue
        const titleTokens = tokenize(entry.title)
        const boost = titleTokens.includes(term) ? 3 : 1
        scores.set(id, (scores.get(id) ?? 0) + boost)
      }
    }

    // Prefix match
    for (const [token, ids] of index) {
      if (token !== term && token.startsWith(term)) {
        for (const id of ids) {
          scores.set(id, (scores.get(id) ?? 0) + 0.5)
        }
      }
    }
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => {
      const entry = entries.get(id)!
      return {
        id,
        score,
        titleHighlight: highlight(entry.title, terms),
        snippet: buildSnippet(entry.body, terms),
      }
    })
}

export function clearIndex(): void {
  index = new Map()
  entries = new Map()
}
