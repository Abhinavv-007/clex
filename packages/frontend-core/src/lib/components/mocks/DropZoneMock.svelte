<script lang="ts">
  import { onMount } from 'svelte'

  interface MockFile {
    ext: string
    name: string
    accent: string
    color: string
  }

  export let files: MockFile[] = [
    { ext: 'PDF', name: 'brief.pdf · 2.1MB', accent: '#ffe600', color: '#000000' },
    { ext: 'JPG', name: 'hero.jpg · 4.8MB', accent: '#00d4ff', color: '#000000' },
    { ext: 'DOC', name: 'pricing.docx · 340KB', accent: '#6b4fe0', color: '#ffffff' },
  ]

  let activeIndex = 0
  let paused = false

  onMount(() => {
    const timer = setInterval(() => {
      if (paused) return
      activeIndex = (activeIndex + 1) % files.length
    }, 2200)

    return () => clearInterval(timer)
  })
</script>

<div
  class="dzm-root"
  role="group"
  aria-label="Drop zone mock app"
  on:mouseenter={() => (paused = true)}
  on:mouseleave={() => (paused = false)}
>
  <div class="dzm-zone">
    <div class="dzm-icon">↓</div>
    <div class="dzm-text font-mono">Drop files here</div>
  </div>

  <div class="dzm-files">
    {#each files as file, index}
      <button
        type="button"
        class="dzm-file"
        class:dzm-file--active={index === activeIndex}
        on:click={() => (activeIndex = index)}
      >
        <span
          class="dzm-ext"
          style={`background:${file.accent};border-color:${file.accent};color:${file.color};box-shadow:3px 3px 0 #000;`}
        >
          {file.ext}
        </span>
        <span class="dzm-name">{file.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .dzm-root {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .dzm-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 28px;
    border: 3px dashed var(--border-strong);
    background: var(--surface-2);
  }

  .dzm-icon {
    font-size: 2rem;
    animation: dzm-float 3s ease-in-out infinite;
  }

  .dzm-text {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
  }

  .dzm-files {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dzm-file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-size: 12px;
    color: var(--text-1);
    text-align: left;
    cursor: pointer;
    transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
  }

  .dzm-file--active {
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    transform: translate(-2px, -2px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .dzm-ext {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 8px;
    font-weight: 700;
    flex-shrink: 0;
    border: 2px solid;
  }

  .dzm-name {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
  }

  @keyframes dzm-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
</style>
