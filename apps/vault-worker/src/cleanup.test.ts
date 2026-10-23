import { describe, expect, it } from 'vitest'
import { deleteStored, runPendingDeletions } from './cleanup'

/**
 * Just enough of D1 for the queue logic: a pending_deletions table and an
 * attachments table, driven by the statements cleanup.ts issues.
 */
function fakeEnv(failing: Set<string>) {
  const pending = new Map<string, { storage_path: string; delete_at: number }>()
  const attachments = new Set<string>()
  const prepare = (sql: string) => {
    const stmt = {
      args: [] as unknown[],
      bind(...args: unknown[]) { stmt.args = args; return stmt },
      async all() {
        const [now, limit] = stmt.args as number[]
        const results = [...pending.entries()]
          .filter(([, r]) => r.delete_at <= now)
          .slice(0, limit)
          .map(([id, r]) => ({ id, storage_path: r.storage_path }))
        return { results }
      },
      run() {
        if (sql.startsWith('DELETE FROM pending_deletions')) stmt.args.forEach((id) => pending.delete(String(id)))
        else if (sql.startsWith('DELETE FROM attachments')) stmt.args.forEach((id) => attachments.delete(String(id)))
        else if (sql.startsWith('INSERT OR REPLACE INTO pending_deletions')) {
          const [id, storage_path, delete_at] = stmt.args as [string, string, number]
          pending.set(id, { storage_path, delete_at })
        }
      },
    }
    return stmt
  }
  const deletedPaths: string[] = []
  const env = {
    DB: { prepare, async batch(stmts: { run: () => void }[]) { stmts.forEach((s) => s.run()) } },
    FILES: {
      async delete(paths: string[]) {
        if (paths.some((p) => failing.has(p))) throw new Error('R2 unavailable')
        deletedPaths.push(...paths)
      },
    },
  }
  return { env: env as never, pending, attachments, deletedPaths }
}

describe('deleteStored', () => {
  it('drops the queue row once storage confirms the delete', async () => {
    const { env, pending } = fakeEnv(new Set())
    pending.set('a', { storage_path: 'p/a', delete_at: 9e9 })
    const r = await deleteStored(env, [{ id: 'a', storage_path: 'p/a' }], 1000)
    expect(r).toEqual({ deleted: ['a'], failed: [] })
    expect(pending.has('a')).toBe(false)
  })

  it('keeps a failed delete queued, due again shortly, so the bytes are retried', async () => {
    const { env, pending } = fakeEnv(new Set(['p/b']))
    const r = await deleteStored(env, [{ id: 'b', storage_path: 'p/b' }], 1000)
    expect(r).toEqual({ deleted: [], failed: ['b'] })
    expect(pending.get('b')).toEqual({ storage_path: 'p/b', delete_at: 1060 })
  })
})

describe('runPendingDeletions', () => {
  it('removes what it can, keeps the rest for the next run, and does not spin', async () => {
    const failing = new Set(['p/bad'])
    const { env, pending, attachments } = fakeEnv(failing)
    pending.set('ok', { storage_path: 'p/ok', delete_at: 10 })
    pending.set('bad', { storage_path: 'p/bad', delete_at: 10 })
    attachments.add('ok').add('bad')

    // R2 deletes a batch as one call, so one bad path fails the batch.
    expect(await runPendingDeletions(env, 100)).toBe(0)
    expect(pending.size).toBe(2)

    failing.clear()
    expect(await runPendingDeletions(env, 200)).toBe(2)
    expect(pending.size).toBe(0)
    expect(attachments.size).toBe(0)
  })
})
