<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import { formatBytes, formatDuration } from '$utils/format'

  $: receipt = $transferStore.receipt
</script>

{#if receipt}
  <div class="tr-card">
    <header class="tr-head">
      <div class="tr-badge" class:tr-badge--ok={receipt.verified} class:tr-badge--warn={!receipt.verified}>
        {receipt.verified ? '✓ Verified receipt' : '⚠ Unverified receipt'}
      </div>
      <span class="tr-id" title={receipt.transferId}>{receipt.transferId.slice(0, 8)}…</span>
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
        <dd>{receipt.totalChunks} × {formatBytes(receipt.chunkSize)}</dd>
      </div>
      <div class="tr-cell">
        <dt>Route</dt>
        <dd>{receipt.route}</dd>
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
        <dd>{receipt.healthScore}/100</dd>
      </div>
      {#if receipt.rootHash}
        <div class="tr-cell tr-cell--full">
          <dt>Proof root</dt>
          <dd class="tr-hash" title={receipt.rootHash}>{receipt.rootHash.slice(0, 16)}…{receipt.rootHash.slice(-8)}</dd>
        </div>
      {/if}
    </dl>
  </div>
{/if}

<style>
  .tr-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 14px 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface-2);
  }

  .tr-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
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
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }

  .tr-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px 12px;
    margin: 0;
  }

  .tr-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 4px 0;
    border-top: 1px dashed rgba(255, 255, 255, 0.06);
  }

  .tr-cell--full {
    grid-column: 1 / -1;
  }

  .tr-cell dt {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
  }

  .tr-cell dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-1);
  }

  .tr-hash {
    word-break: break-all;
  }
</style>
