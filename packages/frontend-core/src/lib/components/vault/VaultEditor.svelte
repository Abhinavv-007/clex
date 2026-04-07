<script lang="ts">
  import { activeNote, masterKey, ui, vaultActions } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import type { StoredNote } from '$lib/vault/db'
  import { saveNote, deleteNote as deleteStoredNote } from '$lib/vault/db'
  import { encryptText } from '$lib/vault/crypto'
  import { removeFromIndex, updateInIndex } from '$lib/vault/search'
  import { syncDeleteNote, syncNoteRecord } from '$lib/vault/sync'
  import MarkdownEditor from './MarkdownEditor.svelte'
  import { fade } from 'svelte/transition'

  let titleInput: HTMLInputElement
  let saving = false
  let saveError = false
  let confirmDelete = false
  let deletePromptNoteId = ''

  $: if (($activeNote?.id ?? '') !== deletePromptNoteId) {
    deletePromptNoteId = $activeNote?.id ?? ''
    confirmDelete = false
  }

  $: if (!$activeNote) {
    confirmDelete = false
  }

  async function handleTitleInput(e: Event) {
    const note = $activeNote
    if (!note) return
    const title = (e.target as HTMLInputElement).value
    const updated: DecryptedNote = { ...note, title, updatedAt: Date.now() }
    vaultActions.upsertNote(updated)
    confirmDelete = false
    scheduleNoteSave(updated)
  }

  async function handleBodyInput(body: string) {
    const note = $activeNote
    if (!note) return
    const updated: DecryptedNote = { ...note, body, updatedAt: Date.now() }
    vaultActions.upsertNote(updated)
    confirmDelete = false
    scheduleNoteSave(updated)
  }

  let saveTimer: ReturnType<typeof setTimeout>
  function scheduleNoteSave(note: DecryptedNote) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => persistNote(note), 600)
  }

  async function persistNote(note: DecryptedNote) {
    const key = $masterKey
    if (!key) return
    saving = true
    saveError = false
    try {
      const storedNote = await buildStoredNote(note, key.key)
      await saveNote(storedNote)
      syncNoteRecord(storedNote)
      updateInIndex({ id: note.id, title: note.title, body: note.body, tags: note.tags, updatedAt: note.updatedAt })
    } catch (e) {
      saveError = true
      console.error('[vault] save failed:', e)
    } finally {
      saving = false
    }
  }

  async function togglePin() {
    const note = $activeNote
    const key = $masterKey
    if (!note || !key) return
    const updated: DecryptedNote = { ...note, isPinned: !note.isPinned, updatedAt: Date.now() }
    vaultActions.upsertNote(updated)
    confirmDelete = false
    await persistNote(updated)
  }

  async function addTag(tag: string) {
    const note = $activeNote
    if (!note || note.tags.includes(tag)) return
    const updated: DecryptedNote = { ...note, tags: [...note.tags, tag], updatedAt: Date.now() }
    vaultActions.upsertNote(updated)
    confirmDelete = false
    await persistNote(updated)
  }

  async function removeTag(tag: string) {
    const note = $activeNote
    if (!note) return
    const updated: DecryptedNote = { ...note, tags: note.tags.filter(t => t !== tag), updatedAt: Date.now() }
    vaultActions.upsertNote(updated)
    confirmDelete = false
    await persistNote(updated)
  }

  let tagInput = ''
  function handleTagKey(e: KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      void addTag(tagInput.trim().toLowerCase().replace(/\s+/g, '-'))
      tagInput = ''
    }
  }

  async function buildStoredNote(note: DecryptedNote, key: CryptoKey): Promise<StoredNote> {
    const [titleBlob, bodyBlob] = await Promise.all([
      encryptText(note.title, key),
      encryptText(note.body, key),
    ])

    return {
      id: note.id,
      titleBlob,
      bodyBlob,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      tags: note.tags,
      folderId: note.folderId,
      isPinned: note.isPinned,
      attachmentIds: note.attachmentIds,
    }
  }

  async function deleteNote() {
    const note = $activeNote
    if (!note) return

    if (!confirmDelete) {
      confirmDelete = true
      return
    }

    clearTimeout(saveTimer)
    saving = false
    saveError = false

    try {
      await deleteStoredNote(note.id)
      syncDeleteNote(note.id)
      removeFromIndex(note.id)
      vaultActions.removeNote(note.id)
      confirmDelete = false
      tagInput = ''
    } catch (e) {
      saveError = true
      console.error('[vault] delete failed:', e)
    }
  }
</script>

{#if $activeNote}
  {@const note = $activeNote}
  <div class="ved-root" in:fade={{ duration: 180 }}>
    <!-- Toolbar -->
    <div class="ved-toolbar">
      <div class="ved-mode-tabs">
        <button
          class="ved-mode-btn"
          class:ved-mode-btn--active={$ui.editorMode === 'edit'}
          on:click={() => vaultActions.setEditorMode('edit')}
        >Edit</button>
        <button
          class="ved-mode-btn"
          class:ved-mode-btn--active={$ui.editorMode === 'preview'}
          on:click={() => vaultActions.setEditorMode('preview')}
        >Preview</button>
      </div>

      <div class="ved-toolbar-actions">
        {#if confirmDelete}
          <div class="ved-delete-confirm" in:fade={{ duration: 120 }}>
            <span class="ved-delete-copy">Delete this note</span>
            <button class="ved-confirm-btn" type="button" on:click={() => (confirmDelete = false)}>
              Cancel
            </button>
            <button class="ved-confirm-btn ved-confirm-btn--danger" type="button" on:click={deleteNote}>
              Delete
            </button>
          </div>
        {:else}
          <button
            class="ved-action-btn ved-action-btn--danger"
            on:click={deleteNote}
            title="Delete note"
            aria-label="Delete note"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3.5 4.5h9"/>
              <path d="M6 4.5V3.25h4v1.25"/>
              <path d="M5.25 6.25v5.25M8 6.25v5.25M10.75 6.25v5.25"/>
              <path d="M4.5 4.5l.6 8h5.8l.6-8"/>
            </svg>
            <span>Delete</span>
          </button>
        {/if}

        <button
          class="ved-action-btn"
          class:ved-action-btn--active={note.isPinned}
          on:click={togglePin}
          title={note.isPinned ? 'Unpin note' : 'Pin note'}
          aria-label="Toggle pin"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill={note.isPinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.5 2.5L9 6.5h-3L4 8l3 1 .9 3.5 1.6-2.4 2.8 1.2 .7-1.7-2.5-1.6z"/>
          </svg>
          <span>{note.isPinned ? 'Pinned' : 'Pin'}</span>
        </button>

        <button
          class="ved-action-btn"
          class:ved-action-btn--active={!$ui.infoPanelCollapsed}
          on:click={vaultActions.toggleInfoPanel}
          title="Toggle info panel"
          aria-label="Toggle info panel"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="6"/>
            <path d="M7.5 7v4M7.5 4.5v.5"/>
          </svg>
          <span>Details</span>
        </button>

        <span class="ved-save-state" class:ved-save-state--saving={saving} class:ved-save-state--error={saveError}>
          {#if saving}
            <span class="ved-save-dot ved-save-dot--saving"></span>
            Saving…
          {:else if saveError}
            <span class="ved-save-dot ved-save-dot--error"></span>
            Error
          {:else}
            <span class="ved-save-dot ved-save-dot--ok"></span>
            Saved
          {/if}
        </span>
      </div>
    </div>

    <!-- Title -->
    <input
      bind:this={titleInput}
      class="ved-title"
      type="text"
      placeholder="Untitled"
      value={note.title}
      on:input={handleTitleInput}
    />

    <!-- Tags row -->
    {#if note.tags.length > 0 || true}
      <div class="ved-tags-row">
        {#each note.tags as tag}
          <span class="ved-tag">
            #{tag}
            <button class="ved-tag-remove" on:click={() => removeTag(tag)} aria-label="Remove tag {tag}">✕</button>
          </span>
        {/each}
        <input
          class="ved-tag-input"
          bind:value={tagInput}
          placeholder="+ tag"
          on:keydown={handleTagKey}
        />
      </div>
    {/if}

    <!-- Editor body -->
    <div class="ved-body">
      <MarkdownEditor
        value={note.body}
        mode={$ui.editorMode}
        placeholder="Start writing… markdown supported"
        on:input={(e) => handleBodyInput(e.detail)}
        on:save={() => persistNote(note)}
      />
    </div>
  </div>
{:else}
  <div class="ved-empty" in:fade={{ duration: 200 }}>
    <div class="ved-empty-inner">
      <div class="ved-empty-icon">⬡</div>
      <h3 class="ved-empty-title">Vault</h3>
      <p class="ved-empty-sub">Select a note or create a new one</p>
      <div class="ved-shortcuts">
        <div class="ved-shortcut"><kbd>⌘B</kbd> bold</div>
        <div class="ved-shortcut"><kbd>⌘I</kbd> italic</div>
        <div class="ved-shortcut"><kbd>⌘`</kbd> code</div>
        <div class="ved-shortcut"><kbd>⌘K</kbd> link</div>
      </div>
    </div>
  </div>
{/if}

<style>
  .ved-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .ved-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .ved-mode-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    background: var(--surface-2);
    border: 1.5px solid var(--border-hard);
    border-radius: 9px;
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .ved-mode-btn {
    padding: 4px 14px;
    border-radius: 7px;
    border: 1.5px solid transparent;
    background: transparent;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .ved-mode-btn--active {
    background: var(--surface);
    border-color: var(--border-hard);
    color: var(--text-1);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .ved-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .ved-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 34px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    color: var(--text-1);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, color 120ms ease;
  }

  .ved-action-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .ved-action-btn span {
    white-space: nowrap;
  }

  .ved-delete-confirm {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 8px 6px 10px;
    border: 1.5px solid rgba(255, 68, 102, 0.4);
    border-radius: 999px;
    background: color-mix(in srgb, var(--red) 8%, var(--surface));
  }

  .ved-delete-copy {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--red);
  }

  .ved-confirm-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    color: var(--text-1);
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .ved-confirm-btn--danger,
  .ved-action-btn--danger {
    color: var(--red);
  }

  .ved-action-btn--danger {
    border-color: color-mix(in srgb, var(--red) 72%, var(--border-hard));
    background: color-mix(in srgb, var(--red) 10%, var(--surface));
  }

  .ved-confirm-btn--danger {
    border-color: var(--red);
    background: color-mix(in srgb, var(--red) 10%, var(--surface));
  }

  .ved-action-btn--active {
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    color: var(--accent-text);
    border-color: color-mix(in srgb, var(--accent) 68%, var(--border-hard));
  }

  .ved-save-state {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
    padding: 4px 10px;
    border-radius: 6px;
    background: var(--raised);
    border: 1px solid var(--border);
  }

  .ved-save-state--saving { color: var(--amber); }
  .ved-save-state--error { color: var(--red); }

  .ved-save-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    flex-shrink: 0;
  }

  .ved-save-dot--saving {
    background: var(--amber);
    animation: pulse-dot 1s ease-in-out infinite;
  }

  .ved-save-dot--error {
    background: var(--red);
  }

  .ved-title {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    line-height: 1.2;
    padding: 0;
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .ved-title::placeholder {
    color: var(--text-3);
  }

  .ved-tags-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    min-height: 28px;
    flex-shrink: 0;
  }

  .ved-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-text);
    background: var(--accent-dim);
    border: 1px solid var(--accent-border);
    border-radius: 5px;
    padding: 2px 8px;
    letter-spacing: 0.03em;
  }

  .ved-tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 9px;
    color: var(--accent-text);
    opacity: 0.6;
    padding: 0 0 0 2px;
    line-height: 1;
  }

  .ved-tag-remove:hover { opacity: 1; }

  .ved-tag-input {
    background: none;
    border: none;
    outline: none;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    width: 60px;
    padding: 0;
  }

  .ved-tag-input::placeholder { color: var(--text-3); opacity: 0.6; }

  .ved-body {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Empty state */
  .ved-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .ved-empty-inner {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .ved-empty-icon {
    font-size: 40px;
    color: var(--text-3);
    opacity: 0.4;
  }

  .ved-empty-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .ved-empty-sub {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }

  .ved-shortcuts {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .ved-shortcut {
    font-size: 12px;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 5px;
  }

  kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    background: var(--surface-2);
    border: 1.5px solid var(--border-hard);
    border-radius: 5px;
    padding: 1px 6px;
    box-shadow: 0 2px 0 var(--border-hard);
    color: var(--text-2);
  }
</style>
