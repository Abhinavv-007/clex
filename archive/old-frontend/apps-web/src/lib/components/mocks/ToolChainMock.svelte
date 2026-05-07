<script lang="ts">
  import { onMount } from 'svelte'

  interface MockTool {
    icon: string
    label: string
    detail: string
  }

  export let tools: MockTool[] = [
    { icon: '🖼', label: 'Compress', detail: 'Shrink image payloads' },
    { icon: '📄', label: 'Merge PDF', detail: 'Combine selected pages' },
    { icon: '🔄', label: 'Convert', detail: 'Swap format without upload' },
    { icon: '📦', label: 'ZIP', detail: 'Bundle outputs for delivery' },
  ]

  let activeIndex = 0
  let paused = false

  onMount(() => {
    const timer = setInterval(() => {
      if (paused) return
      activeIndex = (activeIndex + 1) % tools.length
    }, 1800)

    return () => clearInterval(timer)
  })
</script>

<div
  class="tcm-root"
  role="group"
  aria-label="Tool chain mock app"
  on:mouseenter={() => (paused = true)}
  on:mouseleave={() => (paused = false)}
>
  <div class="tcm-strip">
    {#each tools as tool, index}
      <button
        type="button"
        class="tcm-item"
        class:tcm-item--active={index === activeIndex}
        on:click={() => (activeIndex = index)}
      >
        <span class="tcm-icon">{tool.icon}</span>
        <span>{tool.label}</span>
      </button>
    {/each}
  </div>

  <div class="tcm-detail">
    <span class="font-mono text-2xs uppercase tracking-widest text-text-3">Selected tool</span>
    <strong>{tools[activeIndex].label}</strong>
    <p>{tools[activeIndex].detail}</p>
  </div>
</div>

<style>
  .tcm-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tcm-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tcm-item {
    padding: 9px 13px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 180ms ease;
  }

  .tcm-item:hover,
  .tcm-item--active {
    border-color: var(--accent);
    background: var(--accent-dim);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .tcm-icon {
    font-size: 13px;
  }

  .tcm-detail {
    display: grid;
    gap: 4px;
    padding: 16px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .tcm-detail strong {
    font-family: var(--font-display);
    font-size: 18px;
    line-height: 1;
  }

  .tcm-detail p {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.6;
  }
</style>
