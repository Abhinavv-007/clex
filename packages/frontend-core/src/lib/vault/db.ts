/**
 * Vault IndexedDB Storage
 *
 * Stores encrypted note content locally. All ciphertexts produced by
 * crypto.ts before writing here — the DB layer is blissfully unaware
 * of plaintext.
 *
 * Object stores:
 *   vault-notes:   encrypted notes
 *   vault-folders: folder tree (plaintext names OK — folder names are metadata)
 *   vault-devices: paired device registry
 *   vault-attachments: R2 file attachment references per note
 */

import type { EncryptedBlob } from './crypto'

export const DB_NAME = 'vault-data-v1'
const DB_VERSION = 1

export interface StoredNote {
  id: string
  titleBlob: EncryptedBlob   // encrypted title
  bodyBlob: EncryptedBlob    // encrypted body markdown
  createdAt: number
  updatedAt: number
  tags: string[]             // plaintext tags (low-sensitivity metadata)
  folderId: string | null
  isPinned: boolean
  attachmentIds: string[]
}

export interface StoredFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
  sortOrder: number
}

export interface StoredDevice {
  id: string            // device fingerprint
  name: string          // auto-detected name
  pairedAt: number
  lastSeen: number
  roomVersion: number   // incremented on unpair to rotate room ID
}

export interface StoredAttachment {
  id: string
  noteId: string
  r2Key: string
  filename: string
  sizeBytes: number
  mimeType: string
  expiresAt: number
  uploadedAt: number
}

// ── DB Initialization ─────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

export function openVaultDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('vault-notes')) {
        const notes = db.createObjectStore('vault-notes', { keyPath: 'id' })
        notes.createIndex('by-folder', 'folderId')
        notes.createIndex('by-updated', 'updatedAt')
        notes.createIndex('by-pinned', 'isPinned')
      }

      if (!db.objectStoreNames.contains('vault-folders')) {
        const folders = db.createObjectStore('vault-folders', { keyPath: 'id' })
        folders.createIndex('by-parent', 'parentId')
      }

      if (!db.objectStoreNames.contains('vault-devices')) {
        db.createObjectStore('vault-devices', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('vault-attachments')) {
        const att = db.createObjectStore('vault-attachments', { keyPath: 'id' })
        att.createIndex('by-note', 'noteId')
      }
    }

    req.onsuccess = () => { _db = req.result; resolve(req.result) }
    req.onerror = () => reject(req.error)
  })
}

// ── Generic helpers ───────────────────────────────────────────────────────────

async function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openVaultDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function txAll<T>(storeName: string): Promise<T[]> {
  return tx<T[]>(storeName, 'readonly', store => store.getAll())
}

async function txByIndex<T>(storeName: string, indexName: string, value: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await openVaultDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const index = transaction.objectStore(storeName).index(indexName)
    const req = index.getAll(value)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Notes CRUD ────────────────────────────────────────────────────────────────

export async function getAllNotes(): Promise<StoredNote[]> {
  return txAll<StoredNote>('vault-notes')
}

export async function getNotesByFolder(folderId: string | null): Promise<StoredNote[]> {
  if (folderId === null) {
    const all = await getAllNotes()
    return all.filter(n => n.folderId === null)
  }
  return txByIndex<StoredNote>('vault-notes', 'by-folder', folderId)
}

export async function getNote(id: string): Promise<StoredNote | null> {
  const result = await tx<StoredNote | undefined>('vault-notes', 'readonly', store => store.get(id))
  return result ?? null
}

export async function saveNote(note: StoredNote): Promise<void> {
  await tx<IDBValidKey>('vault-notes', 'readwrite', store => store.put(note))
}

export async function deleteNote(id: string): Promise<void> {
  await tx<undefined>('vault-notes', 'readwrite', store => store.delete(id))
}

// ── Folders CRUD ──────────────────────────────────────────────────────────────

export async function getAllFolders(): Promise<StoredFolder[]> {
  return txAll<StoredFolder>('vault-folders')
}

export async function saveFolder(folder: StoredFolder): Promise<void> {
  await tx<IDBValidKey>('vault-folders', 'readwrite', store => store.put(folder))
}

export async function deleteFolder(id: string): Promise<void> {
  // Move all notes in this folder to root before deleting
  const notes = await getNotesByFolder(id)
  const db = await openVaultDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['vault-notes', 'vault-folders'], 'readwrite')
    const noteStore = transaction.objectStore('vault-notes')
    const folderStore = transaction.objectStore('vault-folders')
    for (const note of notes) {
      noteStore.put({ ...note, folderId: null })
    }
    folderStore.delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// ── Devices ───────────────────────────────────────────────────────────────────

export async function getAllDevices(): Promise<StoredDevice[]> {
  return txAll<StoredDevice>('vault-devices')
}

export async function saveDevice(device: StoredDevice): Promise<void> {
  await tx<IDBValidKey>('vault-devices', 'readwrite', store => store.put(device))
}

export async function deleteDevice(id: string): Promise<void> {
  await tx<undefined>('vault-devices', 'readwrite', store => store.delete(id))
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function getAttachmentsForNote(noteId: string): Promise<StoredAttachment[]> {
  return txByIndex<StoredAttachment>('vault-attachments', 'by-note', noteId)
}

export async function saveAttachment(att: StoredAttachment): Promise<void> {
  await tx<IDBValidKey>('vault-attachments', 'readwrite', store => store.put(att))
}

export async function deleteAttachment(id: string): Promise<void> {
  await tx<undefined>('vault-attachments', 'readwrite', store => store.delete(id))
}

// ── Export / Import ───────────────────────────────────────────────────────────

export async function exportAllData(): Promise<{
  notes: StoredNote[]
  folders: StoredFolder[]
  devices: StoredDevice[]
  attachments: StoredAttachment[]
  exportedAt: string
}> {
  const [notes, folders, devices, attachments] = await Promise.all([
    getAllNotes(),
    getAllFolders(),
    getAllDevices(),
    txAll<StoredAttachment>('vault-attachments'),
  ])
  return { notes, folders, devices, attachments, exportedAt: new Date().toISOString() }
}

export async function clearAllData(): Promise<void> {
  const db = await openVaultDb()
  await new Promise<void>((resolve, reject) => {
    const stores = ['vault-notes', 'vault-folders', 'vault-devices', 'vault-attachments']
    const transaction = db.transaction(stores, 'readwrite')
    for (const s of stores) transaction.objectStore(s).clear()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// ── Device fingerprint ────────────────────────────────────────────────────────

export async function getDeviceFingerprint(): Promise<string> {
  const db = await openVaultDb()
  const stored = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction('vault-devices', 'readonly')
    const req = tx.objectStore('vault-devices').get('__self__')
    req.onsuccess = () => resolve(req.result?.fingerprint ?? null)
    req.onerror = () => reject(req.error)
  })
  if (stored) return stored

  const fp = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  await tx<IDBValidKey>('vault-devices', 'readwrite', store =>
    store.put({ id: '__self__', fingerprint: fp }, '__self__')
  )
  return fp
}

export function detectDeviceName(): string {
  const ua = navigator.userAgent
  let browser = 'Browser'
  let os = 'Unknown OS'

  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'

  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Windows NT/.test(ua)) os = 'Windows'
  else if (/Linux/.test(ua)) os = 'Linux'

  return `${browser} on ${os}`
}
