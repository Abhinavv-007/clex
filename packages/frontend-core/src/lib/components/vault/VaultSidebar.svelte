<script lang="ts">
  import { ui, vaultActions } from '$stores/vault'
  import { search } from '$lib/vault/search'
  import { createVaultNote } from '$lib/vault/createNote'
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
    await createVaultNote()
  }
</script>

<div class="vs-root" class:vs-collapsed={$ui.sidebarCollapsed}>
  {#if !$ui.sidebarCollapsed}
    <div class="vs-inner" in:fly={{ x: -8, duration: 180 }}>
      <!-- Header -->
      <div class="vs-header">
        <button class="vs-new" type="button" on:click={createNote}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          New note
          <span class="vs-new-lock" aria-hidden="true">encrypted</span>
        </button>

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
    width: 100%;
  }

  .vs-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .vs-header {
    display: grid;
    gap: 10px;
    padding: 0 0 12px;
    flex-shrink: 0;
  }

  .vs-new {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: var(--text-1);
    color: var(--canvas);
    font-family: var(--font-sans);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: transform 200ms var(--spring), box-shadow 200ms var(--ease-out);
  }

  .vs-new:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .vs-new-lock {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--canvas) 16%, transparent);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    opacity: 0.8;
  }

  .vs-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .vs-search-icon {
    position: absolute;
    left: 11px;
    color: var(--text-3);
    pointer-events: none;
    display: flex;
    align-items: center;
  }

  .vs-search {
    width: 100%;
    height: 36px;
    padding-left: 32px;
    padding-right: 32px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    font-size: 13px;
  }

  .vs-search:focus {
    border-color: var(--accent);
    box-shadow: var(--shadow-accent);
    outline: none;
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
    margin-bottom: 4px;
  }

  .vs-divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0 10px;
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
