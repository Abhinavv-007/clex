<script lang="ts">
  import type { FileEntry } from '$stores/files'
  import { filesStore } from '$stores/files'
  import { getFileCategory, getFileCategoryColor, getExtLabel } from '$utils/fileType'
  import { formatBytes, truncateName } from '$utils/format'

  export let entry: FileEntry
  export let selected = false

  $: category = getFileCategory(entry.type, entry.name)
  $: color = getFileCategoryColor(category)
  $: extLabel = getExtLabel(entry.name)
  $: hasProcessed = !!entry.processed
</script>

<div class="fc-root" class:fc-selected={selected}>
  <!-- File type icon / preview -->
  <div class="fc-icon" style="background: {color}12; border-color: {color}22;">
    {#if entry.previewUrl && category === 'image'}
      <img
        src={entry.previewUrl}
        alt={entry.name}
        class="fc-preview-img"
        loading="lazy"
      />
    {:else}
      <span class="fc-ext" style="color: {color};">{extLabel}</span>
    {/if}

    {#if hasProcessed}
      <div class="fc-processed-dot" title="Processed: {entry.processed?.operation}">
        <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
          <path d="M1.5 3.5L3 5 5.5 2" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    {/if}
  </div>

  <!-- Info -->
  <div class="fc-info">
    <p class="fc-name" title={entry.name}>{truncateName(entry.name, 26)}</p>
    <div class="fc-meta-row">
      <span class="fc-size">{formatBytes(entry.size)}</span>
      {#if hasProcessed}
        <span class="fc-op-badge">{entry.processed?.operation}</span>
      {/if}
    </div>
  </div>

  <!-- Remove -->
  <button
    class="fc-remove"
    on:click|stopPropagation={() => filesStore.remove(entry.id)}
    aria-label="Remove {entry.name}"
  >
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  </button>
</div>

<style>
  .fc-root {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 9px;
    border: 2px solid var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
    background: var(--surface);
    cursor: default;
    transition: transform 0.15s, box-shadow 0.15s;
    position: relative;
  }

  .fc-root:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .fc-selected {
    border-color: var(--border-focus);
  }

  /* Icon */
  .fc-icon {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }

  .fc-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fc-ext {
    font-size: 9px;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: 0.03em;
  }

  .fc-processed-dot {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #22c55e;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--raised);
  }

  /* Info */
  .fc-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .fc-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fc-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .fc-size {
    font-size: 10px;
    color: var(--text-3);
  }

  .fc-op-badge {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 100px;
    background: rgba(34,197,94,0.1);
    color: #22c55e;
    border: 1px solid rgba(34,197,94,0.2);
    font-weight: 500;
  }

  /* Remove button */
  .fc-remove {
    opacity: 0;
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-3);
    cursor: pointer;
    transition: opacity 0.15s, color 0.15s, background 0.15s;
  }

  .fc-root:hover .fc-remove { opacity: 1; }
  .fc-remove:hover { color: #ef4444; background: rgba(239,68,68,0.06); }
</style>
