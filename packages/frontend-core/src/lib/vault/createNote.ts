/**
 * Creates an empty, encrypted note in the current folder and selects it.
 * Shared by the sidebar's "new note" button and Vault's welcome screen.
 */
import { get } from 'svelte/store'
import { masterKey, ui, vaultActions, generateId } from '$stores/vault'
import type { DecryptedNote } from '$stores/vault'
import type { StoredNote } from './db'
import { saveNote } from './db'
import { encryptText } from './crypto'
import { updateInIndex } from './search'
import { syncNoteRecord } from './sync'

export async function createVaultNote(): Promise<string | null> {
  const key = get(masterKey)
  if (!key) return null

  const now = Date.now()
  const id = generateId()
  const [titleBlob, bodyBlob] = await Promise.all([encryptText('', key.key), encryptText('', key.key)])
  const activeFolderId = get(ui).activeFolderId
  const folderId = activeFolderId === '__pinned__' ? null : activeFolderId

  const stored: StoredNote = {
    id,
    titleBlob,
    bodyBlob,
    createdAt: now,
    updatedAt: now,
    tags: [],
    folderId,
    isPinned: false,
    attachmentIds: [],
  }
  const note: DecryptedNote = {
    id,
    title: '',
    body: '',
    createdAt: now,
    updatedAt: now,
    tags: [],
    folderId,
    isPinned: false,
    attachmentIds: [],
  }

  await saveNote(stored)
  syncNoteRecord(stored)
  updateInIndex({ id, title: '', body: '', tags: [], updatedAt: now })
  vaultActions.upsertNote(note)
  vaultActions.setPanel('notes')
  vaultActions.selectNote(id)
  return id
}
