<script lang="ts">
  import { visibleNotes, ui, vaultActions, relativeTime, wordCount } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import { fade, fly } from 'svelte/transition'
  import { flip } from 'svelte/animate'

  export let searchResults: import('$lib/vault/search').SearchResult[] = []

  function selectNote(id: string) {
    vaultActions.selectNote(id)
  }

  function getSnippet(note: DecryptedNote): string {
    // Return first non-empty, non-heading line
    const lines = note.body.split('\n').filter(l => l.trim() && !l.startsWith('#'))
    const raw = (lines[0] ?? '').replace(/[*_`~\[\]]/g, '').slice(0, 120)
    return raw || 'Empty note'
  }

  function getSearchHighlight(id: string): { title: string; snippet: string } | null {
    const r = searchResults.find(r => r.id === id)
    if (!r) return null
    return { title: r.titleHighlight, snippet: r.snippet }
  }
</script>

<div class="nl-root scroll-thin">
  {#if $visibleNotes.length === 0}
    <div class="nl-empty" in:fade={{ duration: 200 }}>
      {#if $ui.searchQuery}
        <span class="nl-empty-icon">⊘</span>
        <p>No notes match "{$ui.searchQuery}"</p>
      {:else}
        <span class="nl-empty-icon">✦</span>
        <p>No notes yet</p>
        <button
          class="nl-create-btn btn-accent"
          on:click={() => vaultActions.setPanel('notes')}
        >
          Create first note
        </button>
      {/if}
    </div>
  {:else}
    {#each $visibleNotes as note (note.id)}
      {@const highlight = getSearchHighlight(note.id)}
      <button
        animate:flip={{ duration: 200 }}
        in:fly={{ y: 8, duration: 180 }}
        class="nl-item"
        class:nl-item--active={$ui.activeNoteId === note.id}
        on:click={() => selectNote(note.id)}
      >
        {#if note.isPinned}
          <span class="nl-pin" title="Pinned">📌</span>
        {/if}

        <div class="nl-title">
          {#if highlight}
            {@html highlight.title || note.title || 'Untitled'}
          {:else}
            {note.title || 'Untitled'}
          {/if}
        </div>

        <div class="nl-snippet">
          {#if highlight}
            {@html highlight.snippet}
          {:else}
            {getSnippet(note)}
          {/if}
        </div>

        <div class="nl-meta">
          <span>{relativeTime(note.updatedAt)}</span>
          {#if note.tags.length}
            <div class="nl-tags">
              {#each note.tags.slice(0, 2) as tag}
                <span class="nl-tag">#{tag}</span>
              {/each}
            </div>
          {/if}
        </div>
      </button>
    {/each}
  {/if}
</div>

<style>
  .nl-root {
    flex: 1 1 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 0;
  }

  .nl-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 20px;
    text-align: center;
  }

  .nl-empty-icon {
    font-size: 28px;
    color: var(--text-3);
  }

  .nl-empty p {
    font-size: 13px;
    color: var(--text-3);
    max-width: none;
    margin: 0;
  }

  .nl-create-btn {
    margin-top: 8px;
    font-size: 12px;
    padding: 8px 16px;
    border-radius: 8px;
  }

  .nl-item {
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1.5px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: background 150ms, border-color 150ms;
    position: relative;
    flex-shrink: 0;
  }

  .nl-item:hover {
    background: var(--raised);
    border-color: var(--border);
  }

  .nl-item--active {
    background: var(--surface-2);
    border-color: var(--border-strong);
  }

  .nl-pin {
    position: absolute;
    top: 10px;
    right: 12px;
    font-size: 11px;
    opacity: 0.6;
  }

  .nl-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 20px;
  }

  .nl-title :global(mark) {
    background: var(--accent-dim);
    color: var(--accent-text);
    border-radius: 2px;
    padding: 0 1px;
  }

  .nl-snippet {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .nl-snippet :global(mark) {
    background: var(--accent-dim);
    color: var(--accent-text);
    border-radius: 2px;
    padding: 0 1px;
  }

  .nl-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .nl-meta > span {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .nl-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .nl-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent-text);
    letter-spacing: 0.02em;
    opacity: 0.8;
  }
</style>
