/**
 * Vault account sync — the browser side of apps/vault-worker/src/accountSync.ts.
 *
 * Signed in with Google, every device on the account uses the account's
 * Vault key (fetched with a verified ID token) and keeps its notes and
 * folders in step through the worker: each change is encrypted here with
 * that key, pushed, and pulled by the other devices. The worker only ever
 * holds ciphertext.
 *
 * It syncs when it starts, a moment after every local edit, when the tab
 * comes back into view or back online, and every 20 seconds while visible.
 * Conflicts are per note or folder, newest edit wins; deletions travel as
 * tombstones so a deleted note does not come back from another device.
 */

import { getGoogleIdToken } from './auth'
import { base64ToBuf, createMasterKeyFromRaw, decryptText, encryptText, type EncryptedBlob, type MasterKey } from './crypto'
import {
  getAllDeletionTombstones,
  getAllFolders,
  getAllNotes,
  onVaultChange,
  type StoredFolder,
  type StoredNote,
} from './db'

const BATCH = 200
const EDIT_DEBOUNCE_MS = 1200
const POLL_MS = 20_000

export type AccountSyncState = 'off' | 'syncing' | 'synced' | 'offline' | 'error'

export interface AccountSyncStatus {
  state: AccountSyncState
  lastSync: number | null
  error: string | null
}

interface WireItem {
  kind: 'note' | 'folder'
  id: string
  updatedAt: number
  deleted: boolean
  payload: string | null
}

/** What the app does with a change that came from the account. */
export interface AccountSyncHandlers {
  applyNote(note: StoredNote): Promise<void>
  applyFolder(folder: StoredFolder): Promise<void>
  removeNote(id: string, deletedAt: number): Promise<void>
  removeFolder(id: string, deletedAt: number): Promise<void>
}

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGoogleIdToken()
  if (!token) throw new Error('Sign in to sync your Vault')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    // An expired token: refresh once and retry.
    const fresh = await getGoogleIdToken(true)
    if (fresh) {
      headers.set('Authorization', `Bearer ${fresh}`)
      return fetch(url, { ...init, headers })
    }
  }
  return res
}

async function readError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => null) as { error?: string } | null
  return new Error(data?.error ?? `${fallback} (${res.status})`)
}

/** The account's Vault key. Every device signed in to the account gets the same one. */
export async function fetchAccountKey(vaultApiUrl: string): Promise<MasterKey> {
  const res = await authedFetch(`${vaultApiUrl}/account/key`)
  if (!res.ok) throw await readError(res, 'Could not load your Vault key')
  const data = await res.json() as { key?: string }
  if (typeof data.key !== 'string') throw new Error('The Vault key came back empty')
  const raw = base64ToBuf(data.key)
  if (raw.byteLength !== 32) throw new Error('The Vault key is not valid')
  return createMasterKeyFromRaw(raw)
}

const folderTime = (f: StoredFolder) => f.updatedAt ?? f.createdAt

export class AccountSync {
  private status: AccountSyncStatus = { state: 'off', lastSync: null, error: null }
  private running: Promise<void> | null = null
  private again = false
  private stopped = false
  private editTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private cleanups: (() => void)[] = []

  constructor(
    private readonly vaultApiUrl: string,
    private readonly uid: string,
    private readonly key: MasterKey,
    private readonly handlers: AccountSyncHandlers,
    private readonly onStatus: (status: AccountSyncStatus) => void,
  ) {}

  start(): void {
    this.stopped = false
    this.cleanups.push(onVaultChange(({ remote }) => {
      if (remote) return
      if (this.editTimer) clearTimeout(this.editTimer)
      this.editTimer = setTimeout(() => void this.syncNow(), EDIT_DEBOUNCE_MS)
    }))
    const wake = () => {
      if (document.visibilityState === 'visible') void this.syncNow()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    this.cleanups.push(() => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
    })
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.syncNow()
    }, POLL_MS)
    void this.syncNow()
  }

  stop(): void {
    this.stopped = true
    if (this.editTimer) clearTimeout(this.editTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.cleanups.forEach((fn) => fn())
    this.cleanups = []
    this.setStatus({ state: 'off', error: null })
  }

  /** Pull, then push. Calls made while one is running fold into one more run. */
  async syncNow(): Promise<void> {
    if (this.stopped) return
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          this.setStatus({ state: 'offline', error: null })
          return
        }
        this.setStatus({ state: 'syncing', error: null })
        try {
          await this.pull()
          await this.push()
          this.setStatus({ state: 'synced', lastSync: Date.now(), error: null })
        } catch (error) {
          this.setStatus({ state: 'error', error: error instanceof Error ? error.message : 'Sync failed' })
          return
        }
      } while (this.again && !this.stopped)
    })().finally(() => {
      this.running = null
    })
    return this.running
  }

  // ── Cursor and push mark, per account, per browser ──────────────────────

  private get memoKey() {
    return `clex-vault-sync:${this.uid}:${this.key.fingerprint}`
  }

  private readMemo(): { cursor: number; pushedAt: number } {
    try {
      const raw = localStorage.getItem(this.memoKey)
      const parsed = raw ? JSON.parse(raw) as { cursor?: number; pushedAt?: number } : {}
      return { cursor: Number(parsed.cursor) || 0, pushedAt: Number(parsed.pushedAt) || 0 }
    } catch {
      return { cursor: 0, pushedAt: 0 }
    }
  }

  private writeMemo(patch: Partial<{ cursor: number; pushedAt: number }>): void {
    try {
      localStorage.setItem(this.memoKey, JSON.stringify({ ...this.readMemo(), ...patch }))
    } catch {
      // Storage blocked: sync still works, it just starts from zero next time.
    }
  }

  // ── Pull ────────────────────────────────────────────────────────────────

  private async pull(): Promise<void> {
    let { cursor } = this.readMemo()
    for (let page = 0; page < 100; page += 1) {
      const res = await authedFetch(`${this.vaultApiUrl}/sync?since=${cursor}`)
      if (!res.ok) throw await readError(res, 'Could not fetch changes')
      const data = await res.json() as { items: WireItem[]; cursor: number; more: boolean }
      for (const item of data.items) await this.apply(item)
      cursor = data.cursor
      this.writeMemo({ cursor })
      if (!data.more) return
    }
  }

  private async apply(item: WireItem): Promise<void> {
    if (item.deleted) {
      if (item.kind === 'note') await this.handlers.removeNote(item.id, item.updatedAt)
      else await this.handlers.removeFolder(item.id, item.updatedAt)
      return
    }
    if (!item.payload) return
    let record: unknown
    try {
      const blob = JSON.parse(item.payload) as EncryptedBlob
      record = JSON.parse(await decryptText(blob, this.key.key))
    } catch {
      // Encrypted with another key (an older Vault on this account): skip it
      // rather than stop the whole sync.
      return
    }
    if (item.kind === 'note') await this.handlers.applyNote(record as StoredNote)
    else await this.handlers.applyFolder(record as StoredFolder)
  }

  // ── Push ────────────────────────────────────────────────────────────────

  private async push(): Promise<void> {
    const { pushedAt } = this.readMemo()
    const mark = Date.now()
    const [notes, folders, tombstones] = await Promise.all([getAllNotes(), getAllFolders(), getAllDeletionTombstones()])

    const pending: (() => Promise<WireItem>)[] = []
    for (const note of notes) {
      if (note.updatedAt > pushedAt) pending.push(() => this.seal('note', note.id, note.updatedAt, note))
    }
    for (const folder of folders) {
      if (folderTime(folder) > pushedAt) pending.push(() => this.seal('folder', folder.id, folderTime(folder), folder))
    }
    for (const t of tombstones) {
      if (t.deletedAt > pushedAt) {
        pending.push(async () => ({ kind: t.kind, id: t.targetId, updatedAt: t.deletedAt, deleted: true, payload: null }))
      }
    }

    for (let i = 0; i < pending.length; i += BATCH) {
      const items = await Promise.all(pending.slice(i, i + BATCH).map((make) => make()))
      const res = await authedFetch(`${this.vaultApiUrl}/sync`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw await readError(res, 'Could not save changes')
    }
    this.writeMemo({ pushedAt: mark })
  }

  private async seal(kind: 'note' | 'folder', id: string, updatedAt: number, record: StoredNote | StoredFolder): Promise<WireItem> {
    const blob = await encryptText(JSON.stringify(record), this.key.key)
    return { kind, id, updatedAt, deleted: false, payload: JSON.stringify(blob) }
  }

  private setStatus(patch: Partial<AccountSyncStatus>): void {
    this.status = { ...this.status, ...patch }
    this.onStatus(this.status)
  }
}
