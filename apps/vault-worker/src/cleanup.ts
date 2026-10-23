/**
 * Deletes stored bytes, and keeps track of the ones that would not go.
 *
 * Every stored object — a Vault attachment or an API upload — has a row in
 * `pending_deletions`. The bytes are removed either when that row's
 * `delete_at` passes (the hourly cron, or the console's "run cleanup now"),
 * or straight away when an owner or the console deletes or takes a file
 * down. Either way a queue row is only removed once storage confirms the
 * delete: a row whose delete failed is kept, due now, so the next run tries
 * again rather than the bytes being orphaned while everything reports them
 * gone.
 *
 * Attachment metadata rows go with their bytes. API upload rows are kept,
 * marked by `revoked_at` or a past `expires_at`, so download counts and
 * history survive for the owner and the console.
 */
import { deleteObjects, type StorageEnv } from './storage'

/**
 * D1 limits shape these numbers: a statement takes at most 100 bound
 * parameters, and a Free-plan invocation may run at most 50 queries — every
 * statement inside a batch() counts. So rows are grouped into multi-row
 * statements, and a sweep is sized to stay well under the query budget:
 * per batch one SELECT, one queue DELETE, at most four requeue upserts and
 * one attachments DELETE, i.e. 7 queries, times MAX_BATCHES = 35.
 */
const BATCH = 100
const MAX_BATCHES = 5
/** Ids per `IN (...)` statement: one parameter each. */
const ID_CHUNK = 100
/** Rows per requeue upsert: three parameters each. */
const UPSERT_CHUNK = 33

export interface CleanupEnv extends StorageEnv {
  DB: D1Database
}

export interface StoredRow {
  id: string
  storage_path: string
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** A failed delete is due again a minute later: picked up by the next run, not this one. */
const RETRY_AFTER_SECONDS = 60

/**
 * Deletes the bytes for these rows now. Rows whose delete is confirmed leave
 * the queue; rows whose delete failed are (re)queued as due shortly, so the
 * next cron run retries them. Returns the ids in each group.
 */
export async function deleteStored(
  env: CleanupEnv,
  rows: StoredRow[],
  now = Math.floor(Date.now() / 1000),
): Promise<{ deleted: string[]; failed: string[] }> {
  if (rows.length === 0) return { deleted: [], failed: [] }

  const failedPaths = new Set(await deleteObjects(env, rows.map(r => r.storage_path)))
  const deleted = rows.filter(r => !failedPaths.has(r.storage_path))
  const failed = rows.filter(r => failedPaths.has(r.storage_path))

  const statements: D1PreparedStatement[] = []
  for (const group of chunks(deleted, ID_CHUNK)) {
    const ph = group.map(() => '?').join(', ')
    statements.push(env.DB.prepare(`DELETE FROM pending_deletions WHERE id IN (${ph})`).bind(...group.map(r => r.id)))
  }
  // One multi-row upsert per group, not one statement per row: when storage
  // is down every row in a batch fails, and a statement each would blow the
  // per-invocation query limit and roll the whole requeue back.
  const retryAt = now + RETRY_AFTER_SECONDS
  for (const group of chunks(failed, UPSERT_CHUNK)) {
    const values = group.map(() => '(?, ?, ?)').join(', ')
    statements.push(env.DB.prepare(
      `INSERT OR REPLACE INTO pending_deletions (id, storage_path, delete_at) VALUES ${values}`
    ).bind(...group.flatMap(r => [r.id, r.storage_path, retryAt])))
  }
  if (statements.length) await env.DB.batch(statements)

  return { deleted: deleted.map(r => r.id), failed: failed.map(r => r.id) }
}

/** Removes attachment metadata rows. Their queue rows are handled by deleteStored. */
export async function dropAttachmentRows(env: CleanupEnv, ids: string[]): Promise<void> {
  const statements = chunks(ids, ID_CHUNK).map((group) => {
    const ph = group.map(() => '?').join(', ')
    return env.DB.prepare(`DELETE FROM attachments WHERE id IN (${ph})`).bind(...group)
  })
  if (statements.length) await env.DB.batch(statements)
}

/** The hourly sweep: everything whose time is up. Returns how many were removed. */
export async function runPendingDeletions(env: CleanupEnv, now = Math.floor(Date.now() / 1000)): Promise<number> {
  let removed = 0
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const result = await env.DB.prepare(
      'SELECT id, storage_path FROM pending_deletions WHERE delete_at <= ? LIMIT ?'
    ).bind(now, BATCH).all<StoredRow>()

    const rows = result.results ?? []
    if (rows.length === 0) break

    const { deleted } = await deleteStored(env, rows, now)
    await dropAttachmentRows(env, deleted)
    removed += deleted.length

    // Failed rows were pushed past `now`, so the next batch never sees them
    // again; a batch where nothing went means storage is down — stop here.
    if (deleted.length === 0 || rows.length < BATCH) break
  }
  return removed
}
