<script lang="ts">
  import { onMount } from 'svelte'
  let mounted = false

  onMount(() => {
    mounted = true
  })
</script>

<div class="bg-root" class:mounted aria-hidden="true">
  <!-- Subtle dot grid -->
  <div class="bg-grid" />
  <!-- Corner accent glow -->
  <div class="bg-glow bg-glow-tl" />
  <div class="bg-glow bg-glow-br" />
  <!-- Noise texture -->
  <div class="bg-noise" />
</div>

<style>
  .bg-root {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: var(--canvas);
    transition: background 300ms ease;
  }

  /* Dot grid — the neo-brutalist signature background */
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle, var(--border-strong) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.35;
  }

  :global(.dark) .bg-grid {
    opacity: 0.18;
  }

  /* Accent glow blobs */
  .bg-glow {
    position: absolute;
    width: 640px;
    height: 640px;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(120px);
    opacity: 0;
    transition: opacity 800ms ease;
  }

  .mounted .bg-glow {
    opacity: 1;
  }

  .bg-glow-tl {
    top: -200px;
    left: -200px;
    background: radial-gradient(circle, rgba(255,230,0,0.06) 0%, transparent 70%);
  }

  .bg-glow-br {
    bottom: -200px;
    right: -200px;
    background: radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%);
  }

  :global(.dark) .bg-glow-tl {
    background: radial-gradient(circle, rgba(255,230,0,0.05) 0%, transparent 70%);
  }

  :global(.dark) .bg-glow-br {
    background: radial-gradient(circle, rgba(107,79,224,0.06) 0%, transparent 70%);
  }

  /* Noise overlay */
  .bg-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.06;
    mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 220px 220px;
  }

  :global(.dark) .bg-noise {
    mix-blend-mode: screen;
    opacity: 0.04;
  }
</style>
