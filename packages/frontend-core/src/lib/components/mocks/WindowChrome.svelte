<script lang="ts">
  export let title = 'App Window'
  export let statusLabel: string | null = null
  export let statusColor = 'var(--accent)'
  export let className = ''
  export let compact = false
  export let padded = true
  export let bodyMinHeight = ''
</script>

<div class={`wm-shell ${compact ? 'wm-shell--compact' : ''} ${className}`.trim()}>
  <div class="wm-titlebar">
    <div class="wm-dots" aria-hidden="true">
      <span class="wm-dot wm-dot--red"></span>
      <span class="wm-dot wm-dot--yellow"></span>
      <span class="wm-dot wm-dot--green"></span>
    </div>

    <div class="wm-title">
      <span class="font-mono text-2xs tracking-widest uppercase text-text-3">{title}</span>
    </div>

    <div class="wm-status">
      {#if statusLabel}
        <span class="wm-status-dot" style={`background:${statusColor}`} />
        <span class="font-mono text-2xs text-text-2">{statusLabel}</span>
      {/if}
    </div>
  </div>

  <div
    class={`wm-body ${padded ? 'wm-body--padded' : ''}`.trim()}
    style={bodyMinHeight ? `min-height:${bodyMinHeight}` : undefined}
  >
    <slot />
  </div>
</div>

<style>
  .wm-shell {
    border: 2px solid var(--border-hard);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  .wm-shell--compact {
    border-radius: 16px;
    box-shadow: var(--shadow-lg);
  }

  .wm-titlebar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 2px solid var(--border);
    background: var(--surface-2);
  }

  .wm-shell--compact .wm-titlebar {
    padding: 10px 14px;
  }

  .wm-dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .wm-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.18);
  }

  :global(.dark) .wm-dot {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .wm-dot--red { background: #ff5f57; }
  .wm-dot--yellow { background: #ffbd2e; }
  .wm-dot--green { background: #28c840; }

  .wm-title {
    display: flex;
    justify-content: center;
    min-width: 0;
    text-align: center;
  }

  .wm-status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    min-height: 14px;
    min-width: 0;
  }

  .wm-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    animation: pulse-dot 2s ease-in-out infinite;
    flex-shrink: 0;
  }

  .wm-body {
    background: var(--surface);
  }

  .wm-body--padded {
    padding: 24px;
  }

  .wm-shell--compact .wm-body--padded {
    padding: 20px;
  }

  @media (max-width: 520px) {
    .wm-titlebar {
      grid-template-columns: auto 1fr;
      align-items: start;
      row-gap: 6px;
      padding: 12px 14px;
    }

    .wm-title {
      justify-content: flex-start;
      text-align: left;
    }

    .wm-status {
      grid-column: 1 / -1;
      justify-content: flex-start;
      min-height: 0;
    }

    .wm-title :global(span),
    .wm-status :global(span) {
      font-size: 0.625rem;
    }
  }
</style>
