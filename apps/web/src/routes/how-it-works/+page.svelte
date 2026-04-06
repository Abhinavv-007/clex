<script lang="ts">
  import { onMount } from 'svelte'
  import DropZoneMock from '$components/mocks/DropZoneMock.svelte'
  import RouteSelectionMock from '$components/mocks/RouteSelectionMock.svelte'
  import ToolChainMock from '$components/mocks/ToolChainMock.svelte'
  import WindowChrome from '$components/mocks/WindowChrome.svelte'
  import Footer from '$components/landing/Footer.svelte'

  let heroVisible = false
  let heroEl: HTMLElement

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { heroVisible = true; obs.disconnect() } },
      { threshold: 0.05 }
    )
    if (heroEl) obs.observe(heroEl)

    const revealEls = document.querySelectorAll('.reveal-scroll')
    revealEls.forEach((el) => {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          ;(e.target as HTMLElement).classList.add('in-view')
          io.disconnect()
        }
      }, { threshold: 0.1 })
      io.observe(el)
    })

    return () => obs.disconnect()
  })

  const steps = [
    {
      num: '01',
      title: 'Drop Your Files',
      text: "Open Clex in your browser. Drag files in — images, PDFs, documents, anything. They stay in your browser's memory. Nothing gets uploaded to any server.",
      tags: ['Drag & Drop', 'Click to Browse', 'Paste from Clipboard'],
      visual: 'drop',
      flip: false,
    },
    {
      num: '02',
      title: 'Prepare & Transform',
      text: 'Use built-in tools to process your files before sharing. Compress images, merge PDFs, convert DOCX to PDF, bundle into ZIP. Chain operations together — one flows into the next.',
      tags: ['Compress', 'Merge', 'Convert', 'Split', 'ZIP', 'Chain'],
      visual: 'tools',
      flip: true,
    },
    {
      num: '03',
      title: 'Share & Deliver',
      text: "Hit share. Clex scans the network, detects available routes, and picks the fastest path. Direct P2P is always tried first. Local network for same-Wi-Fi speed. Google Drive when direct isn't possible.",
      tags: ['P2P Default', 'Local Network', 'Drive Fallback'],
      visual: 'share',
      flip: false,
    },
  ]

  const edgeCases = [
    {
      title: "What if I'm offline?",
      text: 'After Clex loads once, the preparation tools work completely offline. Compress images, merge PDFs, convert documents — all without internet. Share when you reconnect.',
    },
    {
      title: 'What about large files?',
      text: "Local network transfer handles large files at LAN speed. For remote transfers, P2P streams chunks progressively. Drive has Google's file limits for the fallback path.",
    },
    {
      title: "What if P2P fails?",
      text: "Clex automatically detects when direct P2P can't establish. It offers local network or Google Drive as alternatives. You choose — Clex never switches without asking.",
    },
    {
      title: 'What browsers work?',
      text: 'Chrome, Firefox, Safari, Edge — any modern browser with WebRTC support. Mobile browsers work too. Clex adapts the interface to your screen size automatically.',
    },
  ]
</script>

<svelte:head>
  <title>How It Works — Clex | Drop, Prepare, Share</title>
  <meta name="description" content="Three steps: drop files into your workspace, prepare them with built-in tools, and share through the fastest route. See how Clex connects preparation to delivery." />
</svelte:head>

<!-- Hero -->
<section class="hiw-hero" bind:this={heroEl}>
  <div class="container">
    <span class="section-label hiw-label" class:enter-done={heroVisible}>
      <span class="section-label-dot"></span>
      The Process
    </span>
    <h1 class="hiw-h1" class:enter-done={heroVisible}>
      Three Steps.<br>Zero Friction.
    </h1>
    <p class="hiw-lead" class:enter-done={heroVisible}>
      Clex connects preparation and delivery into a single flow. Here's exactly how it works, from first drop to final delivery.
    </p>
  </div>
</section>

<!-- Giant Steps -->
<section class="giant-steps-section">
  <div class="container">
    <div class="giant-steps">
      {#each steps as step}
        <div class="giant-step reveal-scroll" class:giant-step--flip={step.flip}>
          <!-- Content side -->
          <div class="giant-step__content">
            <div class="gs-num font-mono">{step.num}</div>
            <h2 class="gs-title">{step.title}</h2>
            <p class="gs-text">{step.text}</p>
            <div class="gs-tags">
              {#each step.tags as tag, ti}
                <span class="gs-badge" class:gs-badge-accent={ti === 0 && step.num === '03'}>{tag}</span>
              {/each}
            </div>
          </div>

          <!-- Visual panel side -->
          <WindowChrome
            title={step.visual === 'drop' ? 'Workspace — Drop Zone' : step.visual === 'tools' ? 'Workspace — Tools Active' : 'Workspace — Route Selection'}
            compact={true}
            bodyMinHeight="240px"
          >
            {#if step.visual === 'drop'}
              <DropZoneMock />
            {:else if step.visual === 'tools'}
              <ToolChainMock />
            {:else}
              <RouteSelectionMock />
            {/if}
          </WindowChrome>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Banner -->
<div class="hiw-banner reveal-scroll">
  <div class="container">
    <p class="hiw-banner-text">Files go from A → B.<br>Nothing in between.</p>
  </div>
</div>

<!-- Edge Cases -->
<section class="section edge-section">
  <div class="container">
    <div class="edge-header reveal-scroll">
      <span class="section-label" style="justify-content:flex-start;">
        <span class="section-label-dot"></span>What If…?
      </span>
      <h2 class="edge-title">Clex Handles<br>the Edge Cases.</h2>
    </div>
    <div class="edge-grid">
      {#each edgeCases as card}
        <div class="edge-card reveal-scroll">
          <h3 class="edge-card-title">{card.title}</h3>
          <p class="edge-card-text">{card.text}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- CTA -->
<section class="hiw-cta">
  <div class="container">
    <h2 class="hiw-cta-title reveal-scroll">
      Simple enough?<br><span class="hiw-cta-accent">Try it now.</span>
    </h2>
    <p class="hiw-cta-text reveal-scroll">No download, no install, no signup. Just open and drop.</p>
    <div class="reveal-scroll">
      <a href="/workspace" class="btn-accent hiw-cta-btn">Open Workspace →</a>
    </div>
  </div>
</section>

<Footer />

<style>
  /* ── Scroll reveal ─────────────────────── */
  .reveal-scroll {
    opacity: 0;
    transform: translateY(36px);
    transition: opacity 0.55s var(--ease-out), transform 0.55s var(--ease-out);
  }
  :global(.reveal-scroll.in-view) { opacity: 1; transform: none; }

  /* ── Hero entry animations ─────────────── */
  .hiw-label { opacity: 0; transform: translateY(16px); transition: opacity .5s var(--ease-out), transform .5s var(--ease-out); }
  .hiw-h1    { opacity: 0; transform: translateY(28px); transition: opacity .55s var(--ease-out) .1s, transform .55s var(--ease-out) .1s; }
  .hiw-lead  { opacity: 0; transform: translateY(20px); transition: opacity .5s var(--ease-out) .2s, transform .5s var(--ease-out) .2s; }
  .hiw-label.enter-done, .hiw-h1.enter-done, .hiw-lead.enter-done { opacity: 1; transform: none; }

  /* ── Hero ─────────────────────────────── */
  .hiw-hero {
    padding: 10rem 0 5rem;
    background: var(--canvas);
    border-bottom: 2px solid var(--border-hard);
  }
  .hiw-h1 {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 6rem);
    font-weight: 700;
    line-height: 0.95;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin: 16px 0 20px;
  }
  .hiw-lead {
    font-size: clamp(16px, 2vw, 18px);
    color: var(--text-2);
    line-height: 1.72;
    max-width: 50ch;
  }

  /* ── Giant Steps ─────────────────────── */
  .giant-steps-section { padding: 0; }
  .giant-steps { display: flex; flex-direction: column; }

  .giant-step {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5rem;
    padding: 5rem 0;
    border-bottom: 2px solid var(--border);
    align-items: center;
  }
  .giant-step:last-child { border-bottom: none; }

  /* Flip: move visual to left by reversing column order */
  .giant-step--flip { direction: rtl; }
  .giant-step--flip > * { direction: ltr; }

  .gs-num {
    font-size: clamp(5rem, 10vw, 9rem);
    font-weight: 700;
    line-height: 0.85;
    color: transparent;
    -webkit-text-stroke: 3px var(--accent-text);
    margin-bottom: 24px;
    letter-spacing: -0.01em;
    display: block;
  }
  :global(.dark) .gs-num { -webkit-text-stroke: 3px var(--accent-text); }

  .gs-title {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 3.5vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-1);
    margin-bottom: 16px;
    line-height: 1.05;
  }
  .gs-text {
    font-size: 16px;
    color: var(--text-2);
    max-width: 45ch;
    line-height: 1.75;
    margin-bottom: 24px;
  }
  .gs-tags { display: flex; flex-wrap: wrap; gap: 8px; }
  .gs-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 5px 12px;
    border: 2px solid var(--border-hard);
    background: transparent;
    color: var(--text-2);
    box-shadow: 2px 2px 0 var(--border-hard);
  }
  .gs-badge-accent { background: var(--accent); color: #000; border-color: #000; box-shadow: 2px 2px 0 #000; }

  /* ── Step Visual Panel ── */
  /* ── Banner ─────────────────────────── */
  .hiw-banner {
    padding: 5rem 0; text-align: center;
    background: var(--accent); color: #000;
    border-top: 3px solid #000; border-bottom: 3px solid #000;
  }
  .hiw-banner-text {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 4.5rem);
    font-weight: 700; text-transform: uppercase;
    line-height: 1.1; color: #000; letter-spacing: -0.03em;
  }

  /* ── Edge Cases ─────────────────────── */
  .edge-section { background: var(--canvas); }
  .edge-header { margin-bottom: 40px; }
  .edge-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 3.5rem);
    font-weight: 700; letter-spacing: -0.04em;
    color: var(--text-1); margin-top: 12px; line-height: 1.05;
  }
  .edge-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; max-width: 1100px;
  }
  .edge-card {
    padding: 32px;
    border: 2px solid var(--border-hard); background: var(--surface);
    box-shadow: var(--shadow-md);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }
  .edge-card:hover { transform: translate(-3px,-3px); box-shadow: var(--shadow-lg); }
  .edge-card-title {
    font-family: var(--font-display); font-size: 16px; font-weight: 700;
    text-transform: uppercase; color: var(--text-1); margin-bottom: 10px;
  }
  .edge-card-text { font-size: 14px; color: var(--text-2); line-height: 1.7; margin: 0; }

  /* ── CTA ────────────────────────────── */
  .hiw-cta {
    padding: 6rem 0; text-align: center;
    background: var(--surface-2);
    border-top: 2px solid var(--border-hard);
  }
  .hiw-cta-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 4rem); font-weight: 700;
    letter-spacing: -0.04em; line-height: 1.05;
    color: var(--text-1); margin-bottom: 16px;
  }
  .hiw-cta-accent { color: var(--accent-text); }
  .hiw-cta-text {
    font-size: 17px; color: var(--text-2); max-width: 40ch;
    margin: 0 auto 32px; line-height: 1.7;
  }
  .hiw-cta-btn { font-size: 15px; padding: 14px 30px; }

  /* ── Responsive ─────────────────────── */
  @media (max-width: 900px) {
    .giant-step {
      grid-template-columns: 1fr;
      gap: 2.5rem; padding: 3.5rem 0;
      direction: ltr;
    }
    .giant-step--flip { direction: ltr; }
    .gs-num { font-size: 5rem; }
    .edge-grid { grid-template-columns: 1fr; }
  }
</style>
