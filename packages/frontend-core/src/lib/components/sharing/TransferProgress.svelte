<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import { formatBytes, formatETA, formatSpeed, truncateName } from '$utils'

  $: progress = $transferStore.progress
  $: speed = $transferStore.speedBps
  $: bytesTotal = $transferStore.bytesTotal
  $: bytesSent = $transferStore.bytesSent
  $: currentFile = $transferStore.currentFile
  $: protocol = $transferStore.protocol
  $: paused = $transferStore.paused
  $: totalChunks = $transferStore.totalChunks
  $: verifiedChunks = $transferStore.verifiedChunks
  $: ackedChunks = $transferStore.ackedChunks
  $: retries = $transferStore.retries
  $: connectionKind = $transferStore.connectionKind

  $: verifiedPct = totalChunks > 0 ? Math.min(100, Math.round((verifiedChunks / totalChunks) * 100)) : 0
  $: eta = formatETA(bytesTotal - bytesSent, speed)
  $: networkLabel =
    connectionKind === 'lan' ? 'LAN'
    : connectionKind === 'internet' ? 'WAN'
    : 'P2P'
  $: networkClass =
    connectionKind === 'lan' ? 'tp-net--lan'
    : connectionKind === 'internet' ? 'tp-net--wan'
    : 'tp-net--unknown'
  $: currentFileFacts = currentFile
    ? [currentFile.type.split('/')[0]?.toUpperCase() || 'FILE', formatBytes(currentFile.size)]
    : []
</script>

<div class="tp-root" class:tp-paused={paused}>
  <div class="tp-bar">
    <div class="tp-fill" style="width: {progress}%;" />
    {#if protocol === 'reliable' && totalChunks > 0}
      <div class="tp-verified" style="width: {verifiedPct}%;" />
    {/if}
    <div class="tp-beam" />

    <div class="tp-labels">
      <span class="tp-label tp-label--primary">{progress}%</span>
      <span class="tp-label tp-label--bytes">{formatBytes(bytesSent)} <span class="tp-slash">/</span> {formatBytes(bytesTotal)}</span>
    </div>
  </div>

  <div class="tp-stats">
    <span class="tp-stat tp-stat--speed" title="Current speed">
      <span class="tp-stat__icon" aria-hidden="true">⇣</span>
      <span class="tp-stat__val">{formatSpeed(speed)}</span>
    </span>
    {#if protocol === 'reliable' && totalChunks > 0}
      <span class="tp-stat" title="Verified chunks">
        <span class="tp-stat__icon" aria-hidden="true">✓</span>
        <span class="tp-stat__val">{verifiedChunks}/{totalChunks}</span>
      </span>
      {#if retries > 0}
        <span class="tp-stat tp-stat--retry" title="Retried chunks">
          <span class="tp-stat__icon" aria-hidden="true">↻</span>
          <span class="tp-stat__val">{retries}</span>
        </span>
      {/if}
    {/if}
    {#if paused}
      <span class="tp-stat tp-stat--paused">
        <span class="tp-stat__icon" aria-hidden="true">❚❚</span>
        <span class="tp-stat__val">Paused</span>
      </span>
    {/if}
    <span class="tp-stat tp-net {networkClass}" title="Connection type">
      <span class="tp-net__dot" aria-hidden="true" />
      <span class="tp-stat__val">{networkLabel}</span>
    </span>
    <span class="tp-stat tp-stat--eta">
      <span class="tp-dot" />
      <span class="tp-stat__val">ETA {eta}</span>
    </span>
  </div>

  {#if protocol === 'reliable' && totalChunks > 0 && totalChunks <= 240}
    <div class="tp-chunkrail" aria-hidden="true">
      {#each Array(totalChunks) as _, idx}
        <span
          class="tp-chunk"
          class:tp-chunk--verified={idx < verifiedChunks}
          class:tp-chunk--acked={idx >= verifiedChunks && idx < ackedChunks}
        ></span>
      {/each}
    </div>
  {:else if protocol === 'reliable' && totalChunks > 240}
    <div class="tp-chunkrail tp-chunkrail--compact" aria-hidden="true">
      <div class="tp-chunkrail__bar">
        <div class="tp-chunkrail__verified" style="width: {verifiedPct}%;"></div>
      </div>
      <span class="tp-chunkrail__count">{totalChunks} chunks</span>
    </div>
  {/if}

  {#if currentFile}
    <div class="tp-current">
      <div class="tp-current__header">
        <span class="tp-current__eyebrow">Current file</span>
        <strong title={currentFile.name}>{truncateName(currentFile.name, 34)}</strong>
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
    gap: 12px;
    width: 100%;
    min-width: 0;
    /* Prevent any inner long string (filenames, hashes) from overflowing the
     * card container — the chip group + label rows still wrap, but values
     * never push the card off-screen. */
    overflow: hidden;
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

  .tp-verified {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 16px;
    transition: width 260ms ease;
    background:
      repeating-linear-gradient(
        45deg,
        rgba(34, 197, 94, 0.20) 0 6px,
        rgba(34, 197, 94, 0.05) 6px 12px
      );
    pointer-events: none;
    mix-blend-mode: screen;
  }

  .tp-paused .tp-fill,
  .tp-paused .tp-beam {
    filter: grayscale(0.4) opacity(0.85);
  }

  .tp-paused .tp-beam { animation-play-state: paused; }

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
    gap: 12px;
    padding: 0 14px;
    min-width: 0;
  }

  .tp-label {
    position: relative;
    z-index: 1;
    font-family: var(--font-mono);
    font-size: 12px;
    color: color-mix(in srgb, var(--text-1) 60%, var(--text-2));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .tp-label--bytes { flex: 0 1 auto; }

  .tp-slash { opacity: 0.4; margin: 0 2px; }

  .tp-label--primary {
    color: var(--text-1);
    font-weight: 700;
    flex: 0 0 auto;
  }

  .tp-stats {
    display: flex;
    align-items: center;
    gap: 8px 12px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .tp-stat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-2);
    min-width: 0;
  }

  .tp-stat__icon {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }

  .tp-stat__val {
    font-family: var(--font-mono);
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }

  .tp-stat--retry .tp-stat__icon,
  .tp-stat--retry .tp-stat__val { color: #f59e0b; }

  .tp-stat--paused .tp-stat__icon,
  .tp-stat--paused .tp-stat__val { color: #f59e0b; font-weight: 600; }

  .tp-stat--eta { margin-left: auto; }

  /* Network chip — LAN / WAN / P2P origin indicator */
  .tp-net {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--text-3) 28%, transparent);
    background: color-mix(in srgb, var(--surface) 60%, transparent);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    gap: 6px;
    flex-shrink: 0;
  }

  .tp-net__dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--text-3);
    flex-shrink: 0;
  }

  .tp-net--lan {
    border-color: color-mix(in srgb, var(--green) 40%, transparent);
    color: var(--green);
  }
  .tp-net--lan .tp-net__dot { background: var(--green); box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 18%, transparent); }

  .tp-net--wan {
    border-color: color-mix(in srgb, var(--cyan) 40%, transparent);
    color: var(--cyan);
  }
  .tp-net--wan .tp-net__dot { background: var(--cyan); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cyan) 18%, transparent); }

  .tp-net--unknown {
    border-color: color-mix(in srgb, var(--text-3) 30%, transparent);
    color: var(--text-2);
  }

  .tp-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--green);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 16%, transparent);
    animation: tp-pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* Chunk rail */
  .tp-chunkrail {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface) 60%, var(--surface-2) 40%);
    border: 1px solid var(--border);
    max-height: 64px;
    overflow: hidden;
  }

  .tp-chunk {
    width: 6px;
    height: 6px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text-3) 25%, transparent);
    transition: background 200ms ease;
    flex-shrink: 0;
  }

  .tp-chunk--acked {
    background: color-mix(in srgb, var(--cyan) 60%, transparent);
  }

  .tp-chunk--verified {
    background: #22c55e;
    box-shadow: 0 0 6px color-mix(in srgb, #22c55e 50%, transparent);
  }

  .tp-chunkrail--compact {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
  }

  .tp-chunkrail__bar {
    flex: 1 1 auto;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--text-3) 16%, transparent);
    overflow: hidden;
    min-width: 0;
  }

  .tp-chunkrail__verified {
    height: 100%;
    background: linear-gradient(90deg, #22c55e, color-mix(in srgb, var(--cyan) 70%, white 10%));
    transition: width 260ms ease;
  }

  .tp-chunkrail__count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .tp-current {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface) 74%, var(--accent) 12%);
    border: 1px solid color-mix(in srgb, var(--border-hard) 15%, transparent);
    min-width: 0;
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
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    .tp-bar { height: 52px; }
    .tp-labels { padding: 0 12px; }
    .tp-label { font-size: 11px; }
    .tp-label--bytes { display: none; }
    .tp-stat__val { max-width: 140px; }
    .tp-stat--eta { margin-left: 0; width: 100%; }
  }
</style>
