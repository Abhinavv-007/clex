<script lang="ts">
  import { onMount } from 'svelte'
  import HeroWorkspaceMock from '$components/mocks/HeroWorkspaceMock.svelte'
  import { siteRoutes as defaultSiteRoutes, type SiteRoutes } from '$utils'

  export let routes: SiteRoutes = defaultSiteRoutes

  let mounted = false

  onMount(() => {
    requestAnimationFrame(() => { mounted = true })
  })
</script>

<section class="hero">
  <!-- ── COPY SIDE ─────────────────────────────────── -->
  <div class="hero-inner">
    <div class="hero-copy" class:mounted>

      <!-- Eyebrow badge -->
      <div class="hero-eyebrow">
        <span class="eyebrow-dot" />
        <span class="font-mono text-2xs tracking-widest uppercase text-text-3">File motion workspace</span>
      </div>

      <!-- Main heading -->
      <h1 class="hero-heading">
        <span class="heading-line-1">Drop.</span>
        <span class="heading-line-2">Prepare.</span>
        <span class="heading-line-3">Share.</span>
      </h1>

      <!-- Sub -->
      <p class="hero-sub">
        One browser workspace for preparing files and sending them anywhere —
        direct P2P, same-network speed, or Google Drive. No accounts, no uploads,
        no friction.
      </p>

      <!-- CTAs -->
      <div class="hero-actions">
        <a href={routes.workspace} class="btn-accent hero-cta">
          Open workspace
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <a href={routes.howItWorks} class="btn-secondary hero-cta">
          See how it works
        </a>
      </div>

      <!-- Trust signals -->
      <div class="hero-trust">
        <div class="trust-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L9 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5L7 1Z"
              fill="var(--accent)" stroke="#000" stroke-width="1"/>
          </svg>
          No account required
        </div>
        <div class="trust-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L9 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5L7 1Z"
              fill="var(--accent)" stroke="#000" stroke-width="1"/>
          </svg>
          Files never touch our servers
        </div>
        <div class="trust-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L9 5H13L9.5 7.5L11 12L7 9.5L3 12L4.5 7.5L1 5H5L7 1Z"
              fill="var(--accent)" stroke="#000" stroke-width="1"/>
          </svg>
          Works offline after load
        </div>
      </div>
    </div>

    <!-- ── PRODUCT DEMO ──────────────────────────────── -->
    <div class="hero-stage" class:mounted>
      <div class="stage-shell">
        <HeroWorkspaceMock />
      </div>
    </div>
  </div>

  <!-- ── TICKER BAR ─────────────────────────────────── -->
  <div class="hero-ticker" aria-hidden="true">
    <div class="ticker-track">
      {#each Array(2) as _}
        <span>Direct P2P Transfer</span>
        <span class="ticker-sep">·</span>
        <span>Local Network Speed</span>
        <span class="ticker-sep">·</span>
        <span>Google Drive Fallback</span>
        <span class="ticker-sep">·</span>
        <span>Image Compression</span>
        <span class="ticker-sep">·</span>
        <span>PDF Operations</span>
        <span class="ticker-sep">·</span>
        <span>DOCX to PDF</span>
        <span class="ticker-sep">·</span>
        <span>ZIP Bundling</span>
        <span class="ticker-sep">·</span>
        <span>No Server Storage</span>
        <span class="ticker-sep">·</span>
        <span>Privacy First</span>
        <span class="ticker-sep">·</span>
        <span>Offline Capable</span>
        <span class="ticker-sep">·</span>
      {/each}
    </div>
  </div>
</section>

<style>
  /* ── HERO LAYOUT ─────────────────────────────────── */
  .hero {
    position: relative;
    min-height: 100svh;
    padding-top: 100px;
    overflow: clip;
  }

  .hero-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 48px 24px 80px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 48px;
    align-items: center;
  }

  /* ── COPY ─────────────────────────────────────────── */
  .hero-copy {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .hero-copy > * {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out);
  }

  .hero-copy.mounted > *:nth-child(1) { opacity: 1; transform: none; transition-delay: 0ms; }
  .hero-copy.mounted > *:nth-child(2) { opacity: 1; transform: none; transition-delay: 80ms; }
  .hero-copy.mounted > *:nth-child(3) { opacity: 1; transform: none; transition-delay: 160ms; }
  .hero-copy.mounted > *:nth-child(4) { opacity: 1; transform: none; transition-delay: 240ms; }
  .hero-copy.mounted > *:nth-child(5) { opacity: 1; transform: none; transition-delay: 320ms; }

  /* ── EYEBROW ─────────────────────────────────────── */
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 8px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    width: fit-content;
  }

  .eyebrow-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    animation: pulse-dot 2.4s ease-in-out infinite;
  }

  /* ── HEADING ─────────────────────────────────────── */
  .hero-heading {
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    font-size: clamp(4rem, 9vw, 7.5rem);
    font-weight: 700;
    line-height: 0.92;
    letter-spacing: -0.05em;
    color: var(--text-1);
  }

  .heading-line-1 { color: var(--text-1); }
  .heading-line-2 { color: var(--text-2); }

  .heading-line-3 {
    color: var(--accent);
    -webkit-text-stroke: 2px var(--text-1);
    paint-order: stroke fill;
  }

  :global(:not(.dark)) .heading-line-3 {
    -webkit-text-stroke: 2px #000;
  }

  /* ── SUB ─────────────────────────────────────────── */
  .hero-sub {
    max-width: 38ch;
    font-size: 17px;
    line-height: 1.72;
    color: var(--text-2);
  }

  /* ── ACTIONS ─────────────────────────────────────── */
  .hero-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .hero-cta {
    min-width: 160px;
    padding: 14px 24px;
    font-size: 15px;
  }

  /* ── TRUST SIGNALS ───────────────────────────────── */
  .hero-trust {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }

  .trust-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-3);
    text-transform: uppercase;
  }

  /* ── STAGE ───────────────────────────────────────── */
  .hero-stage {
    position: relative;
    opacity: 0;
    transform: translateY(32px) scale(0.97);
    transition: opacity 800ms var(--ease-out) 200ms, transform 800ms var(--ease-out) 200ms;
  }

  .hero-stage.mounted {
    opacity: 1;
    transform: none;
  }

  /* ── TICKER ──────────────────────────────────────── */
  .hero-ticker {
    overflow: hidden;
    border-top: 2px solid var(--border-hard);
    background: var(--surface-2);
    padding: 14px 0;
  }

  .ticker-track {
    display: flex;
    gap: 24px;
    width: max-content;
    animation: ticker 30s linear infinite;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    white-space: nowrap;
  }

  .ticker-sep {
    color: var(--accent);
    font-size: 14px;
  }

  /* ── RESPONSIVE ──────────────────────────────────── */
  @media (max-width: 1100px) {
    .hero-inner {
      grid-template-columns: 1fr;
      gap: 40px;
    }

    .hero-copy { max-width: 700px; }
    .stage-shell { max-width: 680px; margin: 0 auto; }
  }

  @media (max-width: 760px) {
    .hero { padding-top: 88px; }

    .hero-inner { padding: 32px 18px 64px; }

    .hero-sub { font-size: 15px; }

    .hero-actions { flex-direction: column; }
    .hero-cta { width: 100%; }
  }

  @media (max-width: 480px) {
    .hero-heading {
      font-size: clamp(3.2rem, 18vw, 4.5rem);
    }
  }
</style>
