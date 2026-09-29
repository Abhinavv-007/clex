/**
 * Vault account sync.
 *
 * Signed in with Google, a Vault follows its owner to every device. Two
 * things make that work, both behind a verified Firebase ID token:
 *
 *   GET  /vault/api/account/key   the account's Vault key: 32 random bytes,
 *                                 made on first use and kept in D1. Every
 *                                 device signed in to the account gets the
 *                                 same key, so they read the same notes.
 *   GET  /vault/api/sync?since=N  items changed after cursor N
 *   POST /vault/api/sync          push changed items; newer wins
 *
 * An item is one note or folder, or the fact that one was deleted. Its
 * payload is encrypted in the browser with the account key before it is
 * sent; this worker stores and returns ciphertext and never decrypts it.
 * What it can see is the item's kind, a random id, timestamps and size.
 *
 * Conflicts are resolved per item, last writer wins by the client's
 * updatedAt. Every accepted write takes the next number in the account's
 * sequence, which is the cursor a device pulls from.
 */

import { requireOwner } from './auth'
import type { Env } from './index'

type Cors = Record<string, string>

/** Items per push, and per pull page. */
const MAX_BATCH = 200
/** One encrypted note, at most. Notes are markdown; attachments are not synced here. */
const MAX_PAYLOAD = 256 * 1024
/** Everything one account may keep. */
const MAX_ITEMS = 20_000
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const KINDS = new Set(['note', 'folder'])

export interface SyncItem {
  kind: 'note' | 'folder'
  id: string
  updatedAt: number
  deleted: boolean
  payload: string | null
}

interface SyncRow {
  kind: string
  id: string
  updated_at: number
  deleted: number
  payload: string | null
  seq: number
}

function json(data: unknown, status: number, cors: Cors): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...cors },
  })
}

const fail = (error: string, status: number, cors: Cors) => json({ error }, status, cors)

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin)
}

/**
 * Validates one pushed item. Returns the clean item or a reason.
 * Exported for tests.
 */
export function readItem(raw: unknown): SyncItem | string {
  if (!raw || typeof raw !== 'object') return 'item must be an object'
  const it = raw as Record<string, unknown>
  if (typeof it.kind !== 'string' || !KINDS.has(it.kind)) return 'kind must be note or folder'
  if (typeof it.id !== 'string' || !ID_RE.test(it.id)) return 'id is not valid'
  if (typeof it.updatedAt !== 'number' || !Number.isFinite(it.updatedAt) || it.updatedAt <= 0) return 'updatedAt must be a timestamp'
  // A clock far in the future would win every conflict forever.
  if (it.updatedAt > Date.now() + 24 * 60 * 60 * 1000) return 'updatedAt is in the future'
  const deleted = it.deleted === true
  if (deleted) {
    return { kind: it.kind as SyncItem['kind'], id: it.id, updatedAt: Math.floor(it.updatedAt), deleted: true, payload: null }
  }
  if (typeof it.payload !== 'string' || !it.payload) return 'payload is required'
  if (it.payload.length > MAX_PAYLOAD) return 'payload is too large'
  return { kind: it.kind as SyncItem['kind'], id: it.id, updatedAt: Math.floor(it.updatedAt), deleted: false, payload: it.payload }
}

/** GET /vault/api/account/key */
export async function handleAccountKey(req: Request, env: Env, cors: Cors): Promise<Response> {
  const auth = await requireOwner(req, env)
  if (!auth.ok) return fail(auth.error, auth.status, cors)
  const uid = auth.owner.uid

  const existing = await env.DB.prepare('SELECT key_b64, created_at FROM vault_accounts WHERE uid = ?1')
    .bind(uid)
    .first<{ key_b64: string; created_at: number }>()
  if (existing) return json({ key: existing.key_b64, createdAt: existing.created_at }, 200, cors)

  // First device on this account: make the key. INSERT OR IGNORE and read
  // back, so two devices signing in at once still end up with one key.
  await env.DB.prepare('INSERT OR IGNORE INTO vault_accounts (uid, key_b64) VALUES (?1, ?2)')
    .bind(uid, randomKey())
    .run()
  const row = await env.DB.prepare('SELECT key_b64, created_at FROM vault_accounts WHERE uid = ?1')
    .bind(uid)
    .first<{ key_b64: string; created_at: number }>()
  if (!row) return fail('Could not create the Vault key', 500, cors)
  return json({ key: row.key_b64, createdAt: row.created_at, created: true }, 201, cors)
}

/** GET /vault/api/sync?since=N */
export async function handleSyncPull(req: Request, env: Env, cors: Cors): Promise<Response> {
  const auth = await requireOwner(req, env)
  if (!auth.ok) return fail(auth.error, auth.status, cors)
  const uid = auth.owner.uid

  const url = new URL(req.url)
  const since = Math.max(0, Math.floor(Number(url.searchParams.get('since')) || 0))
  const { results } = await env.DB.prepare(
    `SELECT kind, id, updated_at, deleted, payload, seq FROM vault_items
     WHERE uid = ?1 AND seq > ?2 ORDER BY seq ASC LIMIT ?3`,
  )
    .bind(uid, since, MAX_BATCH + 1)
    .all<SyncRow>()
  const rows = results ?? []
  const more = rows.length > MAX_BATCH
  const page = more ? rows.slice(0, MAX_BATCH) : rows
  const cursor = page.length ? page[page.length - 1].seq : since
  return json({
    items: page.map((r) => ({
      kind: r.kind,
      id: r.id,
      updatedAt: r.updated_at,
      deleted: r.deleted === 1,
      payload: r.payload,
    })),
    cursor,
    more,
  }, 200, cors)
}

/** POST /vault/api/sync  { items: SyncItem[] } */
export async function handleSyncPush(req: Request, env: Env, cors: Cors): Promise<Response> {
  const auth = await requireOwner(req, env)
  if (!auth.ok) return fail(auth.error, auth.status, cors)
  const uid = auth.owner.uid

  let body: { items?: unknown }
  try { body = await req.json() } catch { return fail('Invalid JSON', 400, cors) }
  if (!Array.isArray(body.items)) return fail('items must be an array', 400, cors)
  if (body.items.length > MAX_BATCH) return fail(`At most ${MAX_BATCH} items per push`, 413, cors)

  const items: SyncItem[] = []
  for (const raw of body.items) {
    const item = readItem(raw)
    if (typeof item === 'string') return fail(item, 400, cors)
    items.push(item)
  }
  if (!items.length) return json({ accepted: 0, cursor: null }, 200, cors)

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM vault_items WHERE uid = ?1')
    .bind(uid)
    .first<{ n: number }>()
  if ((count?.n ?? 0) + items.length > MAX_ITEMS) return fail('This Vault is full', 413, cors)

  // Newer wins. Each accepted write takes the account's next sequence number,
  // computed inside the statement so concurrent pushes cannot share one.
  const upsert = env.DB.prepare(
    `INSERT INTO vault_items (uid, kind, id, updated_at, deleted, payload, seq)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, (SELECT COALESCE(MAX(seq), 0) + 1 FROM vault_items WHERE uid = ?1))
     ON CONFLICT (uid, kind, id) DO UPDATE SET
       updated_at = excluded.updated_at,
       deleted = excluded.deleted,
       payload = excluded.payload,
       seq = excluded.seq
     WHERE excluded.updated_at > vault_items.updated_at`,
  )
  const results = await env.DB.batch(
    items.map((it) => upsert.bind(uid, it.kind, it.id, it.updatedAt, it.deleted ? 1 : 0, it.payload)),
  )
  const accepted = results.reduce((n, r) => n + (r.meta?.changes ? 1 : 0), 0)
  const top = await env.DB.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM vault_items WHERE uid = ?1')
    .bind(uid)
    .first<{ seq: number }>()
  return json({ accepted, cursor: top?.seq ?? 0 }, 200, cors)
}
