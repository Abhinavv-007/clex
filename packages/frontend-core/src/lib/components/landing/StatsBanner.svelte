<script lang="ts">
  import { onMount } from 'svelte'

  const stats = [
    { value: '100%', label: 'Client-side processing', color: 'green' },
    { value: '0',    label: 'Server file uploads (P2P)', color: 'accent' },
    { value: '3',    label: 'Transfer routing modes', color: 'cyan' },
    { value: '12+',  label: 'File formats supported', color: 'violet' },
    { value: '∞',    label: 'File size (P2P)', color: 'amber' },
    { value: '6',    label: 'Character room codes', color: 'green' },
  ]

  const colorMap: Record<string, string> = {
    green:  'var(--green)',
    accent: 'var(--accent)',
    cyan:   'var(--cyan)',
    violet: 'var(--violet)',
    amber:  'var(--amber)',
  }

  let sectionEl: HTMLElement
  let visible = false

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.1 }
    )
    if (sectionEl) obs.observe(sectionEl)
    return () => obs.disconnect()
  })
</script>

<div class="stats-banner" bind:this={sectionEl}>
  <div class="stats-grid">
    {#each stats as stat, i}
      <div
        class="stat-item"
        class:is-visible={visible}
        style="transition-delay: {i * 60}ms; --stat-color: {colorMap[stat.color]}"
      >
        <span class="stat-value">{stat.value}</span>
        <span class="stat-label">{stat.label}</span>
        <div class="stat-bar" />
      </div>
    {/each}
  </div>
</div>

<style>
  .stats-banner {
    border-top: 2px solid var(--border-hard);
    border-bottom: 2px solid var(--border-hard);
    background: var(--surface);
    overflow: hidden;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    max-width: 1280px;
    margin: 0 auto;
  }

  @media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 640px)  { .stats-grid { grid-template-columns: repeat(2, 1fr); } }

  .stat-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 32px 20px;
    border-right: 2px solid var(--border);
    text-align: center;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 500ms var(--ease-out), transform 500ms var(--ease-out);
    overflow: hidden;
  }

  .stat-item:last-child { border-right: none; }

  @media (max-width: 1100px) {
    .stat-item:nth-child(3) { border-right: none; }
    .stat-item:nth-child(4) { border-top: 2px solid var(--border); }
    .stat-item:nth-child(5) { border-top: 2px solid var(--border); }
    .stat-item:nth-child(6) { border-top: 2px solid var(--border); border-right: none; }
  }

  .stat-item.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .stat-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--stat-color);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 600ms var(--ease-out);
  }

  .stat-item.is-visible .stat-bar {
    transform: scaleX(1);
    transition-delay: 200ms;
  }

  .stat-value {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 3vw, 2.8rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--stat-color);
    line-height: 1;
  }

  .stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    max-width: 14ch;
    text-align: center;
  }
</style>
