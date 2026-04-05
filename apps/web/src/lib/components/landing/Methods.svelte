<script lang="ts">
  import { onMount } from 'svelte'

  const methods = [
    {
      name: 'Direct',
      label: 'Primary route',
      detail: 'WebRTC browser-to-browser handoff',
      lines: ['No file relay', 'Best for remote transfers', 'Room-based connection'],
    },
    {
      name: 'Local',
      label: 'Same network',
      detail: 'Optimized lane for nearby devices',
      lines: ['Fastest path on shared Wi-Fi', 'Low-latency room join', 'Great for office or studio use'],
    },
    {
      name: 'Drive',
      label: 'Fallback',
      detail: 'Your own Google Drive as backup',
      lines: ['Shareable links', 'OAuth-secured handoff', 'Keeps the same workspace flow'],
    },
  ]

  let visible = false
  let sectionEl: HTMLElement | null = null

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true
          observer.disconnect()
        }
      },
      { threshold: 0.16 }
    )

    if (sectionEl) observer.observe(sectionEl)

    return () => observer.disconnect()
  })
</script>

<section class="route-system" bind:this={sectionEl}>
  <div class="route-head" class:is-visible={visible}>
    <p class="route-kicker">Transfer engine</p>
    <h2 class="route-title">One product. Three delivery modes. Zero context switching.</h2>
    <p class="route-sub">
      The routing layer is presented like a premium control system, not a hidden technical fallback.
    </p>
  </div>

  <div class="route-board" class:is-visible={visible}>
    {#each methods as method, index}
      <article class="route-column" class:route-column-featured={index === 0}>
        <div class="route-column-top">
          <span>{method.label}</span>
          <strong>{method.name}</strong>
        </div>
        <p>{method.detail}</p>
        <div class="route-lines">
          {#each method.lines as line}
            <div class="route-line">
              <span class="route-line-dot" />
              <em>{line}</em>
            </div>
          {/each}
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  .route-system {
    padding: 110px 24px 24px;
  }

  .route-head,
  .route-board {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out);
  }

  .route-head.is-visible,
  .route-board.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .route-board.is-visible { transition-delay: 120ms; }

  .route-head {
    max-width: 760px;
    margin: 0 auto 40px;
    text-align: center;
  }

  .route-kicker {
    margin: 0 0 14px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .route-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 5vw, 4.5rem);
    line-height: 1;
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .route-sub {
    max-width: 38rem;
    margin: 18px auto 0;
    font-size: 16px;
    line-height: 1.72;
    color: var(--text-2);
  }

  .route-board {
    max-width: 1240px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .route-column {
    padding: 24px;
    border-radius: 32px;
    border: 1px solid var(--border);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
      rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition:
      transform 240ms var(--ease-out),
      border-color 240ms ease,
      box-shadow 240ms ease;
  }

  :global(:not(.dark)) .route-column {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.72)),
      rgba(255, 255, 255, 0.76);
  }

  .route-column:hover {
    transform: translateY(-4px);
    border-color: rgba(255, 255, 255, 0.25);
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.16);
  }

  .route-column-featured {
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow: 0 22px 60px rgba(255, 255, 255, 0.08);
  }

  .route-column-top span {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .route-column-top strong {
    font-family: var(--font-display);
    font-size: 34px;
    line-height: 1;
    letter-spacing: -0.05em;
    color: var(--text-1);
  }

  .route-column p {
    margin: 14px 0 20px;
    font-size: 14px;
    line-height: 1.72;
    color: var(--text-2);
  }

  .route-lines {
    display: grid;
    gap: 10px;
  }

  .route-line {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  :global(:not(.dark)) .route-line {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.68);
  }

  .route-line-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 14px rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  .route-line em {
    font-style: normal;
    font-size: 12px;
    color: var(--text-1);
  }

  @media (max-width: 980px) {
    .route-board {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .route-system {
      padding: 88px 18px 12px;
    }

    .route-column {
      padding: 20px;
    }
  }
</style>
