<script lang="ts">
  import { onMount } from 'svelte'

  let mounted = false
  let canvasEl: HTMLCanvasElement
  let animFrame: number

  // ── Star field (dark mode only) ───────────────────────────────────────
  onMount(() => {
    mounted = true

    // Cursor reactive glow
    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMove, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(animFrame)
    }
  })
</script>

<style>
  :global(:root) {
    --cursor-x: 50vw;
    --cursor-y: 50vh;
  }

  .bg-root {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: var(--canvas);
    transition: background 0.3s ease;
  }

  /* Subtle hero radial highlight */
  .hero-glow {
    position: absolute;
    top: -20%;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 600px;
    border-radius: 50%;
    opacity: 0;
    filter: blur(100px);
    transition: opacity 0.4s ease;
    pointer-events: none;
  }

  :global(.dark) .hero-glow {
    opacity: 1;
    background: radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%);
  }

  :global(.dark) .grid-overlay {
    opacity: 1;
  }

  .grid-overlay {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 80%);
    transition: opacity 0.3s ease;
  }

  /* Cursor reactive spot — dark only */
  .cursor-spot {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    opacity: 0;
    filter: blur(80px);
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition: opacity 0.4s ease;
    background: radial-gradient(circle, rgba(255,255,255,0.025) 0%, transparent 70%);
    left: var(--cursor-x, 50vw);
    top: var(--cursor-y, 50vh);
  }

  :global(.dark) .cursor-spot {
    opacity: 1;
  }

  /* Noise grain */
  .noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px;
    mix-blend-mode: overlay;
  }

  :global(.dark) .noise {
    opacity: 0.04;
  }
</style>

<div class="bg-root" aria-hidden="true">
  <div class="hero-glow" />
  <div class="grid-overlay" />
  {#if mounted}
    <div class="cursor-spot" />
  {/if}
  <div class="noise" />
</div>
