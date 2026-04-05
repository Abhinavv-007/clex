<script lang="ts">
  import { onMount } from 'svelte'

  let mounted = false

  onMount(() => {
    mounted = true

    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMove, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMove)
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

  /* ── Hero radial glow — very subtle emerald tinted ── */
  .hero-glow {
    position: absolute;
    top: -30%;
    left: 50%;
    transform: translateX(-50%);
    width: 1200px;
    height: 800px;
    border-radius: 50%;
    opacity: 0;
    filter: blur(120px);
    transition: opacity 0.6s ease;
    pointer-events: none;
  }

  :global(.dark) .hero-glow {
    opacity: 1;
    background: radial-gradient(
      ellipse 70% 60% at 50% 40%,
      rgba(16,185,129,0.04) 0%,
      rgba(59,130,246,0.02) 30%,
      transparent 70%
    );
  }

  /* ── Grid overlay — subtle dot matrix ── */
  .grid-overlay {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 20%, transparent 70%);
    -webkit-mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 20%, transparent 70%);
    transition: opacity 0.4s ease;
  }

  :global(.dark) .grid-overlay {
    opacity: 1;
  }

  /* ── Ambient floating glow orbs ── */
  .ambient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.6s ease;
  }

  :global(.dark) .ambient-orb { opacity: 1; }

  .orb-1 {
    width: 400px;
    height: 400px;
    top: 20%;
    left: -5%;
    background: rgba(16,185,129,0.015);
    animation: orbFloat1 25s ease-in-out infinite;
  }

  .orb-2 {
    width: 500px;
    height: 500px;
    top: 60%;
    right: -10%;
    background: rgba(59,130,246,0.01);
    animation: orbFloat2 30s ease-in-out infinite;
  }

  @keyframes orbFloat1 {
    0%, 100% { transform: translate(0, 0); }
    33% { transform: translate(30px, -20px); }
    66% { transform: translate(-15px, 25px); }
  }

  @keyframes orbFloat2 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-25px, -30px); }
  }

  /* ── Cursor reactive spot — dark only ── */
  .cursor-spot {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    opacity: 0;
    filter: blur(100px);
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition: opacity 0.5s ease;
    background: radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%);
    left: var(--cursor-x, 50vw);
    top: var(--cursor-y, 50vh);
  }

  :global(.dark) .cursor-spot { opacity: 1; }

  /* ── Noise grain ── */
  .noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px;
    mix-blend-mode: overlay;
  }

  :global(.dark) .noise { opacity: 0.03; }
</style>

<div class="bg-root" aria-hidden="true">
  <div class="hero-glow" />
  <div class="grid-overlay" />
  <div class="ambient-orb orb-1" />
  <div class="ambient-orb orb-2" />
  {#if mounted}
    <div class="cursor-spot" />
  {/if}
  <div class="noise" />
</div>
