<script lang="ts">
  import { rootFolders, folders, notes, ui, vaultActions, generateId } from '$stores/vault'
  import type { StoredFolder } from '$lib/vault/db'
  import { saveFolder, deleteFolder as dbDeleteFolder } from '$lib/vault/db'
  import { fly, slide } from 'svelte/transition'
  import { flip } from 'svelte/animate'

  let newFolderName = ''
  let creatingFolder = false
  let editingFolderId: string | null = null
  let editName = ''
  let expandedFolders = new Set<string>()

  function getNoteCount(folderId: string): number {
    return $notes.filter(n => n.folderId === folderId).length
  }

  function getChildren(parentId: string): StoredFolder[] {
    return $folders.filter(f => f.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    const folder: StoredFolder = {
      id: generateId(),
      name: newFolderName.trim(),
      parentId: null,
      createdAt: Date.now(),
      sortOrder: $folders.length,
    }
    await saveFolder(folder)
    vaultActions.upsertFolder(folder)
    newFolderName = ''
    creatingFolder = false
  }

  async function renameFolder(id: string) {
    if (!editName.trim()) { editingFolderId = null; return }
    const folder = $folders.find(f => f.id === id)
    if (!folder) return
    const updated = { ...folder, name: editName.trim() }
    await saveFolder(updated)
    vaultActions.upsertFolder(updated)
    editingFolderId = null
  }

  async function removeFolder(id: string) {
    await dbDeleteFolder(id)
    vaultActions.removeFolder(id)
  }

  function startEdit(folder: StoredFolder) {
    editingFolderId = folder.id
    editName = folder.name
  }

  function toggleExpand(id: string) {
    if (expandedFolders.has(id)) {
      expandedFolders.delete(id)
    } else {
      expandedFolders.add(id)
    }
    expandedFolders = expandedFolders // trigger reactivity
  }

  function handleNewFolderKey(e: KeyboardEvent) {
    if (e.key === 'Enter') createFolder()
    if (e.key === 'Escape') { creatingFolder = false; newFolderName = '' }
  }

  function handleRenameKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter') renameFolder(id)
    if (e.key === 'Escape') editingFolderId = null
  }
</script>

<div class="ft-root">
  <!-- All Notes -->
  <button
    class="ft-item ft-item--all"
    class:ft-item--active={$ui.activeFolderId === null}
    on:click={() => vaultActions.selectFolder(null)}
  >
    <span class="ft-icon">◈</span>
    <span class="ft-name">All Notes</span>
    <span class="ft-count">{$notes.length}</span>
  </button>

  <!-- Pinned -->
  {#if $notes.some(n => n.isPinned)}
    <button
      class="ft-item"
      class:ft-item--active={$ui.activeFolderId === '__pinned__'}
      on:click={() => vaultActions.selectFolder('__pinned__')}
    >
      <span class="ft-icon">📌</span>
      <span class="ft-name">Pinned</span>
      <span class="ft-count">{$notes.filter(n => n.isPinned).length}</span>
    </button>
  {/if}

  <div class="ft-divider" />

  <!-- Folders -->
  {#each $rootFolders as folder (folder.id)}
    {@const children = getChildren(folder.id)}
    {@const count = getNoteCount(folder.id)}
    <div animate:flip={{ duration: 180 }} class="ft-folder-group">
      {#if editingFolderId === folder.id}
        <div class="ft-edit-row">
          <input
            class="ft-edit-input input"
            bind:value={editName}
            on:keydown={(e) => handleRenameKey(e, folder.id)}
            on:blur={() => renameFolder(folder.id)}
            autofocus
          />
        </div>
      {:else}
        <div class="ft-folder-row">
          <button
            class="ft-item ft-item--folder"
            class:ft-item--active={$ui.activeFolderId === folder.id}
            on:click={() => vaultActions.selectFolder(folder.id)}
          >
            {#if children.length}
              <button
                class="ft-expand-btn"
                on:click|stopPropagation={() => toggleExpand(folder.id)}
                aria-label="Toggle folder"
              >
                {expandedFolders.has(folder.id) ? '▾' : '▸'}
              </button>
            {:else}
              <span class="ft-icon">▷</span>
            {/if}
            <span class="ft-name">{folder.name}</span>
            <span class="ft-count">{count}</span>
          </button>
          <div class="ft-folder-actions">
            <button class="ft-action-btn" on:click={() => startEdit(folder)} title="Rename">✎</button>
            <button class="ft-action-btn ft-action-btn--danger" on:click={() => removeFolder(folder.id)} title="Delete">✕</button>
          </div>
        </div>
      {/if}

      {#if expandedFolders.has(folder.id) && children.length}
        <div class="ft-children" transition:slide={{ duration: 180 }}>
          {#each children as child (child.id)}
            <button
              class="ft-item ft-item--child"
              class:ft-item--active={$ui.activeFolderId === child.id}
              on:click={() => vaultActions.selectFolder(child.id)}
            >
              <span class="ft-icon">▷</span>
              <span class="ft-name">{child.name}</span>
              <span class="ft-count">{getNoteCount(child.id)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  <!-- New folder row -->
  {#if creatingFolder}
    <div class="ft-new-folder" transition:slide={{ duration: 150 }}>
      <input
        class="ft-new-input input"
        bind:value={newFolderName}
        placeholder="Folder name"
        on:keydown={handleNewFolderKey}
        autofocus
      />
    </div>
  {:else}
    <button class="ft-add-btn" on:click={() => (creatingFolder = true)}>
      <span>+</span> New folder
    </button>
  {/if}
</div>

<style>
  .ft-root {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .ft-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1.5px solid transparent;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    color: var(--text-2);
    transition: background 130ms, color 130ms, border-color 130ms;
    min-width: 0;
  }

  .ft-item:hover {
    background: var(--raised);
    color: var(--text-1);
  }

  .ft-item--active {
    background: var(--surface-2);
    border-color: var(--border);
    color: var(--text-1);
    font-weight: 600;
  }

  .ft-item--all .ft-icon { color: var(--accent-text); }

  .ft-icon {
    font-size: 11px;
    flex-shrink: 0;
    color: var(--text-3);
  }

  .ft-name {
    flex: 1 1 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ft-count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .ft-divider {
    height: 1px;
    background: var(--border);
    margin: 6px 0;
  }

  .ft-folder-group {
    position: relative;
  }

  .ft-folder-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .ft-folder-row .ft-item--folder {
    flex: 1 1 0;
    min-width: 0;
  }

  .ft-folder-actions {
    display: none;
    gap: 2px;
    padding-right: 4px;
    flex-shrink: 0;
  }

  .ft-folder-row:hover .ft-folder-actions {
    display: flex;
  }

  .ft-action-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-3);
    padding: 4px 6px;
    border-radius: 6px;
    transition: background 130ms, color 130ms;
  }

  .ft-action-btn:hover {
    background: var(--raised);
    color: var(--text-1);
  }

  .ft-action-btn--danger:hover {
    color: var(--red);
    background: rgba(255, 68, 102, 0.1);
  }

  .ft-expand-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 10px;
    color: var(--text-3);
    padding: 0;
    width: 16px;
    flex-shrink: 0;
    line-height: 1;
  }

  .ft-item--child {
    padding-left: 24px;
  }

  .ft-children {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .ft-edit-row {
    padding: 4px 2px;
  }

  .ft-edit-input {
    height: 32px;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 8px;
  }

  .ft-new-folder {
    padding: 4px 2px;
  }

  .ft-new-input {
    height: 32px;
    font-size: 13px;
    padding: 6px 10px;
    border-radius: 8px;
  }

  .ft-add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1.5px dashed var(--border);
    background: transparent;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-3);
    transition: border-color 130ms, color 130ms, background 130ms;
    margin-top: 4px;
  }

  .ft-add-btn:hover {
    border-color: var(--accent);
    color: var(--accent-text);
    background: var(--accent-dim);
  }
</style>
