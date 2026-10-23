/**
 * /vault/api/admin/* — what the clex.in/admin console reads and controls.
 *
 * This worker owns the data the console is about: API keys, uploads and
 * their bytes, Vault attachments, account sync and secret links. Each route
 * is gated by checkAdmin (adminSession.ts): a signed-in console session, or —
 * for reads only — the lnch.in proxy's X-Admin-Secret.
 *
 * Reads:
 *   GET  summary                      counts, 30-day series, storage, bindings
 *   GET  health                       bindings and storage backend
 *   GET  users?q&kind&limit&offset    everyone with a key, upload, file or Vault
 *   GET  users/:uid                   one user's keys, uploads, files, Vault, devices
 *   GET  keys?status&kind&q&…         API keys
 *   GET  uploads?status&q&…           API uploads (share links)
 *   GET  attachments?q&…              Vault attachments
 *   GET  secrets                      secret-link metadata (never the payload)
 *
 * Controls (session only):
 *   PATCH  keys/:id                   name, rate per minute, max file size
 *   POST   keys/:id/revoke | restore
 *   POST   uploads/:id/revoke         stop the link and delete the bytes
 *   DELETE attachments/:id            delete a Vault attachment
 *   DELETE secrets/:id                burn a secret link
 *   POST   users/:uid/revoke-keys
 *   POST   users/:uid/revoke-uploads
 *   POST   users/:uid/wipe-vault      { confirm: uid }
 *   POST   users/:uid/purge           { confirm: uid } — all of the above, and files
 *   POST   maintenance/cleanup        run the deletion queue now
 */
import type { Env } from './index'
import { checkAdmin } from './adminSession'
import { backendName, isConfigured } from './storage'
import { deleteStored, dropAttachmentRows, runPendingDeletions } from './cleanup'

type Cors = Record<string, string>

const DAY = 86_400
const MAX_FILE_CEILING = 5 * 1024 * 1024 * 1024
const MAX_RATE = 100_000

function json(data: unknown, status: number, cors: Cors): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', ...cors },
  })
}

const fail = (error: string, status: number, cors: Cors) => json({ error }, status, cors)

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number): number {
  const raw = Number.parseInt(url.searchParams.get(name) ?? '', 10)
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, raw))
}

/** A LIKE pattern for a free-text search, with LIKE's own wildcards escaped. */
function likePattern(raw: string | null): string {
  const q = (raw ?? '').trim().slice(0, 120)
  if (!q) return ''
  return `%${q.replace(/[\\%_]/g, ch => `\\${ch}`)}%`
}

async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return await req.json() as T
  } catch {
    return null
  }
}

/** Tables present in this database; migrations are applied by hand, so some may not be. */
async function tables(env: Env): Promise<Set<string>> {
  const { results } = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()
  return new Set((results ?? []).map(r => r.name))
}

async function first<T>(stmt: D1PreparedStatement): Promise<T | null> {
  try {
    return await stmt.first<T>()
  } catch {
    return null
  }
}

async function all<T>(stmt: D1PreparedStatement): Promise<T[]> {
  try {
    const { results } = await stmt.all<T>()
    return results ?? []
  } catch {
    return []
  }
}

async function countKvPrefix(kv: KVNamespace | undefined, prefix: string, maxPages = 5): Promise<{ count: number; capped: boolean }> {
  if (!kv) return { count: 0, capped: false }
  let count = 0
  let cursor: string | undefined
  let pages = 0
  do {
    const page = await kv.list({ prefix, cursor })
    count += page.keys.length
    cursor = page.list_complete ? undefined : page.cursor
    pages += 1
  } while (cursor && pages < maxPages)
  return { count, capped: Boolean(cursor) }
}

const isAnon = (uid: string) => uid.startsWith('anon_')

// ── Summary ───────────────────────────────────────────────────────────────

async function summary(env: Env, cors: Cors): Promise<Response> {
  const now = nowSec()
  const since30 = now - 30 * DAY
  const have = await tables(env)
  const hasVault = have.has('vault_items') && have.has('vault_accounts')

  const usersUnion = [
    'SELECT user_id AS uid FROM api_keys',
    'SELECT user_id FROM api_uploads',
    'SELECT user_id FROM attachments',
    ...(hasVault ? ['SELECT uid FROM vault_accounts'] : []),
  ].join(' UNION ')

  const [keys, uploads, attachments, pending, users, vault, uploadSeries, keySeries, mimes, secrets, topKeys] = await Promise.all([
    first<Record<string, number>>(env.DB.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(revoked_at IS NULL), 0) AS active,
             COALESCE(SUM(substr(user_id, 1, 5) = 'anon_'), 0) AS anon,
             COALESCE(SUM(revoked_at IS NULL AND substr(user_id, 1, 5) = 'anon_'), 0) AS anon_active,
             COALESCE(SUM(created_at >= ?1), 0) AS new_24h,
             COALESCE(SUM(last_used_at >= ?1), 0) AS used_24h,
             COALESCE(SUM(rate_per_minute < 0 AND revoked_at IS NULL), 0) AS unlimited_rate
      FROM api_keys`).bind(now - DAY)),
    first<Record<string, number>>(env.DB.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(revoked_at IS NULL AND expires_at > ?1), 0) AS active,
             COALESCE(SUM(revoked_at IS NOT NULL), 0) AS revoked,
             COALESCE(SUM(revoked_at IS NULL AND expires_at <= ?1), 0) AS expired,
             COALESCE(SUM(size_bytes), 0) AS bytes,
             COALESCE(SUM(CASE WHEN revoked_at IS NULL AND expires_at > ?1 THEN size_bytes END), 0) AS live_bytes,
             COALESCE(SUM(download_count), 0) AS downloads,
             COALESCE(SUM(upload_at >= ?2), 0) AS new_24h
      FROM api_uploads`).bind(now, now - DAY)),
    first<Record<string, number>>(env.DB.prepare(`
      SELECT COUNT(*) AS total,
             COALESCE(SUM(size_bytes), 0) AS bytes,
             COALESCE(SUM(delete_at > ?1), 0) AS live
      FROM attachments`).bind(now)),
    first<Record<string, number>>(env.DB.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(delete_at <= ?1), 0) AS overdue FROM pending_deletions`).bind(now)),
    first<{ n: number }>(env.DB.prepare(`SELECT COUNT(*) AS n FROM (${usersUnion})`)),
    hasVault
      ? first<Record<string, number>>(env.DB.prepare(`
          SELECT (SELECT COUNT(*) FROM vault_accounts) AS accounts,
                 (SELECT COUNT(*) FROM vault_items WHERE deleted = 0) AS items,
                 (SELECT COUNT(*) FROM vault_items WHERE deleted = 0 AND kind = 'note') AS notes,
                 (SELECT COUNT(*) FROM vault_items WHERE deleted = 0 AND kind = 'folder') AS folders,
                 (SELECT COALESCE(SUM(LENGTH(payload)), 0) FROM vault_items WHERE deleted = 0) AS payload_bytes`))
      : Promise.resolve(null),
    all<{ d: string; n: number; b: number }>(env.DB.prepare(`
      SELECT date(upload_at, 'unixepoch') AS d, COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS b
      FROM api_uploads WHERE upload_at >= ?1 GROUP BY d ORDER BY d`).bind(since30)),
    all<{ d: string; n: number }>(env.DB.prepare(`
      SELECT date(created_at, 'unixepoch') AS d, COUNT(*) AS n
      FROM api_keys WHERE created_at >= ?1 GROUP BY d ORDER BY d`).bind(since30)),
    all<{ mime_type: string; n: number; b: number }>(env.DB.prepare(`
      SELECT mime_type, COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS b
      FROM api_uploads GROUP BY mime_type ORDER BY n DESC LIMIT 8`)),
    countKvPrefix(env.VAULT_SECRETS, 'secret:'),
    all<Record<string, unknown>>(env.DB.prepare(`
      SELECT id, name, prefix, user_id, user_email, total_uploads, total_bytes, last_used_at
      FROM api_keys WHERE revoked_at IS NULL AND total_uploads > 0
      ORDER BY total_uploads DESC LIMIT 5`)),
  ])

  // One entry per day for the last 30, so a quiet day reads as zero, not a gap.
  const days: { day: string; uploads: number; bytes: number; keys: number }[] = []
  const up = new Map(uploadSeries.map(r => [r.d, r]))
  const ks = new Map(keySeries.map(r => [r.d, r.n]))
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date((now - i * DAY) * 1000).toISOString().slice(0, 10)
    days.push({ day, uploads: up.get(day)?.n ?? 0, bytes: up.get(day)?.b ?? 0, keys: ks.get(day) ?? 0 })
  }

  return json({
    service: 'clex-vault',
    generatedAt: now,
    users: users?.n ?? 0,
    keys: keys ?? {},
    uploads: uploads ?? {},
    attachments: attachments ?? {},
    pending_deletions: pending ?? {},
    vault: vault ?? null,
    secrets,
    series: days,
    mime_types: mimes,
    top_keys: topKeys.map(k => ({ ...k, kind: isAnon(String(k.user_id)) ? 'anonymous' : 'account' })),
    storage: { backend: backendName(env), configured: isConfigured(env) },
    tables: [...have].sort(),
  }, 200, cors)
}

async function health(env: Env, cors: Cors): Promise<Response> {
  let d1 = false
  try {
    await env.DB.prepare('SELECT 1').first()
    d1 = true
  } catch { /* reported as false */ }
  return json({
    ok: d1,
    service: 'clex-vault',
    ts: nowSec(),
    bindings: {
      d1,
      kv_vault_secrets: typeof env.VAULT_SECRETS?.put === 'function',
      kv_vault_tokens: typeof env.VAULT_TOKENS?.put === 'function',
      kv_vault_signals: typeof env.VAULT_SIGNALS?.put === 'function',
      kv_upload_quota: typeof env.UPLOAD_QUOTA?.put === 'function',
      kv_file_chunks: typeof env.FILE_CHUNKS?.put === 'function',
      r2_files: Boolean(env.FILES),
    },
    storage: { backend: backendName(env), configured: isConfigured(env) },
    config: {
      allowed_origin: env.ALLOWED_ORIGIN ?? null,
      max_secret_size: env.MAX_SECRET_SIZE ?? null,
      firebase_project: env.FIREBASE_PROJECT_ID ?? null,
      admin_secret_set: Boolean(env.CLEX_ADMIN_SECRET || env.ADMIN_SECRET),
      anon_key_secret_set: Boolean(env.ANON_KEY_SECRET),
    },
  }, 200, cors)
}

// ── Users ─────────────────────────────────────────────────────────────────

function userSelect(hasVault: boolean): string {
  const vaultCols = hasVault
    ? `(SELECT COUNT(*) FROM vault_items v WHERE v.uid = ids.uid AND v.deleted = 0) AS vault_items,
       (SELECT va.created_at FROM vault_accounts va WHERE va.uid = ids.uid) AS vault_since,
       COALESCE((SELECT MAX(v.updated_at) / 1000 FROM vault_items v WHERE v.uid = ids.uid), 0) AS vault_last,`
    : `0 AS vault_items, NULL AS vault_since, 0 AS vault_last,`
  const union = [
    'SELECT user_id AS uid FROM api_keys',
    'SELECT user_id FROM api_uploads',
    'SELECT user_id FROM attachments',
    ...(hasVault ? ['SELECT uid FROM vault_accounts'] : []),
  ].join(' UNION ')
  return `
    SELECT * FROM (
      SELECT ids.uid AS uid,
        (SELECT k.user_email FROM api_keys k WHERE k.user_id = ids.uid AND k.user_email IS NOT NULL ORDER BY k.created_at DESC LIMIT 1) AS email,
        (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = ids.uid) AS keys_total,
        (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = ids.uid AND k.revoked_at IS NULL) AS keys_active,
        (SELECT COUNT(*) FROM api_uploads u WHERE u.user_id = ids.uid) AS uploads,
        (SELECT COALESCE(SUM(u.size_bytes), 0) FROM api_uploads u WHERE u.user_id = ids.uid) AS upload_bytes,
        (SELECT COUNT(*) FROM attachments a WHERE a.user_id = ids.uid) AS attachments,
        ${vaultCols}
        COALESCE((SELECT MIN(k.created_at) FROM api_keys k WHERE k.user_id = ids.uid),
                 (SELECT MIN(u.upload_at) FROM api_uploads u WHERE u.user_id = ids.uid),
                 (SELECT MIN(a.upload_at) FROM attachments a WHERE a.user_id = ids.uid)) AS first_seen_raw,
        MAX(
          COALESCE((SELECT MAX(COALESCE(k.last_used_at, k.created_at)) FROM api_keys k WHERE k.user_id = ids.uid), 0),
          COALESCE((SELECT MAX(u.upload_at) FROM api_uploads u WHERE u.user_id = ids.uid), 0),
          COALESCE((SELECT MAX(a.upload_at) FROM attachments a WHERE a.user_id = ids.uid), 0)${hasVault ? `,
          COALESCE((SELECT MAX(v.updated_at) / 1000 FROM vault_items v WHERE v.uid = ids.uid), 0),
          COALESCE((SELECT va.created_at FROM vault_accounts va WHERE va.uid = ids.uid), 0)` : ''}
        ) AS activity_raw
      FROM (${union}) ids
    ) t
    WHERE (?1 = '' OR t.uid LIKE ?1 ESCAPE '\\' OR t.email LIKE ?1 ESCAPE '\\')
      AND (?2 = 'all' OR (?2 = 'anonymous' AND substr(t.uid, 1, 5) = 'anon_') OR (?2 = 'account' AND substr(t.uid, 1, 5) <> 'anon_'))`
}

interface UserRow {
  uid: string
  email: string | null
  keys_total: number
  keys_active: number
  uploads: number
  upload_bytes: number
  attachments: number
  vault_items: number
  vault_since: number | null
  vault_last: number
  first_seen_raw: number | null
  activity_raw: number
}

function shapeUser(r: UserRow) {
  const lastActive = Math.max(r.activity_raw || 0, Math.floor(r.vault_last || 0), r.vault_since || 0) || null
  const firstSeen = [r.first_seen_raw, r.vault_since].filter((v): v is number => typeof v === 'number' && v > 0)
  return {
    uid: r.uid,
    kind: isAnon(r.uid) ? 'anonymous' : 'account',
    email: r.email,
    keys_total: r.keys_total,
    keys_active: r.keys_active,
    uploads: r.uploads,
    upload_bytes: r.upload_bytes,
    attachments: r.attachments,
    vault_items: r.vault_items,
    vault_since: r.vault_since,
    first_seen: firstSeen.length ? Math.min(...firstSeen) : null,
    last_active: lastActive,
  }
}

async function listUsers(url: URL, env: Env, cors: Cors): Promise<Response> {
  const have = await tables(env)
  const hasVault = have.has('vault_items') && have.has('vault_accounts')
  const q = likePattern(url.searchParams.get('q'))
  const kindRaw = url.searchParams.get('kind') ?? 'all'
  const kind = ['all', 'anonymous', 'account'].includes(kindRaw) ? kindRaw : 'all'
  const limit = intParam(url, 'limit', 50, 1, 200)
  const offset = intParam(url, 'offset', 0, 0, 1_000_000)
  const sort = url.searchParams.get('sort') === 'uploads' ? 't.uploads DESC' : 't.activity_raw DESC'

  const base = userSelect(hasVault)
  const [rows, total] = await Promise.all([
    env.DB.prepare(`${base} ORDER BY ${sort} LIMIT ?3 OFFSET ?4`).bind(q, kind, limit, offset).all<UserRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM (${base})`).bind(q, kind).first<{ n: number }>(),
  ])
  const users = (rows.results ?? []).map(shapeUser)
  return json({ total: total?.n ?? 0, limit, offset, users }, 200, cors)
}

const KEY_COLUMNS = `id, user_id, user_email, name, prefix, max_file_bytes, rate_per_minute,
  created_at, last_used_at, total_uploads, total_bytes, revoked_at`
const UPLOAD_COLUMNS = `id, user_id, api_key_id, share_token, filename, size_bytes, mime_type,
  upload_at, expires_at, download_count, revoked_at`

function shapeKey(k: Record<string, unknown>) {
  return { ...k, kind: isAnon(String(k.user_id)) ? 'anonymous' : 'account' }
}

function shapeUpload(u: Record<string, unknown>, now = nowSec()) {
  const status = u.revoked_at ? 'revoked' : Number(u.expires_at) <= now ? 'expired' : 'active'
  return { ...u, status, share_url: `https://clex.in/share/${u.share_token}` }
}

async function userDetail(uid: string, env: Env, cors: Cors): Promise<Response> {
  const have = await tables(env)
  const hasVault = have.has('vault_items') && have.has('vault_accounts')
  const row = await env.DB.prepare(`${userSelect(hasVault)} AND t.uid = ?3`).bind('', 'all', uid).first<UserRow>()
  if (!row) return fail('user_not_found', 404, cors)

  const [keys, uploads, attachments, vault, vaultKinds, devicesRaw, quotaRaw] = await Promise.all([
    all<Record<string, unknown>>(env.DB.prepare(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`).bind(uid)),
    all<Record<string, unknown>>(env.DB.prepare(`SELECT ${UPLOAD_COLUMNS} FROM api_uploads WHERE user_id = ? ORDER BY upload_at DESC LIMIT 100`).bind(uid)),
    all<Record<string, unknown>>(env.DB.prepare(`
      SELECT id, subscription_id, filename, size_bytes, mime_type, upload_at, delete_at
      FROM attachments WHERE user_id = ? ORDER BY upload_at DESC LIMIT 100`).bind(uid)),
    hasVault
      ? first<Record<string, number>>(env.DB.prepare(`
          SELECT COUNT(*) AS items,
                 COALESCE(SUM(deleted = 1), 0) AS tombstones,
                 COALESCE(SUM(CASE WHEN deleted = 0 THEN LENGTH(payload) END), 0) AS payload_bytes,
                 COALESCE(MAX(seq), 0) AS cursor,
                 MAX(updated_at) AS last_updated
          FROM vault_items WHERE uid = ?`).bind(uid))
      : Promise.resolve(null),
    hasVault
      ? all<{ kind: string; n: number }>(env.DB.prepare(
          'SELECT kind, COUNT(*) AS n FROM vault_items WHERE uid = ? AND deleted = 0 GROUP BY kind').bind(uid))
      : Promise.resolve([]),
    env.VAULT_TOKENS.get(`devices:${uid}`),
    env.UPLOAD_QUOTA.get(`upload_quota:${uid}:${new Date().toISOString().slice(0, 10)}`),
  ])

  let devices: unknown[] = []
  try {
    const parsed = devicesRaw ? JSON.parse(devicesRaw) : []
    devices = Array.isArray(parsed)
      ? parsed.map((d: Record<string, unknown>) => ({ id: d.id, name: d.name, lastSeen: d.lastSeen, pairedAt: d.pairedAt }))
      : []
  } catch { /* unreadable device list */ }

  const now = nowSec()
  return json({
    user: shapeUser(row),
    keys: keys.map(shapeKey),
    uploads: uploads.map(u => shapeUpload(u, now)),
    attachments,
    vault: vault ? { ...vault, kinds: Object.fromEntries(vaultKinds.map(k => [k.kind, k.n])) } : null,
    devices,
    quota_today_bytes: quotaRaw ? Number(quotaRaw) || 0 : 0,
  }, 200, cors)
}

// ── Keys ──────────────────────────────────────────────────────────────────

async function listKeys(url: URL, env: Env, cors: Cors): Promise<Response> {
  const status = url.searchParams.get('status') ?? 'active'
  const kind = url.searchParams.get('kind') ?? 'all'
  const q = likePattern(url.searchParams.get('q'))
  const limit = intParam(url, 'limit', 50, 1, 200)
  const offset = intParam(url, 'offset', 0, 0, 1_000_000)

  const where: string[] = []
  const binds: unknown[] = []
  if (status === 'active') where.push('revoked_at IS NULL')
  if (status === 'revoked') where.push('revoked_at IS NOT NULL')
  if (kind === 'anonymous') where.push("substr(user_id, 1, 5) = 'anon_'")
  if (kind === 'account') where.push("substr(user_id, 1, 5) <> 'anon_'")
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' OR prefix LIKE ? ESCAPE '\\' OR user_id LIKE ? ESCAPE '\\' OR user_email LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')")
    binds.push(q, q, q, q, q)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const order = url.searchParams.get('sort') === 'usage' ? 'total_uploads DESC' : 'created_at DESC'

  const [rows, total] = await Promise.all([
    env.DB.prepare(`SELECT ${KEY_COLUMNS} FROM api_keys ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM api_keys ${clause}`).bind(...binds).first<{ n: number }>(),
  ])
  return json({ total: total?.n ?? 0, limit, offset, keys: (rows.results ?? []).map(shapeKey) }, 200, cors)
}

/** Accepts -1 (unlimited) or a whole number within [1, max]. */
function readLimit(value: unknown, max: number): number | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value === -1) return -1
  if (value < 1 || value > max) return null
  return value
}

async function updateKey(id: string, req: Request, env: Env, cors: Cors): Promise<Response> {
  const body = await readBody<{ name?: unknown; ratePerMinute?: unknown; maxFileBytes?: unknown }>(req)
  if (!body) return fail('invalid_json', 400, cors)

  const rate = readLimit(body.ratePerMinute, MAX_RATE)
  const size = readLimit(body.maxFileBytes, MAX_FILE_CEILING)
  if (rate === null) return fail(`ratePerMinute must be -1 or 1-${MAX_RATE}`, 400, cors)
  if (size === null) return fail(`maxFileBytes must be -1 or 1-${MAX_FILE_CEILING}`, 400, cors)
  let name: string | undefined
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return fail('name must be a non-empty string', 400, cors)
    name = body.name.trim().slice(0, 64)
  }

  const existing = await env.DB.prepare(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE id = ?`).bind(id).first<Record<string, unknown>>()
  if (!existing) return fail('key_not_found', 404, cors)

  await env.DB.prepare('UPDATE api_keys SET name = ?, rate_per_minute = ?, max_file_bytes = ? WHERE id = ?')
    .bind(
      name ?? existing.name,
      rate ?? existing.rate_per_minute,
      size ?? existing.max_file_bytes,
      id,
    ).run()
  const updated = await env.DB.prepare(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE id = ?`).bind(id).first<Record<string, unknown>>()
  return json({ ok: true, key: updated ? shapeKey(updated) : null }, 200, cors)
}

async function setKeyRevoked(id: string, revoked: boolean, env: Env, cors: Cors): Promise<Response> {
  const result = revoked
    ? await env.DB.prepare('UPDATE api_keys SET revoked_at = unixepoch() WHERE id = ? AND revoked_at IS NULL').bind(id).run()
    : await env.DB.prepare('UPDATE api_keys SET revoked_at = NULL WHERE id = ? AND revoked_at IS NOT NULL').bind(id).run()
  if (!result.meta.changes) {
    const exists = await env.DB.prepare('SELECT 1 AS x FROM api_keys WHERE id = ?').bind(id).first()
    if (!exists) return fail('key_not_found', 404, cors)
  }
  return json({ ok: true, changed: result.meta.changes ?? 0 }, 200, cors)
}

// ── Uploads ───────────────────────────────────────────────────────────────

async function listUploads(url: URL, env: Env, cors: Cors): Promise<Response> {
  const status = url.searchParams.get('status') ?? 'all'
  const q = likePattern(url.searchParams.get('q'))
  const limit = intParam(url, 'limit', 50, 1, 200)
  const offset = intParam(url, 'offset', 0, 0, 1_000_000)
  const now = nowSec()

  const where: string[] = []
  const binds: unknown[] = []
  if (status === 'active') { where.push('revoked_at IS NULL AND expires_at > ?'); binds.push(now) }
  if (status === 'expired') { where.push('revoked_at IS NULL AND expires_at <= ?'); binds.push(now) }
  if (status === 'revoked') where.push('revoked_at IS NOT NULL')
  if (q) {
    where.push("(filename LIKE ? ESCAPE '\\' OR share_token LIKE ? ESCAPE '\\' OR user_id LIKE ? ESCAPE '\\' OR api_key_id LIKE ? ESCAPE '\\' OR mime_type LIKE ? ESCAPE '\\')")
    binds.push(q, q, q, q, q)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const order = url.searchParams.get('sort') === 'size' ? 'size_bytes DESC' : url.searchParams.get('sort') === 'downloads' ? 'download_count DESC' : 'upload_at DESC'

  const [rows, total] = await Promise.all([
    env.DB.prepare(`SELECT ${UPLOAD_COLUMNS} FROM api_uploads ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...binds, limit, offset).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM api_uploads ${clause}`).bind(...binds).first<{ n: number }>(),
  ])
  return json({ total: total?.n ?? 0, limit, offset, uploads: (rows.results ?? []).map(u => shapeUpload(u, now)) }, 200, cors)
}

/**
 * Stops the links at once and deletes the bytes. A link is revoked whether or
 * not its bytes went: a delete that failed stays queued for the cron's retry.
 */
async function revokeUploads(env: Env, where: string, binds: unknown[]): Promise<{ revoked: number; pending: number }> {
  const rows = await all<{ id: string; storage_path: string }>(
    env.DB.prepare(`SELECT id, storage_path FROM api_uploads WHERE ${where}`).bind(...binds),
  )
  if (!rows.length) return { revoked: 0, pending: 0 }
  for (let i = 0; i < rows.length; i += 100) {
    const ids = rows.slice(i, i + 100).map(r => r.id)
    const ph = ids.map(() => '?').join(', ')
    await env.DB.prepare(`UPDATE api_uploads SET revoked_at = COALESCE(revoked_at, unixepoch()) WHERE id IN (${ph})`).bind(...ids).run()
  }
  const { failed } = await deleteStored(env, rows)
  return { revoked: rows.length, pending: failed.length }
}

async function deleteAttachments(env: Env, where: string, binds: unknown[]): Promise<{ deleted: number; pending: number }> {
  const rows = await all<{ id: string; storage_path: string }>(
    env.DB.prepare(`SELECT id, storage_path FROM attachments WHERE ${where}`).bind(...binds),
  )
  if (!rows.length) return { deleted: 0, pending: 0 }
  const { failed } = await deleteStored(env, rows)
  // The metadata goes either way: the queue row (kept on failure) is what
  // the cron needs to retry the bytes.
  await dropAttachmentRows(env, rows.map(r => r.id))
  return { deleted: rows.length, pending: failed.length }
}

async function listAttachments(url: URL, env: Env, cors: Cors): Promise<Response> {
  const q = likePattern(url.searchParams.get('q'))
  const limit = intParam(url, 'limit', 50, 1, 200)
  const offset = intParam(url, 'offset', 0, 0, 1_000_000)
  const clause = q ? "WHERE filename LIKE ?1 ESCAPE '\\' OR user_id LIKE ?1 ESCAPE '\\'" : ''
  const binds = q ? [q] : []
  const [rows, total] = await Promise.all([
    env.DB.prepare(`
      SELECT id, user_id, subscription_id, filename, size_bytes, mime_type, upload_at, delete_at
      FROM attachments ${clause} ORDER BY upload_at DESC LIMIT ${limit} OFFSET ${offset}`).bind(...binds).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM attachments ${clause}`).bind(...binds).first<{ n: number }>(),
  ])
  return json({ total: total?.n ?? 0, limit, offset, attachments: rows.results ?? [] }, 200, cors)
}

// ── Secret links ──────────────────────────────────────────────────────────

async function listSecrets(url: URL, env: Env, cors: Cors): Promise<Response> {
  const limit = intParam(url, 'limit', 50, 1, 100)
  const page = await env.VAULT_SECRETS.list({ prefix: 'secret:', limit })
  const secrets = await Promise.all(page.keys.map(async key => {
    const raw = await env.VAULT_SECRETS.get(key.name)
    if (!raw) return null
    try {
      const rec = JSON.parse(raw) as {
        title?: string; createdAt?: number; expiresAt?: number; alreadyOpened?: boolean
        openedAt?: number; policy?: Record<string, unknown>; encryptedPayload?: string
      }
      // The payload is ciphertext the server cannot read; only its size is shown.
      return {
        id: key.name.slice('secret:'.length),
        title: rec.title ?? null,
        created_at: rec.createdAt ?? null,
        expires_at: rec.expiresAt ?? null,
        opened: Boolean(rec.alreadyOpened),
        opened_at: rec.openedAt ?? null,
        policy: rec.policy ?? null,
        size: rec.encryptedPayload?.length ?? 0,
      }
    } catch {
      return null
    }
  }))
  return json({
    secrets: secrets.filter(Boolean).sort((a, b) => (b?.created_at ?? 0) - (a?.created_at ?? 0)),
    more: !page.list_complete,
  }, 200, cors)
}

// ── Router ────────────────────────────────────────────────────────────────

/**
 * Handles an admin request, or returns null when the path is not an admin
 * route. `path` is the part after /vault/api/admin (or the /api/admin alias).
 */
export async function handleAdmin(req: Request, env: Env, cors: Cors, path: string): Promise<Response | null> {
  const method = req.method.toUpperCase()
  const url = new URL(req.url)
  const isRead = method === 'GET'

  const auth = await checkAdmin(req, env, env.VAULT_TOKENS, isRead)
  if (!auth.ok) return fail(auth.error, auth.status, cors)

  try {
    if (isRead) {
      if (path === '/summary') return await summary(env, cors)
      if (path === '/health') return await health(env, cors)
      if (path === '/users') return await listUsers(url, env, cors)
      if (path === '/keys') return await listKeys(url, env, cors)
      if (path === '/uploads') return await listUploads(url, env, cors)
      if (path === '/attachments') return await listAttachments(url, env, cors)
      if (path === '/secrets') return await listSecrets(url, env, cors)
      if (path === '/audit') {
        return json({ service: 'clex-vault', generatedAt: nowSec(), events: [] }, 200, cors)
      }
      const user = path.match(/^\/users\/([^/]{1,128})$/)
      if (user) return await userDetail(decodeURIComponent(user[1]), env, cors)
      return fail('not_found', 404, cors)
    }

    const key = path.match(/^\/keys\/(ck_id_[0-9a-f]{32}|[A-Za-z0-9_]{1,64})(\/revoke|\/restore)?$/)
    if (key) {
      if (method === 'PATCH' && !key[2]) return await updateKey(key[1], req, env, cors)
      if (method === 'POST' && key[2] === '/revoke') return await setKeyRevoked(key[1], true, env, cors)
      if (method === 'POST' && key[2] === '/restore') return await setKeyRevoked(key[1], false, env, cors)
    }

    const upload = path.match(/^\/uploads\/([0-9a-f]{32})\/revoke$/)
    if (upload && method === 'POST') {
      const r = await revokeUploads(env, 'id = ?', [upload[1]])
      if (!r.revoked) return fail('upload_not_found', 404, cors)
      return json({ ok: true, ...r }, 200, cors)
    }

    const attachment = path.match(/^\/attachments\/([0-9a-f]{16,64})$/)
    if (attachment && method === 'DELETE') {
      const r = await deleteAttachments(env, 'id = ?', [attachment[1]])
      if (!r.deleted) return fail('attachment_not_found', 404, cors)
      return json({ ok: true, ...r }, 200, cors)
    }

    const secret = path.match(/^\/secrets\/([a-f0-9]{8,64})$/)
    if (secret && method === 'DELETE') {
      await env.VAULT_SECRETS.delete(`secret:${secret[1]}`)
      return json({ ok: true }, 200, cors)
    }

    const userAction = path.match(/^\/users\/([^/]{1,128})\/(revoke-keys|revoke-uploads|wipe-vault|purge)$/)
    if (userAction && method === 'POST') {
      const uid = decodeURIComponent(userAction[1])
      const action = userAction[2]
      if (action === 'wipe-vault' || action === 'purge') {
        const body = await readBody<{ confirm?: unknown }>(req)
        if (body?.confirm !== uid) return fail('confirm_must_equal_uid', 400, cors)
      }
      const result: Record<string, number> = {}
      if (action === 'revoke-keys' || action === 'purge') {
        const r = await env.DB.prepare('UPDATE api_keys SET revoked_at = unixepoch() WHERE user_id = ? AND revoked_at IS NULL').bind(uid).run()
        result.keys_revoked = r.meta.changes ?? 0
      }
      if (action === 'revoke-uploads' || action === 'purge') {
        const r = await revokeUploads(env, 'user_id = ? AND revoked_at IS NULL', [uid])
        result.uploads_revoked = r.revoked
        result.bytes_pending_retry = r.pending
      }
      if (action === 'purge') {
        const r = await deleteAttachments(env, 'user_id = ?', [uid])
        result.attachments_deleted = r.deleted
        result.bytes_pending_retry = (result.bytes_pending_retry ?? 0) + r.pending
      }
      if (action === 'wipe-vault' || action === 'purge') {
        const have = await tables(env)
        if (have.has('vault_items')) {
          const r = await env.DB.prepare('DELETE FROM vault_items WHERE uid = ?').bind(uid).run()
          result.vault_items_deleted = r.meta.changes ?? 0
        }
        if (have.has('vault_accounts')) {
          await env.DB.prepare('DELETE FROM vault_accounts WHERE uid = ?').bind(uid).run()
        }
        await env.VAULT_TOKENS.delete(`devices:${uid}`)
      }
      return json({ ok: true, ...result }, 200, cors)
    }

    if (path === '/maintenance/cleanup' && method === 'POST') {
      const removed = await runPendingDeletions(env)
      return json({ ok: true, removed }, 200, cors)
    }

    return fail('not_found', 404, cors)
  } catch (err) {
    console.error('vault admin error', path, err)
    return fail('admin_query_failed', 500, cors)
  }
}
