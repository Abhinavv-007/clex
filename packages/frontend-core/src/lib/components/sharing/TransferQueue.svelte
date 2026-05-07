<script lang="ts">
  import { transferQueueStore } from '$transfer/reliable'
  import { formatBytes } from '$utils/format'
  import type { QueueEntry, QueueEntryStatus } from '$transfer/types'

  /** Optional callbacks — when provided, the corresponding row controls are shown. */
  export let onResume: ((entry: QueueEntry) => void) | null = null
  export let onCancel: ((entry: QueueEntry) => void) | null = null
  export let onRetry: ((entry: QueueEntry) => void) | null = null

  $: entries = $transferQueueStore.entries

  function tone(status: QueueEntryStatus): string {
    if (status === 'completed') return 'good'
    if (status === 'failed' || status === 'cancelled') return 'bad'
    if (status === 'paused') return 'warn'
    if (status === 'active') return 'info'
    return 'idle'
  }

  function clearCompleted() {
    transferQueueStore.clearCompleted()
  }

  function remove(entry: QueueEntry) {
    transferQueueStore.remove(entry.id)
  }

  function summarize(entry: QueueEntry): string {
    if (entry.fileNames.length === 0) return 'Pending manifest'
    const head = entry.fileNames[0]
    const more = entry.fileNames.length - 1
    return more > 0 ? `${head} + ${more} more` : head
  }
</script>

<section class="tq-root">
  <header class="tq-head">
    <div>
      <p class="tq-title">Transfer queue</p>
      <p class="tq-sub">Recent and pending transfers on this device</p>
    </div>
    <button class="tq-clear" on:click={clearCompleted} disabled={entries.every(e => !['completed','failed','cancelled'].includes(e.status))}>
      Clear completed
    </button>
  </header>

  {#if entries.length === 0}
    <div class="tq-empty">No transfers yet — start one to see it here.</div>
  {:else}
    <ul class="tq-list">
      {#each entries as entry (entry.id)}
        <li class="tq-row tq-row--{tone(entry.status)}">
          <div class="tq-row-head">
            <span class="tq-arrow">
              {entry.direction === 'send' ? '↑' : '↓'}
            </span>
            <span class="tq-row-title">{summarize(entry)}</span>
            <span class="tq-status">{entry.status}</span>
          </div>
          <div class="tq-row-meta">
            <span>{formatBytes(entry.totalSize)}</span>
            <span>·</span>
            <span>{entry.totalChunks} chunks</span>
            <span>·</span>
            <span>{entry.route}</span>
          </div>
          {#if entry.error}
            <div class="tq-error">{entry.error}</div>
          {/if}
          <div class="tq-actions">
            {#if entry.status === 'paused' && onResume}
              <button class="tq-action" on:click={() => onResume?.(entry)}>Resume</button>
            {/if}
            {#if entry.status === 'active' && onCancel}
              <button class="tq-action tq-action--danger" on:click={() => onCancel?.(entry)}>Cancel</button>
            {/if}
            {#if (entry.status === 'failed' || entry.status === 'cancelled') && onRetry}
              <button class="tq-action" on:click={() => onRetry?.(entry)}>Retry</button>
            {/if}
            {#if ['completed','failed','cancelled'].includes(entry.status)}
              <button class="tq-action tq-action--ghost" on:click={() => remove(entry)}>Remove</button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .tq-root {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    width: 100%;
    min-width: 0;
  }

  .tq-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .tq-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
  }

  .tq-sub {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 2px;
  }

  .tq-clear {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-2);
    font-size: 11px;
    font-family: var(--font-display);
    font-weight: 600;
    border-radius: 8px;
    padding: 5px 10px;
    cursor: pointer;
  }

  .tq-clear:disabled { opacity: 0.5; cursor: not-allowed; }

  .tq-empty {
    font-size: 12px;
    color: var(--text-3);
    padding: 18px 0;
    text-align: center;
    border: 1px dashed var(--border);
    border-radius: 10px;
  }

  .tq-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tq-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .tq-row--good { border-color: rgba(34,197,94,0.4); }
  .tq-row--bad  { border-color: rgba(239,68,68,0.4); }
  .tq-row--warn { border-color: rgba(245,158,11,0.4); }
  .tq-row--info { border-color: rgba(124,58,237,0.4); }

  .tq-row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .tq-arrow {
    font-size: 14px;
    color: var(--text-2);
    flex-shrink: 0;
  }

  .tq-row-title {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .tq-status {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .tq-row-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .tq-error {
    font-size: 11px;
    color: #ef4444;
  }

  .tq-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tq-action {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-2);
    font-size: 11px;
    font-family: var(--font-display);
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 8px;
    cursor: pointer;
  }

  .tq-action:hover {
    background: var(--surface-2);
    color: var(--text-1);
  }

  .tq-action--danger { color: #ef4444; border-color: rgba(239,68,68,0.4); }
  .tq-action--ghost  { color: var(--text-3); }

  @media (max-width: 480px) {
    .tq-row-title { font-size: 12px; }
  }
</style>
