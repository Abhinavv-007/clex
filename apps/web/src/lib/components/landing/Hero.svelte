<script lang="ts">
  import { onMount } from 'svelte'

  const statusCycle = [
    { label: 'Classifying files', color: 'cyan' },
    { label: 'Compressing images', color: 'green' },
    { label: 'Merging PDFs', color: 'violet' },
    { label: 'Negotiating route', color: 'amber' },
    { label: 'Delivery ready', color: 'green' },
  ]

  const routeModes = [
    { id: 'p2p',    label: 'Direct P2P',    desc: 'Browser-to-browser',  speed: '12ms handoff',    icon: '⟷' },
    { id: 'lan',    label: 'Local Network', desc: 'Same-Wi-Fi speed',     speed: 'LAN throughput',  icon: '⊡' },
    { id: 'drive',  label: 'Drive Fallback',desc: 'Encrypted cloud link', speed: '1-click backup',  icon: '↑' },
  ]

  const commandChips = ['Compress', 'Convert', 'Merge PDF', 'DOCX→PDF', 'ZIP', 'Share']
  const fileQueue = [
    { name: 'hero-shot.jpg',    type: 'IMG', size: '4.8 MB → 1.4 MB', status: '-71%',  active: true  },
    { name: 'launch-brief.pdf', type: 'PDF', size: 'Merged · 3 pages',  status: 'Ready', active: false },
    { name: 'pricing.docx',     type: 'DOC', size: 'Converted to PDF',  status: 'Done',  active: false },
    { name: 'assets.zip',       type: 'ZIP', size: '12 files bundled',  status: 'Done',  active: false },
  ]

  let mounted = false
  let statusIndex = 0
  let routeIndex = 0
  let progress = 24
  let progressDir = 1

  onMount(() => {
    requestAnimationFrame(() => { mounted = true })

    const statusTimer = setInterval(() => {
      statusIndex = (statusIndex + 1) % statusCycle.length
    }, 1800)

    const routeTimer = setInterval(() => {
      routeIndex = (routeIndex + 1) % routeModes.length
    }, 2600)

    const progressTimer = setInterval(() => {
      progress += progressDir * 6
      if (progress >= 92) progressDir = -1
      if (progress <= 14) progressDir = 1
    }, 320)

    return () => {
      clearInterval(statusTimer)
      clearInterval(routeTimer)
      clearInterval(progressTimer)
    }
  })

  $: activeStatus = statusCycle[statusIndex]
  $: activeRoute = routeModes[routeIndex]
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
        <a href="/workspace" class="btn-accent hero-cta">
          Open workspace
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <a href="/how-it-works" class="btn-secondary hero-cta">
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

        <!-- Title bar -->
        <div class="stage-titlebar">
          <div class="titlebar-dots">
            <span style="background:#FF5F57" />
            <span style="background:#FFBD2E" />
            <span style="background:#28C840" />
          </div>
          <span class="font-mono text-2xs tracking-widest uppercase text-text-3">Clex Workspace</span>
          <div class="titlebar-status">
            <span class="status-dot" style="background:var(--{activeStatus.color})" />
            <span class="font-mono text-2xs text-text-2">{activeStatus.label}</span>
          </div>
        </div>

        <!-- Main area -->
        <div class="stage-body">

          <!-- Left panel: file queue -->
          <div class="stage-panel">
            <div class="panel-header">
              <span class="font-mono text-2xs uppercase tracking-widest text-text-3">Queue</span>
              <span class="badge-count">{fileQueue.length}</span>
            </div>

            <div class="file-list">
              {#each fileQueue as file, i}
                <div class="file-row" class:file-active={routeIndex === i % routeModes.length}>
                  <div class="file-icon file-icon-{file.type.toLowerCase()}">{file.type}</div>
                  <div class="file-info">
                    <span class="file-name">{file.name}</span>
                    <span class="file-size">{file.size}</span>
                  </div>
                  <span class="file-status" class:status-active={file.active}>{file.status}</span>
                </div>
              {/each}
            </div>

            <!-- Progress -->
            <div class="panel-progress">
              <div class="progress-label">
                <span class="font-mono text-2xs text-text-3">Processing</span>
                <span class="font-mono text-2xs text-text-1">{progress}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:{progress}%" />
              </div>
            </div>
          </div>

          <!-- Right panel: transfer scene -->
          <div class="stage-panel stage-panel-main">
            <div class="panel-header">
              <span class="font-mono text-2xs uppercase tracking-widest text-text-3">Transfer</span>
              <div class="route-badge">
                <span class="route-badge-dot" />
                <span class="font-mono text-2xs">{activeRoute.label}</span>
              </div>
            </div>

            <!-- Beam visualization -->
            <div class="beam-scene">
              <div class="beam-node beam-node-sender">
                <div class="beam-ring" />
                <span class="beam-label">Sender</span>
              </div>

              <div class="beam-track">
                <div class="beam-line" />
                <div class="beam-pulse" />
                <div class="route-tag">{activeRoute.icon} {activeRoute.speed}</div>
              </div>

              <div class="beam-node beam-node-receiver">
                <div class="beam-ring beam-ring-alt" />
                <span class="beam-label">Receiver</span>
              </div>
            </div>

            <!-- Route selector -->
            <div class="route-pills">
              {#each routeModes as route, i}
                <button
                  class="route-pill"
                  class:route-pill-active={routeIndex === i}
                  on:click={() => routeIndex = i}
                >
                  <span class="route-pill-dot" />
                  {route.label}
                </button>
              {/each}
            </div>

            <!-- Command strip -->
            <div class="command-strip">
              {#each commandChips as chip, i}
                <span class="command-chip" class:chip-active={statusIndex === i}>{chip}</span>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Decorative tag -->
      <div class="stage-tag">
        <span class="font-mono text-2xs tracking-widest uppercase">Live demo</span>
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

  .stage-shell {
    border: 2px solid var(--border-hard);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  .stage-titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 2px solid var(--border);
    background: var(--surface-2);
    gap: 12px;
  }

  .titlebar-dots {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .titlebar-dots span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid rgba(0,0,0,0.2);
  }

  :global(.dark) .titlebar-dots span { border-color: rgba(255,255,255,0.15); }

  .titlebar-status {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .stage-body {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    min-height: 480px;
  }

  /* ── PANELS ──────────────────────────────────────── */
  .stage-panel {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .stage-panel + .stage-panel {
    border-left: 2px solid var(--border);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }

  .badge-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--accent);
    color: #000;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    border: 1px solid #000;
  }

  /* ── FILE LIST ───────────────────────────────────── */
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .file-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    transition: border-color 220ms ease, background 220ms ease, transform 180ms ease, box-shadow 180ms ease;
  }

  .file-active {
    border-color: var(--border-hard);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transform: translateX(2px);
  }

  .file-icon {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    border: 1.5px solid #000;
  }

  .file-icon-img { background: #BFF3FF; color: #04131D; }
  .file-icon-pdf { background: #FFE2B4; color: #3D2200; }
  .file-icon-doc { background: #DDD6FE; color: #2D1B69; }
  .file-icon-zip { background: #D1FAE5; color: #064E3B; }

  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .file-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-size {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .file-status {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .status-active { color: var(--green); }

  /* ── PROGRESS ────────────────────────────────────── */
  .panel-progress { margin-top: auto; }

  .progress-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  /* ── BEAM SCENE ──────────────────────────────────── */
  .beam-scene {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 28px 0;
    flex: 1;
  }

  .beam-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .beam-ring {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: var(--shadow-sm);
    position: relative;
  }

  .beam-ring::after {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.3;
  }

  .beam-ring-alt::after { background: var(--cyan); }

  .beam-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .beam-track {
    flex: 1;
    position: relative;
    height: 52px;
    display: flex;
    align-items: center;
    padding: 0 8px;
  }

  .beam-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    background: var(--border);
    transform: translateY(-50%);
  }

  .beam-pulse {
    position: absolute;
    left: 0;
    width: 35%;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    animation: beam-travel 2.4s ease-in-out infinite;
    top: 50%;
    transform: translateY(-50%);
  }

  .route-tag {
    position: absolute;
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    color: var(--text-3);
    white-space: nowrap;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* ── ROUTE PILLS ─────────────────────────────────── */
  .route-badge {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .route-badge-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .route-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .route-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    cursor: pointer;
    transition: all 160ms ease;
  }

  .route-pill:hover {
    border-color: var(--border-strong);
    color: var(--text-1);
  }

  .route-pill-active {
    border-color: var(--border-hard);
    background: var(--accent);
    color: #000;
    box-shadow: 2px 2px 0 #000;
  }

  .route-pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  /* ── COMMAND STRIP ───────────────────────────────── */
  .command-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .command-chip {
    padding: 6px 11px;
    border-radius: 6px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    transition: all 200ms ease;
  }

  .chip-active {
    border-color: var(--border-hard);
    background: var(--text-1);
    color: var(--text-inv);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  /* ── STAGE TAG ───────────────────────────────────── */
  .stage-tag {
    position: absolute;
    top: -12px;
    right: 24px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 2px solid var(--border-hard);
    background: var(--accent);
    color: #000;
    box-shadow: 2px 2px 0 #000;
    letter-spacing: 0.1em;
    text-transform: uppercase;
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

    .stage-body {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .stage-panel + .stage-panel {
      border-left: none;
      border-top: 2px solid var(--border);
    }

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
