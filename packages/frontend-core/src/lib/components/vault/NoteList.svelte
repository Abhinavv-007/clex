<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { visibleNotes, ui, vaultActions, relativeTime, wordCount } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import { fade, fly } from 'svelte/transition'
  import { flip } from 'svelte/animate'

  export let searchResults: import('$lib/vault/search').SearchResult[] = []

  const dispatch = createEventDispatcher<{ create: void }>()

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

  function requestCreate() {
    dispatch('create')
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
          on:click={requestCreate}
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
          <span class="nl-pin" title="Pinned">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M10.5 2.5L9 6.5h-3L4 8l3 1 .9 3.5 1.6-2.4 2.8 1.2 .7-1.7-2.5-1.6z"/>
            </svg>
            Pinned
          </span>
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
          <span>{relativeTime(note.updatedAt)} · {wordCount(note.body)} words</span>
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
    gap: 6px;
    min-height: 0;
    margin: 0 -4px;
    padding: 0 4px 4px;
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
    font-size: 24px;
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
    padding: 10px 18px;
    border-radius: 12px;
  }

  .nl-item {
    position: relative;
    flex-shrink: 0;
    width: 100%;
    padding: 12px 14px 12px 16px;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 160ms, border-color 160ms, box-shadow 160ms;
  }

  .nl-item::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 14px;
    bottom: 14px;
    width: 2.5px;
    border-radius: 3px;
    background: var(--accent);
    transform: scaleY(0);
    transition: transform 240ms var(--spring);
  }

  .nl-item:hover {
    background: var(--surface);
    border-color: var(--border);
  }

  .nl-item--active {
    background: var(--surface);
    border-color: var(--border-strong);
    box-shadow: var(--shadow-sm);
  }

  .nl-item--active::before {
    transform: scaleY(1);
  }

  .nl-pin {
    position: absolute;
    top: 11px;
    right: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-text);
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .nl-title {
    margin-bottom: 4px;
    padding-right: 64px;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nl-title :global(mark),
  .nl-snippet :global(mark) {
    background: var(--accent-dim);
    color: var(--accent-text);
    border-radius: 2px;
    padding: 0 1px;
  }

  .nl-snippet {
    display: -webkit-box;
    margin-bottom: 8px;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--text-3);
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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
    letter-spacing: 0.03em;
  }

  .nl-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .nl-tag {
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--accent-dim);
    font-family: var(--font-mono);
    font-size: 9.5px;
    color: var(--accent-text);
  }
</style>
