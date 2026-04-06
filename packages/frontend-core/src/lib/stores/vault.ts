/**
 * Vault Svelte Stores
 *
 * Central state for the Vault app — notes, folders, active note,
 * sync status, search, and UI state.
 */

import { writable, derived, get } from 'svelte/store'
import type { StoredNote, StoredFolder, StoredDevice, StoredAttachment } from '../vault/db'
import type { MasterKey } from '../vault/crypto'
import type { SyncState } from '../vault/sync'
import type { SearchResult } from '../vault/search'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DecryptedNote {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
  tags: string[]
  folderId: string | null
  isPinned: boolean
  attachmentIds: string[]
}

export type VaultPanel = 'notes' | 'settings' | 'secrets' | 'share'
export type SettingsTab = 'devices' | 'storage' | 'encryption' | 'account' | 'data'

export interface VaultUIState {
  activePanel: VaultPanel
  activeFolderId: string | null
  activeNoteId: string | null
  searchQuery: string
  searchResults: SearchResult[] | null
  editorMode: 'edit' | 'preview'
  sidebarCollapsed: boolean
  infoPanelCollapsed: boolean
  settingsTab: SettingsTab
  pairingModalOpen: boolean
  secretsView: 'create' | 'list'
  loading: boolean
  error: string | null
}

// ── Raw stores ────────────────────────────────────────────────────────────────

export const masterKey = writable<MasterKey | null>(null)
export const notes = writable<DecryptedNote[]>([])
export const folders = writable<StoredFolder[]>([])
export const devices = writable<StoredDevice[]>([])
export const attachments = writable<Map<string, StoredAttachment[]>>(new Map())
export const syncState = writable<SyncState>({
  connected: false,
  peerCount: 0,
  syncing: false,
  lastSync: null,
  error: null,
})

export const ui = writable<VaultUIState>({
  activePanel: 'notes',
  activeFolderId: null,
  activeNoteId: null,
  searchQuery: '',
  searchResults: null,
  editorMode: 'edit',
  sidebarCollapsed: false,
  infoPanelCollapsed: false,
  settingsTab: 'devices',
  pairingModalOpen: false,
  secretsView: 'create',
  loading: true,
  error: null,
})

// ── Derived stores ────────────────────────────────────────────────────────────

/** Notes visible in the current folder (or all if no folder selected) */
export const visibleNotes = derived([notes, ui], ([$notes, $ui]) => {
  if ($ui.searchQuery && $ui.searchResults) {
    const resultIds = new Set($ui.searchResults.map(r => r.id))
    return $notes.filter(n => resultIds.has(n.id))
      .sort((a, b) => {
        const ia = $ui.searchResults!.findIndex(r => r.id === a.id)
        const ib = $ui.searchResults!.findIndex(r => r.id === b.id)
        return ia - ib
      })
  }
  const base = $ui.activeFolderId !== null
    ? $notes.filter(n => n.folderId === $ui.activeFolderId)
    : $notes
  return base.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return b.updatedAt - a.updatedAt
  })
})

/** Currently active note */
export const activeNote = derived([notes, ui], ([$notes, $ui]) =>
  $ui.activeNoteId ? ($notes.find(n => n.id === $ui.activeNoteId) ?? null) : null
)

/** Root folders (no parent) */
export const rootFolders = derived(folders, $folders =>
  $folders.filter(f => f.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder)
)

/** Children of a folder by ID */
export function childFolders(parentId: string) {
  return derived(folders, $folders =>
    $folders.filter(f => f.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)
  )
}

/** Total note count */
export const noteCount = derived(notes, $notes => $notes.length)

/** Storage used (sum of attachment sizes from all notes) */
export const storageUsed = derived(attachments, $atts => {
  let total = 0
  for (const list of $atts.values()) {
    for (const a of list) total += a.sizeBytes
  }
  return total
})

// ── Store Actions ─────────────────────────────────────────────────────────────

export const vaultActions = {
  setMasterKey(key: MasterKey) {
    masterKey.set(key)
  },

  setNotes(decrypted: DecryptedNote[]) {
    notes.set(decrypted)
  },

  upsertNote(note: DecryptedNote) {
    notes.update(all => {
      const idx = all.findIndex(n => n.id === note.id)
      if (idx >= 0) {
        const next = [...all]
        next[idx] = note
        return next
      }
      return [note, ...all]
    })
  },

  removeNote(id: string) {
    notes.update(all => all.filter(n => n.id !== id))
    ui.update(s => ({
      ...s,
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }))
  },

  setFolders(list: StoredFolder[]) {
    folders.set(list)
  },

  upsertFolder(folder: StoredFolder) {
    folders.update(all => {
      const idx = all.findIndex(f => f.id === folder.id)
      if (idx >= 0) {
        const next = [...all]
        next[idx] = folder
        return next
      }
      return [...all, folder]
    })
  },

  removeFolder(id: string) {
    folders.update(all => all.filter(f => f.id !== id))
    ui.update(s => ({
      ...s,
      activeFolderId: s.activeFolderId === id ? null : s.activeFolderId,
    }))
  },

  setDevices(list: StoredDevice[]) {
    devices.set(list)
  },

  upsertDevice(device: StoredDevice) {
    devices.update(all => {
      const idx = all.findIndex(d => d.id === device.id)
      if (idx >= 0) {
        const next = [...all]
        next[idx] = device
        return next
      }
      return [...all, device]
    })
  },

  removeDevice(id: string) {
    devices.update(all => all.filter(d => d.id !== id))
  },

  setAttachmentsForNote(noteId: string, list: StoredAttachment[]) {
    attachments.update(m => {
      const next = new Map(m)
      next.set(noteId, list)
      return next
    })
  },

  setSyncState(state: SyncState) {
    syncState.set(state)
  },

  // UI actions
  setPanel(panel: VaultPanel) {
    ui.update(s => ({ ...s, activePanel: panel }))
  },

  selectNote(id: string | null) {
    ui.update(s => ({ ...s, activeNoteId: id }))
  },

  selectFolder(id: string | null) {
    ui.update(s => ({ ...s, activeFolderId: id, activeNoteId: null }))
  },

  setSearchQuery(q: string) {
    ui.update(s => ({ ...s, searchQuery: q }))
  },

  setSearchResults(results: SearchResult[] | null) {
    ui.update(s => ({ ...s, searchResults: results }))
  },

  setEditorMode(mode: 'edit' | 'preview') {
    ui.update(s => ({ ...s, editorMode: mode }))
  },

  toggleSidebar() {
    ui.update(s => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))
  },

  toggleInfoPanel() {
    ui.update(s => ({ ...s, infoPanelCollapsed: !s.infoPanelCollapsed }))
  },

  openPairingModal() {
    ui.update(s => ({ ...s, pairingModalOpen: true }))
  },

  closePairingModal() {
    ui.update(s => ({ ...s, pairingModalOpen: false }))
  },

  setSettingsTab(tab: SettingsTab) {
    ui.update(s => ({ ...s, settingsTab: tab }))
  },

  setLoading(loading: boolean) {
    ui.update(s => ({ ...s, loading }))
  },

  setError(error: string | null) {
    ui.update(s => ({ ...s, error }))
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export function readTimeMins(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 200))
}

export function relativeTime(ts: number): string {
  const diff = (Date.now() - ts) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts).toLocaleDateString()
}
