<script lang="ts">
  import { activeNote, masterKey, ui, vaultActions } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import type { StoredNote } from '$lib/vault/db'
  import { saveNote, deleteNote as deleteStoredNote, saveDeletionTombstone } from '$lib/vault/db'
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

  // A brand new note starts with the cursor in its title.
  let focusedFor = ''
  $: if ($activeNote && $activeNote.id !== focusedFor) {
    focusedFor = $activeNote.id
    if (!$activeNote.title && !$activeNote.body) {
      requestAnimationFrame(() => titleInput?.focus())
    }
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
      await saveDeletionTombstone('note', note.id)
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
              <path d="M2.75 4.5h10.5"/>
              <path d="M6.1 2.75h3.8a.55.55 0 0 1 .55.55V4.5H5.55V3.3a.55.55 0 0 1 .55-.55Z"/>
              <path d="M4.5 5.5 5 12.4a.9.9 0 0 0 .9.8h4.2a.9.9 0 0 0 .9-.8l.5-6.9"/>
              <path d="M6.5 7.1v4.1M9.5 7.1v4.1"/>
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
            <path d="M5.25 2.75h5.5a.8.8 0 0 1 .8.8v8.9l-3.55-2.05-3.55 2.05v-8.9a.8.8 0 0 1 .8-.8Z"/>
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
            Encrypted and saved
          {/if}
        </span>
      </div>
    </div>

    <!-- Title -->
    <input
      bind:this={titleInput}
      class="ved-title"
      type="text"
      placeholder="Untitled note"
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
      <svg class="ved-empty-art" viewBox="0 0 96 96" aria-hidden="true">
        <rect x="18" y="12" width="52" height="68" rx="8" />
        <path d="M28 28h32M28 38h32M28 48h20" />
        <circle cx="66" cy="66" r="16" />
        <rect x="59" y="64" width="14" height="10" rx="2.5" />
        <path d="M62 64v-3a4 4 0 0 1 8 0v3" />
      </svg>
      <h3 class="ved-empty-title">Pick a note, or start a new one</h3>
      <p class="ved-empty-sub">Every note is encrypted before it is written to this device</p>
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
    padding: 14px clamp(16px, 2.4vw, 30px) 20px;
  }

  .ved-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 18px;
    flex-shrink: 0;
  }

  .ved-mode-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .ved-mode-btn {
    padding: 5px 14px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font-family: var(--font-sans);
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-3);
    cursor: pointer;
    transition: color 150ms, background 150ms, box-shadow 150ms;
    white-space: nowrap;
  }

  .ved-mode-btn--active {
    background: var(--surface);
    color: var(--text-1);
    box-shadow: var(--shadow-sm), 0 0 0 1px var(--border);
  }

  .ved-toolbar-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .ved-action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 11px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: var(--text-2);
    font-family: var(--font-sans);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms, color 150ms, border-color 150ms;
  }

  .ved-action-btn:hover {
    background: var(--surface-2);
    color: var(--text-1);
  }

  .ved-action-btn span {
    white-space: nowrap;
  }

  .ved-delete-confirm {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 4px 4px 4px 12px;
    border: 1px solid color-mix(in srgb, var(--red) 40%, transparent);
    border-radius: 11px;
    background: color-mix(in srgb, var(--red) 7%, var(--surface));
  }

  .ved-delete-copy {
    font-size: 12px;
    font-weight: 500;
    color: var(--red);
  }

  .ved-confirm-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-1);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }

  .ved-confirm-btn--danger {
    border-color: var(--red);
    background: var(--red);
    color: var(--surface);
  }

  .ved-action-btn--danger:hover {
    background: color-mix(in srgb, var(--red) 9%, var(--surface));
    color: var(--red);
  }

  .ved-action-btn--active {
    background: var(--accent-dim);
    color: var(--accent-text);
    border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .ved-save-state {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 6px;
    padding: 0 4px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-3);
    letter-spacing: 0.02em;
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
    padding: 0;
    margin-bottom: 10px;
    border: none;
    outline: none;
    background: transparent;
    font-family: var(--font-sans);
    font-size: clamp(24px, 2.4vw, 32px);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.035em;
    color: var(--text-1);
    flex-shrink: 0;
  }

  .ved-title::placeholder {
    color: var(--text-3);
    opacity: 0.55;
  }

  .ved-tags-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .ved-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--accent-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-text);
  }

  .ved-tag-remove {
    padding: 0 0 0 2px;
    border: none;
    background: none;
    font-size: 9px;
    line-height: 1;
    color: var(--accent-text);
    opacity: 0.6;
    cursor: pointer;
  }

  .ved-tag-remove:hover { opacity: 1; }

  .ved-tag-input {
    width: 70px;
    padding: 3px 8px;
    border: 1px dashed var(--border-strong);
    border-radius: 999px;
    outline: none;
    background: none;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
  }

  .ved-tag-input:focus {
    border-color: var(--accent);
    border-style: solid;
  }

  .ved-tag-input::placeholder { color: var(--text-3); }

  .ved-body {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* Nothing selected */
  .ved-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 24px;
  }

  .ved-empty-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 340px;
    text-align: center;
  }

  .ved-empty-art {
    width: 84px;
    height: 84px;
    margin-bottom: 6px;
  }

  .ved-empty-art rect,
  .ved-empty-art path,
  .ved-empty-art circle {
    fill: none;
    stroke: var(--border-strong);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .ved-empty-art circle {
    fill: var(--accent-dim);
    stroke: var(--accent);
  }

  .ved-empty-art circle ~ rect,
  .ved-empty-art circle ~ path {
    stroke: var(--accent);
  }

  .ved-empty-title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.025em;
    color: var(--text-1);
  }

  .ved-empty-sub {
    margin: 0;
    font-size: 13px;
    color: var(--text-3);
  }

  .ved-shortcuts {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 10px;
  }

  .ved-shortcut {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-3);
  }

  kbd {
    padding: 1px 6px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--surface-2);
    box-shadow: 0 1.5px 0 var(--border-strong);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
  }
</style>
