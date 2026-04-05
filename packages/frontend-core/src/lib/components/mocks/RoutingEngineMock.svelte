<script lang="ts">
  import { onMount } from 'svelte'

  import WindowChrome from './WindowChrome.svelte'

  const routes = [
    { label: 'Direct P2P', badge: 'Fastest', color: 'var(--green)', bg: 'rgba(0,229,112,0.12)', icon: '⟷' },
    { label: 'Network LAN', badge: 'Local', color: 'var(--cyan)', bg: 'rgba(34,211,238,0.12)', icon: '⊡' },
    { label: 'Google Drive', badge: 'Fallback', color: 'var(--violet)', bg: 'rgba(155,127,255,0.12)', icon: '↑' },
  ]

  let activeIndex = 0

  onMount(() => {
    const timer = setInterval(() => {
      activeIndex = (activeIndex + 1) % routes.length
    }, 2200)

    return () => clearInterval(timer)
  })
</script>

<WindowChrome title="Routing Engine" compact={true}>
  <div class="rem-diagram">
    <div class="rem-device">
      <div class="rem-device-icon">💻</div>
      <div class="rem-device-label font-mono">SENDER</div>
    </div>

    <div class="rem-lines">
      {#each routes as route, index}
        <button type="button" class="rem-line" class:rem-line--active={index === activeIndex} on:click={() => (activeIndex = index)}>
          <div class="rem-line-track">
            <div class="rem-line-bar" style={`background:${route.color}`} />
            <div class="rem-line-dot" style={`background:${route.color};border-color:${route.color}`} />
          </div>
          <div class="rem-line-label">
            <span class="rem-line-badge" style={`color:${route.color};border-color:${route.color};background:${route.bg}`}>{route.badge}</span>
            <span class="rem-line-name font-mono">{route.label}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="rem-device">
      <div class="rem-device-icon">📱</div>
      <div class="rem-device-label font-mono">RECEIVER</div>
    </div>
  </div>
</WindowChrome>

<style>
  .rem-diagram {
    display: grid;
    grid-template-columns: 92px 1fr 92px;
    gap: 24px;
    align-items: center;
  }

  .rem-device {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .rem-device-icon {
    width: 72px;
    height: 72px;
    border-radius: 18px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: var(--shadow-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
  }

  .rem-device-label {
    font-size: 11px;
    letter-spacing: 0.12em;
    color: var(--text-3);
  }

  .rem-lines {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .rem-line {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
  }

  .rem-line--active {
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    border-color: var(--border-hard);
    transform: translateX(-3px);
  }

  .rem-line-track {
    position: relative;
    flex: 1;
    height: 8px;
    border-radius: 999px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .rem-line-bar {
    position: absolute;
    inset: 0;
    opacity: 0.9;
  }

  .rem-line-dot {
    position: absolute;
    top: 50%;
    right: 0;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid;
    transform: translate(50%, -50%);
    box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 16%, transparent);
  }

  .rem-line-label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 188px;
  }

  .rem-line-badge {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid;
    font-size: 10px;
    font-weight: 700;
  }

  .rem-line-name {
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--text-2);
  }

  @media (max-width: 720px) {
    .rem-diagram {
      grid-template-columns: 1fr;
    }

    .rem-device {
      flex-direction: row;
      justify-content: center;
    }
  }
</style>
