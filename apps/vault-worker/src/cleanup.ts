/**
 * Deletes stored bytes whose time is up.
 *
 * Runs from the hourly cron, and on demand from the admin console. Every
 * stored object — a Vault attachment or an API upload — has a row in
 * `pending_deletions`; once its `delete_at` passes, the bytes go, the queue
 * row goes, and an attachment's metadata row goes with it. API upload rows are
 * kept (marked by their past `expires_at`) so download counts and history
 * survive for the owner and the console.
 */
import { deleteObjects, type StorageEnv } from './storage'

const BATCH = 200
/** Upper bound per run, so one invocation stays well inside its CPU budget. */
const MAX_BATCHES = 10

export interface CleanupEnv extends StorageEnv {
  DB: D1Database
}

export async function runPendingDeletions(env: CleanupEnv, now = Math.floor(Date.now() / 1000)): Promise<number> {
  let removed = 0
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const result = await env.DB.prepare(
      'SELECT id, storage_path FROM pending_deletions WHERE delete_at <= ? LIMIT ?'
    ).bind(now, BATCH).all<{ id: string; storage_path: string }>()

    const rows = result.results ?? []
    if (rows.length === 0) break

    await deleteObjects(env, rows.map(r => r.storage_path))

    const ids = rows.map(r => r.id)
    const placeholders = ids.map(() => '?').join(', ')
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM pending_deletions WHERE id IN (${placeholders})`).bind(...ids),
      env.DB.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...ids),
    ])
    removed += rows.length
    if (rows.length < BATCH) break
  }
  return removed
}
