<script lang="ts">
  import { ui, vaultActions, generateId } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import type { StoredNote } from '$lib/vault/db'
  import { masterKey } from '$stores/vault'
  import { saveNote } from '$lib/vault/db'
  import { encryptText } from '$lib/vault/crypto'
  import { search, updateInIndex } from '$lib/vault/search'
  import { syncNoteRecord } from '$lib/vault/sync'
  import FolderTree from './FolderTree.svelte'
  import NoteList from './NoteList.svelte'
  import { fly } from 'svelte/transition'

  let searchQuery = ''
  let searchResults: import('$lib/vault/search').SearchResult[] = []
  let searchDebounce: ReturnType<typeof setTimeout>

  function handleSearch(e: Event) {
    searchQuery = (e.target as HTMLInputElement).value
    vaultActions.setSearchQuery(searchQuery)
    clearTimeout(searchDebounce)
    if (!searchQuery.trim()) {
      searchResults = []
      vaultActions.setSearchResults(null)
      return
    }
    searchDebounce = setTimeout(() => {
      searchResults = search(searchQuery, 50)
      vaultActions.setSearchResults(searchResults)
    }, 150)
  }

  function clearSearch() {
    searchQuery = ''
    searchResults = []
    vaultActions.setSearchQuery('')
    vaultActions.setSearchResults(null)
  }

  async function createNote() {
    const key = $masterKey
    if (!key) return

    const now = Date.now()
    const id = generateId()
    const titleBlob = await encryptText('', key.key)
    const bodyBlob = await encryptText('', key.key)
    const nextFolderId = $ui.activeFolderId === '__pinned__' ? null : $ui.activeFolderId

    const newNote: DecryptedNote = {
      id,
      title: '',
      body: '',
      createdAt: now,
      updatedAt: now,
      tags: [],
      folderId: nextFolderId,
      isPinned: false,
      attachmentIds: [],
    }

    const storedNote: StoredNote = {
      id,
      titleBlob,
      bodyBlob,
      createdAt: now,
      updatedAt: now,
      tags: [],
      folderId: nextFolderId,
      isPinned: false,
      attachmentIds: [],
    }

    await saveNote(storedNote)
    syncNoteRecord(storedNote)

    updateInIndex({ id, title: '', body: '', tags: [], updatedAt: now })
    vaultActions.upsertNote(newNote)
    vaultActions.selectNote(id)
  }
</script>

<div class="vs-root" class:vs-collapsed={$ui.sidebarCollapsed}>
  {#if !$ui.sidebarCollapsed}
    <div class="vs-inner" in:fly={{ x: -8, duration: 180 }}>
      <!-- Header -->
      <div class="vs-header">
        <div class="vs-title-row">
          <span class="vs-vault-label">
            <span class="section-label-dot"></span>
            Vault
          </span>
          <div class="vs-header-actions">
            <button
              class="btn-icon"
              on:click={createNote}
              title="New note (⌘N)"
              aria-label="New note"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
                <path d="M8 3v10M3 8h10"/>
              </svg>
            </button>
            <button
              class="btn-icon"
              on:click={() => vaultActions.setPanel('settings')}
              title="Settings"
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="8" cy="8" r="2.5"/>
                <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.5 3.5l.85.85M11.65 11.65l.85.85M3.5 12.5l.85-.85M11.65 4.35l.85-.85"/>
              </svg>
            </button>
            <button
              class="btn-icon"
              on:click={vaultActions.toggleSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M10 3L6 8l4 5"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="vs-search-wrap">
          <span class="vs-search-icon">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="5.5" cy="5.5" r="4"/>
              <path d="M8.5 8.5l3 3"/>
            </svg>
          </span>
          <input
            class="vs-search input"
            type="search"
            placeholder="Search notes…"
            value={searchQuery}
            on:input={handleSearch}
          />
          {#if searchQuery}
            <button class="vs-search-clear btn-icon" on:click={clearSearch} aria-label="Clear search">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <path d="M2 2l7 7M9 2L2 9"/>
              </svg>
            </button>
          {/if}
        </div>
      </div>

      <!-- Folder tree -->
      <div class="vs-folders">
        <FolderTree />
      </div>

      <div class="vs-divider" />

      <!-- Note list -->
      <NoteList {searchResults} on:create={createNote} />
    </div>
  {:else}
    <!-- Collapsed state — show icon strip -->
    <div class="vs-collapsed-strip">
      <button class="btn-icon" on:click={vaultActions.toggleSidebar} title="Expand sidebar" aria-label="Expand sidebar">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M6 3l4 5-4 5"/>
        </svg>
      </button>
      <button class="btn-icon" on:click={createNote} title="New note" aria-label="New note">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M8 3v10M3 8h10"/>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  .vs-root {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    width: 260px;
    flex-shrink: 0;
    transition: width 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .vs-collapsed {
    width: 52px;
  }

  .vs-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: 0;
  }

  .vs-header {
    padding: 0 0 12px;
    flex-shrink: 0;
  }

  .vs-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .vs-vault-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vs-header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .vs-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .vs-search-icon {
    position: absolute;
    left: 10px;
    color: var(--text-3);
    pointer-events: none;
    display: flex;
    align-items: center;
  }

  .vs-search {
    padding-left: 32px;
    padding-right: 32px;
    height: 34px;
    font-size: 13px;
    border-radius: 8px;
    border-width: 1.5px;
  }

  .vs-search-clear {
    position: absolute;
    right: 4px;
    width: 26px;
    height: 26px;
    border-radius: 6px;
  }

  .vs-folders {
    flex-shrink: 0;
    margin-bottom: 8px;
  }

  .vs-divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0;
    flex-shrink: 0;
  }

  .vs-collapsed-strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 12px 0;
  }
</style>
