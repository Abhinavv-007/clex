<script lang="ts">
  import { onMount } from 'svelte'
  let mounted = false

  onMount(() => {
    mounted = true
  })
</script>

<div class="bg-root" class:bg-mounted={mounted} aria-hidden="true">
  <div class="bg-noise" />
</div>

<style>
  .bg-root {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    background: #ffffff;
    transition: background 300ms ease;
  }

  :global(.dark) .bg-root {
    background: #000000;
  }

  .bg-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.12;
    mix-blend-mode: multiply;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 220px 220px;
  }

  :global(.dark) .bg-noise {
    mix-blend-mode: screen;
    opacity: 0.08;
  }
</style>

