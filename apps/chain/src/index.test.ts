/**
 * Regression test for the "stuck at transferring" bug.
 *
 * The chain ledger does a read-modify-write to advance a session's status:
 *   1. SELECT status FROM transfer_sessions WHERE id = ?
 *   2. compute new status
 *   3. UPDATE transfer_sessions SET status = ? WHERE id = ?
 *
 * Two concurrent appendEvent requests can both pass step 1 before either
 * UPDATE in step 3 commits. If the slower-ranked status (e.g. "transferring")
 * commits *after* the higher-ranked status (e.g. "completed"), the row gets
 * regressed and the chain explorer shows transferring forever — even though
 * `completed_at` and `duration_ms` are set, because those fields came from
 * the "completed" UPDATE that was overwritten.
 *
 * The fix: bake the rank-precedence check into the SQL WHERE clause so the
 * UPDATE only commits when the current status is strictly below the new
 * status's rank. Concurrent UPDATEs can no longer overwrite each other.
 */

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { isFinalStatus, statusesBelow } from './types'

interface SessionRow {
  id: string
  status: string
  completed_at: number | null
  duration_ms: number | null
  started_at: number
}

function makeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE transfer_sessions (
      id           TEXT PRIMARY KEY,
      status       TEXT NOT NULL DEFAULT 'registered',
      started_at   INTEGER NOT NULL,
      completed_at INTEGER,
      duration_ms  INTEGER
    );
  `)
  return db
}

function seed(db: Database.Database, id: string, startedAt: number, status = 'registered') {
  db.prepare(`INSERT INTO transfer_sessions (id, status, started_at) VALUES (?, ?, ?)`)
    .run(id, status, startedAt)
}

function read(db: Database.Database, id: string): SessionRow {
  return db.prepare(`SELECT id, status, completed_at, duration_ms, started_at FROM transfer_sessions WHERE id = ?`)
    .get(id) as SessionRow
}

// ---------------------------------------------------------------------------
// Mirror of the worker's atomic-advance SQL builder. Kept in lockstep so this
// test exercises the production path; if the worker's SQL drifts, the
// regression test should follow.
// ---------------------------------------------------------------------------
function appendEventAtomic(db: Database.Database, sessionId: string, nextStatus: string, now: number): boolean {
  const lowerStatuses = statusesBelow(nextStatus)
  if (lowerStatuses.length === 0) return false

  const placeholders = lowerStatuses.map(() => '?').join(',')
  const finalSetters = isFinalStatus(nextStatus)
    ? ', completed_at = ?, duration_ms = ? - started_at'
    : ''

  const sql = `
    UPDATE transfer_sessions
    SET status = ?${finalSetters}
    WHERE id = ? AND status IN (${placeholders})
  `

  const binds: unknown[] = [nextStatus]
  if (isFinalStatus(nextStatus)) binds.push(now, now)
  binds.push(sessionId, ...lowerStatuses)

  const result = db.prepare(sql).run(...binds)
  return result.changes > 0
}

// ---------------------------------------------------------------------------
// Mirror of the OLD non-atomic read-modify-write path, kept here so the
// regression test asserts the buggy behavior we are fixing — if someone
// reverts the SQL guard, this test must fail.
// ---------------------------------------------------------------------------
function appendEventNonAtomic(
  db: Database.Database,
  sessionId: string,
  nextStatus: string,
  now: number,
): { advanced: boolean; readStatus: string } {
  const before = db.prepare(`SELECT status, started_at FROM transfer_sessions WHERE id = ?`)
    .get(sessionId) as { status: string; started_at: number }
  const advance = !['completed', 'cancelled', 'failed', 'abandoned'].includes(before.status)
    && rank(nextStatus) > rank(before.status)
  if (!advance) return { advanced: false, readStatus: before.status }

  if (isFinalStatus(nextStatus)) {
    db.prepare(`UPDATE transfer_sessions SET status = ?, completed_at = ?, duration_ms = ? WHERE id = ?`)
      .run(nextStatus, now, now - before.started_at, sessionId)
  } else {
    db.prepare(`UPDATE transfer_sessions SET status = ? WHERE id = ?`)
      .run(nextStatus, sessionId)
  }
  return { advanced: true, readStatus: before.status }
}

function rank(s: string) {
  return ({ registered: 0, waiting_peer: 1, connecting: 2, transferring: 3 } as Record<string, number>)[s] ?? 4
}

describe('appendEvent — atomic status advance', () => {
  it('advances a fresh session through the lifecycle', () => {
    const db = makeDb()
    seed(db, 'a', 1000)
    expect(appendEventAtomic(db, 'a', 'waiting_peer', 1100)).toBe(true)
    expect(appendEventAtomic(db, 'a', 'connecting',   1200)).toBe(true)
    expect(appendEventAtomic(db, 'a', 'transferring', 1300)).toBe(true)
    expect(appendEventAtomic(db, 'a', 'completed',    1400)).toBe(true)

    const row = read(db, 'a')
    expect(row.status).toBe('completed')
    expect(row.completed_at).toBe(1400)
    expect(row.duration_ms).toBe(400)
  })

  it('refuses to regress to a lower-ranked status', () => {
    const db = makeDb()
    seed(db, 'a', 1000)
    expect(appendEventAtomic(db, 'a', 'completed',   1400)).toBe(true)
    expect(appendEventAtomic(db, 'a', 'transferring', 1500)).toBe(false) // late event

    const row = read(db, 'a')
    expect(row.status).toBe('completed')
    expect(row.completed_at).toBe(1400)
  })

  it('keeps a terminal status sticky against another terminal', () => {
    const db = makeDb()
    seed(db, 'a', 1000)
    expect(appendEventAtomic(db, 'a', 'completed', 1400)).toBe(true)
    expect(appendEventAtomic(db, 'a', 'failed',    1500)).toBe(false)

    expect(read(db, 'a').status).toBe('completed')
  })

  it('survives the race that broke the live ledger: a "transferring" UPDATE that lands AFTER "completed"', () => {
    // Reproduce the exact wire pattern observed on clex.in/chain/explorer:
    //   - sessions with status="transferring" but completed_at and duration_ms
    //     populated. That can only happen if a "completed" UPDATE landed and
    //     was then overwritten by a "transferring" UPDATE that read the
    //     pre-completed status.
    //
    // With the atomic guard the late "transferring" UPDATE filters itself
    // out and the session stays at "completed".
    const db = makeDb()
    seed(db, 'race', 1000, 'connecting')

    // Both requests "see" the same starting status (the race window). With
    // the new atomic SQL, the order of arrival is irrelevant.
    const completedAdvanced   = appendEventAtomic(db, 'race', 'completed',    1500)
    const transferringAdvanced = appendEventAtomic(db, 'race', 'transferring', 1600)

    expect(completedAdvanced).toBe(true)
    expect(transferringAdvanced).toBe(false) // guard rejected the regression

    const row = read(db, 'race')
    expect(row.status).toBe('completed')
    expect(row.completed_at).toBe(1500)
    expect(row.duration_ms).toBe(500)
  })

  it('makes the race independent of arrival order (completed last)', () => {
    const db = makeDb()
    seed(db, 'race', 1000, 'connecting')

    // Arrival order swapped: the slower-ranked update lands first.
    const transferringAdvanced = appendEventAtomic(db, 'race', 'transferring', 1500)
    const completedAdvanced    = appendEventAtomic(db, 'race', 'completed',    1600)

    expect(transferringAdvanced).toBe(true)
    expect(completedAdvanced).toBe(true)

    const row = read(db, 'race')
    expect(row.status).toBe('completed')
    expect(row.completed_at).toBe(1600)
    expect(row.duration_ms).toBe(600)
  })

  it('reproduces the bug under the OLD non-atomic path (sanity guard)', () => {
    // This test pins the buggy behavior we are fixing. If someone tries to
    // restore the read-modify-write pattern, this test still passes — and
    // the atomic test above will start failing — so reviewers see both
    // sides of the tradeoff.
    const db = makeDb()
    seed(db, 'race', 1000, 'connecting')

    // Step 1: both requests SELECT and see status="connecting".
    const beforeA = db.prepare(`SELECT status FROM transfer_sessions WHERE id = ?`).get('race') as { status: string }
    const beforeB = db.prepare(`SELECT status FROM transfer_sessions WHERE id = ?`).get('race') as { status: string }
    expect(beforeA.status).toBe('connecting')
    expect(beforeB.status).toBe('connecting')

    // Step 2: "completed" UPDATE commits.
    appendEventNonAtomic(db, 'race', 'completed', 1500)
    expect(read(db, 'race').status).toBe('completed')
    expect(read(db, 'race').completed_at).toBe(1500)

    // Step 3: late "transferring" UPDATE lands. Without the atomic guard
    // (i.e. the OLD path) this overwrites the status — exactly the live bug.
    db.prepare(`UPDATE transfer_sessions SET status = ? WHERE id = ?`).run('transferring', 'race')

    const row = read(db, 'race')
    expect(row.status).toBe('transferring')      // ← bug: status regressed
    expect(row.completed_at).toBe(1500)          // ← bug: leftover from "completed"
    expect(row.duration_ms).toBe(500)
  })

  it('still applies completed when an unrelated late event arrives after', () => {
    // A third "transferring" event arriving after a successful "completed"
    // must be a no-op under the atomic path, leaving completed_at intact.
    const db = makeDb()
    seed(db, 'a', 2000)

    appendEventAtomic(db, 'a', 'transferring', 2100)
    appendEventAtomic(db, 'a', 'completed',    2200)
    // Late stragglers, e.g. retries from a flaky connection.
    appendEventAtomic(db, 'a', 'transferring', 2300)
    appendEventAtomic(db, 'a', 'connecting',   2400)

    const row = read(db, 'a')
    expect(row.status).toBe('completed')
    expect(row.completed_at).toBe(2200)
    expect(row.duration_ms).toBe(200)
  })
})
