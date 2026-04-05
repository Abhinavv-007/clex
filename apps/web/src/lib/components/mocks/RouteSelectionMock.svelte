<script lang="ts">
  import { onMount } from 'svelte'

  interface MockRoute {
    label: string
    status: string
    color: string
    active?: boolean
  }

  export let roomCode = 'A7·M2·QX'
  export let routes: MockRoute[] = [
    { label: 'Direct P2P (WebRTC)', status: 'Connected', color: 'var(--green)', active: true },
    { label: 'Local Network', status: 'Available', color: 'var(--cyan)' },
    { label: 'Google Drive', status: 'Standby', color: 'var(--amber)' },
  ]

  let activeIndex = Math.max(routes.findIndex(route => route.active), 0)
  let paused = false

  onMount(() => {
    const timer = setInterval(() => {
      if (paused) return
      activeIndex = (activeIndex + 1) % routes.length
    }, 2200)

    return () => clearInterval(timer)
  })
</script>

<div
  class="rsm-root"
  role="group"
  aria-label="Route selection mock app"
  on:mouseenter={() => (paused = true)}
  on:mouseleave={() => (paused = false)}
>
  <div class="rsm-code">
    <span class="rsm-code-label font-mono">Room code</span>
    <div class="rsm-code-display font-mono">{roomCode}</div>
  </div>

  <div class="rsm-routes">
    {#each routes as route, index}
      <button
        type="button"
        class="rsm-path"
        class:rsm-path--active={index === activeIndex}
        on:click={() => (activeIndex = index)}
      >
        <span class="rsm-dot" style={`background:${route.color}`} />
        <span class="rsm-name">{route.label}</span>
        <span class="rsm-tag font-mono">{index === activeIndex ? '● ' : ''}{route.status}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .rsm-root {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .rsm-code {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rsm-code-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .rsm-code-display {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--text-1);
    padding: 12px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: var(--shadow-sm);
    text-align: center;
  }

  .rsm-routes {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .rsm-path {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
    text-align: left;
  }

  .rsm-path--active {
    background: var(--surface);
    color: var(--text-1);
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .rsm-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .rsm-name {
    flex: 1;
  }

  .rsm-tag {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
  }

  .rsm-path--active .rsm-tag {
    color: var(--green);
  }
</style>
