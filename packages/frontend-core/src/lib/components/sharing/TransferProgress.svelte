<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import { formatBytes, formatETA, formatSpeed, truncateName } from '$utils'

  $: progress = $transferStore.progress
  $: speed = $transferStore.speedBps
  $: bytesTotal = $transferStore.bytesTotal
  $: bytesSent = $transferStore.bytesSent
  $: currentFile = $transferStore.currentFile

  $: eta = formatETA(bytesTotal - bytesSent, speed)
  $: currentFileFacts = currentFile
    ? [currentFile.type.split('/')[0]?.toUpperCase() || 'FILE', formatBytes(currentFile.size)]
    : []
</script>

<div class="tp-root">
  <div class="tp-bar">
    <div class="tp-fill" style="width: {progress}%;" />
    <div class="tp-beam" />

    <div class="tp-labels">
      <span class="tp-label tp-label--primary">{progress}%</span>
      <span class="tp-label">{formatBytes(bytesSent)} / {formatBytes(bytesTotal)}</span>
    </div>
  </div>

  <div class="tp-stats">
    <span class="tp-stat">{formatSpeed(speed)}</span>
    <span class="tp-stat tp-stat--eta">
      <span class="tp-dot" />
      ETA {eta}
    </span>
  </div>

  {#if currentFile}
    <div class="tp-current">
      <div class="tp-current__header">
        <span class="tp-current__eyebrow">Current file</span>
        <strong>{truncateName(currentFile.name, 34)}</strong>
      </div>

      <div class="tp-current__facts">
        {#each currentFileFacts as fact}
          <span class="tp-chip">{fact}</span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .tp-root {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
    min-width: 0;
  }

  .tp-bar {
    position: relative;
    height: 56px;
    overflow: hidden;
    border-radius: 18px;
    background: color-mix(in srgb, var(--surface-2) 82%, var(--violet) 18%);
    border: 2px solid color-mix(in srgb, var(--accent) 28%, var(--border-hard));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--surface) 68%, transparent),
      2px 2px 0 color-mix(in srgb, var(--border-hard) 12%, transparent);
  }

  .tp-fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 16px;
    transition: width 260ms ease;
    background:
      linear-gradient(90deg,
        color-mix(in srgb, var(--violet) 74%, white 6%),
        color-mix(in srgb, var(--cyan) 78%, white 8%)
      );
    box-shadow:
      inset 0 0 24px rgba(255,255,255,0.15),
      0 0 0 1px rgba(255,255,255,0.12);
  }

  .tp-beam {
    position: absolute;
    inset: 0 auto 0 0;
    width: 42%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    animation: tp-beam 2.4s linear infinite;
    pointer-events: none;
  }

  .tp-labels {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 16px;
  }

  .tp-label {
    position: relative;
    z-index: 1;
    font-family: var(--font-mono);
    font-size: 12px;
    color: color-mix(in srgb, var(--text-1) 60%, var(--text-2));
  }

  .tp-label--primary {
    color: var(--text-1);
    font-weight: 700;
  }

  .tp-stats {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .tp-stat {
    font-size: 12px;
    color: var(--text-2);
  }

  .tp-stat--eta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
  }

  .tp-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--green);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 16%, transparent);
    animation: tp-pulse 2s ease-in-out infinite;
  }

  .tp-current {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface) 74%, var(--accent) 12%);
    border: 1px solid color-mix(in srgb, var(--border-hard) 15%, transparent);
  }

  .tp-current__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .tp-current__eyebrow {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .tp-current__header strong {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }

  .tp-current__facts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tp-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 66%, var(--accent) 20%);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  @keyframes tp-beam {
    from { transform: translateX(-120%); }
    to { transform: translateX(280%); }
  }

  @keyframes tp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.72; }
  }

  @media (max-width: 520px) {
    .tp-bar {
      height: 52px;
    }

    .tp-labels {
      padding: 0 12px;
    }

    .tp-label {
      font-size: 11px;
    }
  }
</style>
