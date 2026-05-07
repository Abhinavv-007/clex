<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import { formatBytes, formatDuration } from '$utils/format'

  $: receipt = $transferStore.receipt

  let copiedField: 'id' | 'hash' | null = null
  let copyTimer: ReturnType<typeof setTimeout> | null = null

  async function copyValue(value: string, field: 'id' | 'hash') {
    try {
      await navigator.clipboard.writeText(value)
      copiedField = field
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copiedField = null }, 1400)
    } catch {
      // clipboard may be denied — silently no-op rather than alarming the user
    }
  }

  function midTruncate(value: string, head = 12, tail = 8): string {
    if (value.length <= head + tail + 1) return value
    return `${value.slice(0, head)}…${value.slice(-tail)}`
  }
</script>

{#if receipt}
  <div class="tr-card">
    <header class="tr-head">
      <div class="tr-badge" class:tr-badge--ok={receipt.verified} class:tr-badge--warn={!receipt.verified}>
        <span class="tr-badge__dot" />
        {receipt.verified ? 'Verified receipt' : 'Unverified receipt'}
      </div>
      <button
        type="button"
        class="tr-id"
        title="Copy transfer ID"
        on:click={() => copyValue(receipt.transferId, 'id')}
      >
        <span class="tr-id__label">ID</span>
        <span class="tr-id__value">{midTruncate(receipt.transferId, 6, 4)}</span>
        <span class="tr-id__copy">{copiedField === 'id' ? '✓' : '⧉'}</span>
      </button>
    </header>

    <dl class="tr-grid">
      <div class="tr-cell">
        <dt>Files</dt>
        <dd>{receipt.fileCount}</dd>
      </div>
      <div class="tr-cell">
        <dt>Size</dt>
        <dd>{formatBytes(receipt.totalSize)}</dd>
      </div>
      <div class="tr-cell">
        <dt>Chunks</dt>
        <dd>{receipt.totalChunks} <span class="tr-mute">×</span> {formatBytes(receipt.chunkSize)}</dd>
      </div>
      <div class="tr-cell">
        <dt>Route</dt>
        <dd class="tr-cap">{receipt.route}</dd>
      </div>
      <div class="tr-cell">
        <dt>Duration</dt>
        <dd>{formatDuration(receipt.durationMs)}</dd>
      </div>
      <div class="tr-cell">
        <dt>Retries</dt>
        <dd>{receipt.retryCount}</dd>
      </div>
      <div class="tr-cell">
        <dt>Failed</dt>
        <dd>{receipt.failedChunkCount}</dd>
      </div>
      <div class="tr-cell">
        <dt>Health</dt>
        <dd>{receipt.healthScore}<span class="tr-mute">/100</span></dd>
      </div>
    </dl>

    {#if receipt.rootHash}
      {@const rootHashValue = receipt.rootHash}
      <div class="tr-hash-block">
        <span class="tr-hash-key">Proof root</span>
        <button
          type="button"
          class="tr-hash"
          title={rootHashValue}
          on:click={() => copyValue(rootHashValue, 'hash')}
        >
          <span class="tr-hash__value">{midTruncate(rootHashValue, 14, 10)}</span>
          <span class="tr-hash__copy">{copiedField === 'hash' ? 'Copied ✓' : 'Copy ⧉'}</span>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tr-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-2);
    min-width: 0;
    overflow: hidden;
  }

  .tr-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .tr-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .tr-badge__dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: currentColor;
  }

  .tr-badge--ok {
    background: rgba(34, 197, 94, 0.12);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .tr-badge--warn {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .tr-id {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    color: var(--text-2);
    font-size: 11px;
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
    min-width: 0;
  }

  .tr-id:hover { background: rgba(255,255,255,0.06); border-color: var(--border-hard); color: var(--text-1); }

  .tr-id__label {
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
  }

  .tr-id__value {
    font-family: var(--font-mono);
    color: var(--text-1);
  }

  .tr-id__copy {
    font-size: 10px;
    opacity: 0.7;
  }

  .tr-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 14px;
    margin: 0;
    min-width: 0;
  }

  .tr-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
    border-top: 1px dashed rgba(255, 255, 255, 0.06);
    min-width: 0;
  }

  .tr-cell dt {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .tr-cell dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    min-width: 0;
  }

  .tr-cap { text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px !important; }

  .tr-mute { color: var(--text-3); margin: 0 2px; }

  .tr-hash-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
    min-width: 0;
  }

  .tr-hash-key {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
  }

  .tr-hash {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-1);
    min-width: 0;
  }

  .tr-hash__value {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tr-hash__copy {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #22c55e;
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.08);
    transition: background 150ms ease;
  }

  .tr-hash:hover .tr-hash__copy {
    background: rgba(34, 197, 94, 0.18);
  }

  @media (max-width: 480px) {
    .tr-grid { grid-template-columns: 1fr; }
  }
</style>
