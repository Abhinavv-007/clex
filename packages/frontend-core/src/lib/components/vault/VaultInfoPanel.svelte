<script lang="ts">
  import { activeNote, ui, vaultActions, wordCount, readTimeMins, relativeTime, attachments, formatBytes } from '$stores/vault'
  import { fly, fade } from 'svelte/transition'

  $: note = $activeNote
  $: noteAttachments = note ? ($attachments.get(note.id) ?? []) : []
</script>

{#if !$ui.infoPanelCollapsed}
  <div class="vip-root" in:fly={{ x: 12, duration: 180 }}>
    {#if note}
      <div class="vip-section">
        <div class="vip-section-title">Info</div>
        <div class="vip-rows">
          <div class="vip-row">
            <span class="vip-label">Created</span>
            <span class="vip-val">{relativeTime(note.createdAt)}</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Modified</span>
            <span class="vip-val">{relativeTime(note.updatedAt)}</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Words</span>
            <span class="vip-val">{wordCount(note.body)}</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Read time</span>
            <span class="vip-val">{readTimeMins(note.body)} min</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Characters</span>
            <span class="vip-val">{note.body.length}</span>
          </div>
        </div>
      </div>

      <div class="vip-divider" />

      <div class="vip-section">
        <div class="vip-section-title">Tags</div>
        {#if note.tags.length > 0}
          <div class="vip-tags">
            {#each note.tags as tag}
              <span class="vip-tag">#{tag}</span>
            {/each}
          </div>
        {:else}
          <p class="vip-empty-text">No tags yet — add tags in the editor.</p>
        {/if}
      </div>

      <div class="vip-divider" />

      <div class="vip-section">
        <div class="vip-section-header">
          <div class="vip-section-title">Attachments</div>
        </div>
        {#if noteAttachments.length > 0}
          <div class="vip-attachments">
            {#each noteAttachments as att}
              <div class="vip-att-item">
                <span class="vip-att-icon">📎</span>
                <div class="vip-att-info">
                  <span class="vip-att-name">{att.filename}</span>
                  <span class="vip-att-meta">{formatBytes(att.sizeBytes)}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="vip-empty-text">No files attached.</p>
        {/if}
      </div>
    {:else}
      <div class="vip-no-note">
        <p class="vip-empty-text">Select a note to see details.</p>
      </div>
    {/if}

    <!-- Collapse button -->
    <button
      class="vip-collapse-btn btn-icon"
      on:click={vaultActions.toggleInfoPanel}
      title="Hide info panel"
      aria-label="Hide info panel"
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M9 3l-4 4.5 4 4.5"/>
      </svg>
    </button>
  </div>
{/if}

<style>
  .vip-root {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-height: 0;
    height: 100%;
    position: relative;
    padding-top: 4px;
  }

  .vip-section {
    padding: 0 0 16px;
  }

  .vip-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .vip-section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
    margin-bottom: 8px;
  }

  .vip-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .vip-label {
    font-size: 12px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .vip-val {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
    text-align: right;
  }

  .vip-divider {
    height: 1px;
    background: var(--border);
    margin-bottom: 16px;
  }

  .vip-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vip-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent-text);
    background: var(--accent-dim);
    border: 1px solid var(--accent-border);
    border-radius: 4px;
    padding: 2px 7px;
  }

  .vip-empty-text {
    font-size: 12px;
    color: var(--text-3);
    font-style: italic;
    margin: 0;
  }

  .vip-attachments {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vip-att-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .vip-att-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .vip-att-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .vip-att-name {
    font-size: 12px;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vip-att-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .vip-no-note {
    padding: 20px 0;
  }

  .vip-collapse-btn {
    position: absolute;
    top: 0;
    right: 0;
  }
</style>
