<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import { healthLabelText } from '$transfer/reliable'
  import { formatSpeed } from '$utils/format'

  $: health = $transferStore.health
  $: protocol = $transferStore.protocol
  $: paused = $transferStore.paused
  $: connectionKind = $transferStore.connectionKind
  $: route = $transferStore.method
  $: state = $transferStore.state

  $: routeLabel =
    route === 'drive'
      ? 'Drive fallback'
      : connectionKind === 'lan'
        ? 'Local network'
        : connectionKind === 'internet'
          ? 'Direct (internet)'
          : 'Direct'

  $: tone =
    health.label === 'verified'
      ? 'good'
      : health.label === 'stable'
        ? 'good'
        : health.label === 'recovering'
          ? 'warn'
          : health.label === 'unstable' || health.label === 'reconnecting' || health.label === 'failed'
            ? 'bad'
            : 'idle'

  $: showHealth = state === 'transferring' || state === 'complete' || state === 'failed' || protocol === 'reliable'
</script>

{#if showHealth}
  <div class="th-card th-card--{tone}">
    <div class="th-row">
      <div class="th-score-block">
        <span class="th-score">{health.score}</span>
        <span class="th-score-max">/100</span>
      </div>
      <div class="th-label-block">
        <span class="th-label">{healthLabelText(health.label)}</span>
        <span class="th-meta">{routeLabel}{#if paused} · paused{/if}{#if protocol === 'legacy'} · legacy peer{/if}</span>
      </div>
    </div>

    <div class="th-grid">
      <div class="th-cell">
        <span class="th-cell-key">Verified</span>
        <span class="th-cell-val">{health.verifiedChunks} / {health.totalChunks}</span>
      </div>
      <div class="th-cell">
        <span class="th-cell-key">Retries</span>
        <span class="th-cell-val">{health.retries}</span>
      </div>
      <div class="th-cell">
        <span class="th-cell-key">Failed</span>
        <span class="th-cell-val">{health.failedChunks}</span>
      </div>
      <div class="th-cell">
        <span class="th-cell-key">Avg speed</span>
        <span class="th-cell-val">{formatSpeed(health.averageSpeedBps)}</span>
      </div>
    </div>

    {#if health.bufferedHigh}
      <p class="th-note">Backpressure: data channel full — pacing sends.</p>
    {/if}
  </div>
{/if}

<style>
  .th-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 14px 12px;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }

  .th-card--good { border-color: rgba(34, 197, 94, 0.45); background: rgba(34, 197, 94, 0.06); }
  .th-card--warn { border-color: rgba(245, 158, 11, 0.45); background: rgba(245, 158, 11, 0.06); }
  .th-card--bad  { border-color: rgba(239, 68, 68, 0.45);  background: rgba(239, 68, 68, 0.05); }
  .th-card--idle { opacity: 0.85; }

  .th-row {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .th-score-block {
    display: flex;
    align-items: baseline;
    gap: 2px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 26px;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }

  .th-score-max {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 500;
  }

  .th-label-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .th-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .th-meta {
    font-size: 11px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .th-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px 12px;
  }

  .th-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 4px 0;
    border-top: 1px dashed rgba(255, 255, 255, 0.08);
  }

  .th-cell-key {
    font-size: 11px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .th-cell-val {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-1);
  }

  .th-note {
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
  }
</style>
