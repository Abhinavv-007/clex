<script lang="ts">
  import { onMount } from 'svelte'

  let mounted = false

  onMount(() => {
    mounted = true

    const onMove = (event: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`)
      document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`)
    }

    window.addEventListener('mousemove', onMove, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMove)
    }
  })
</script>

<div class="bg-root" class:bg-mounted={mounted} aria-hidden="true">
  <div class="bg-gradient" />
  <div class="bg-aurora aurora-a" />
  <div class="bg-aurora aurora-b" />
  <div class="bg-aurora aurora-c" />
  <div class="bg-rings" />
  <div class="bg-grid" />
  <div class="bg-spotlight" />
  <div class="bg-scanline" />
  <div class="bg-noise" />
</div>

<style>
  .bg-root {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background:
      radial-gradient(circle at top center, rgba(53, 212, 255, 0.05), transparent 28%),
      linear-gradient(180deg, #edf3fb 0%, #e6ecf7 44%, #edf3fb 100%);
    transition: background 300ms ease;
  }

  :global(.dark) .bg-root {
    background:
      radial-gradient(circle at top center, rgba(53, 212, 255, 0.08), transparent 28%),
      linear-gradient(180deg, #05070d 0%, #070b13 44%, #05070d 100%);
  }

  .bg-gradient,
  .bg-grid,
  .bg-rings,
  .bg-spotlight,
  .bg-noise,
  .bg-scanline,
  .bg-aurora {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .bg-gradient {
    background:
      radial-gradient(circle at 15% 20%, rgba(53, 212, 255, 0.14), transparent 30%),
      radial-gradient(circle at 82% 12%, rgba(135, 140, 255, 0.12), transparent 24%),
      radial-gradient(circle at 50% 84%, rgba(74, 222, 179, 0.08), transparent 22%);
    opacity: 0.9;
  }

  :global(.dark) .bg-gradient {
    opacity: 1;
  }

  .bg-aurora {
    filter: blur(100px);
    opacity: 0.32;
    transform-origin: center;
  }

  .aurora-a {
    inset: auto auto 12% -12%;
    width: 34rem;
    height: 34rem;
    background: rgba(53, 212, 255, 0.22);
    animation: driftA 24s ease-in-out infinite;
  }

  .aurora-b {
    inset: -10% -6% auto auto;
    width: 30rem;
    height: 30rem;
    background: rgba(135, 140, 255, 0.16);
    animation: driftB 30s ease-in-out infinite;
  }

  .aurora-c {
    inset: auto 18% -18% auto;
    width: 24rem;
    height: 24rem;
    background: rgba(74, 222, 179, 0.14);
    animation: driftC 20s ease-in-out infinite;
  }

  .bg-rings {
    background:
      radial-gradient(circle at 50% 8%, rgba(255, 255, 255, 0.18) 0, rgba(255, 255, 255, 0.04) 10%, transparent 11%),
      radial-gradient(circle at 50% 8%, rgba(255, 255, 255, 0.08) 0, rgba(255, 255, 255, 0.02) 18%, transparent 19%);
    opacity: 0.18;
    transform: scale(1.5);
  }

  :global(.dark) .bg-rings {
    opacity: 0.28;
  }

  .bg-grid {
    background-image:
      linear-gradient(rgba(9, 17, 31, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(9, 17, 31, 0.05) 1px, transparent 1px);
    background-size: 72px 72px;
    mask-image: radial-gradient(circle at 50% 12%, black 18%, transparent 72%);
    -webkit-mask-image: radial-gradient(circle at 50% 12%, black 18%, transparent 72%);
    opacity: 0.28;
  }

  :global(.dark) .bg-grid {
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    opacity: 1;
  }

  .bg-spotlight {
    width: 34rem;
    height: 34rem;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(53, 212, 255, 0.14) 0%, rgba(53, 212, 255, 0.06) 24%, transparent 68%);
    transform: translate(calc(var(--cursor-x, 50vw) - 17rem), calc(var(--cursor-y, 30vh) - 17rem));
    opacity: 0;
    transition: opacity 400ms ease;
    filter: blur(20px);
  }

  .bg-mounted .bg-spotlight {
    opacity: 1;
  }

  .bg-scanline {
    background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    opacity: 0.18;
    transform: translateY(-110%);
    animation: scan 13s linear infinite;
  }

  :global(.dark) .bg-scanline {
    opacity: 0.12;
  }

  .bg-noise {
    opacity: 0.035;
    mix-blend-mode: soft-light;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 220px 220px;
  }

  @keyframes driftA {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(12%, -8%, 0) scale(1.12); }
  }

  @keyframes driftB {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(-16%, 10%, 0) scale(1.08); }
  }

  @keyframes driftC {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
    50% { transform: translate3d(8%, -14%, 0) scale(1.1); }
  }

  @keyframes scan {
    0% { transform: translateY(-115%); }
    100% { transform: translateY(115%); }
  }
</style>
