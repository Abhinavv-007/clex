<script lang="ts">
  import { onMount } from 'svelte'
  import { siteRoutes as defaultSiteRoutes, type SiteRoutes } from '$utils'

  export let routes: SiteRoutes = defaultSiteRoutes

  const tools = [
    {
      icon: '⇩',
      title: 'Image Compression',
      desc: 'Reduce image size by up to 90% while preserving visual quality. JPEG, PNG, WebP supported.',
      tag: 'Images',
      color: 'cyan',
      metric: 'Up to 90% smaller',
    },
    {
      icon: '⇄',
      title: 'Format Conversion',
      desc: 'Convert between image formats instantly in the browser. No uploads, no waiting.',
      tag: 'Convert',
      color: 'violet',
      metric: '8 formats supported',
    },
    {
      icon: '⊕',
      title: 'PDF Merge',
      desc: 'Combine multiple PDFs into one. Drag to reorder pages before merging.',
      tag: 'PDF',
      color: 'amber',
      metric: 'Unlimited pages',
    },
    {
      icon: '⊗',
      title: 'PDF Split & Extract',
      desc: 'Pull specific pages from a PDF or split a large file into individual documents.',
      tag: 'PDF',
      color: 'amber',
      metric: 'Page-level precision',
    },
    {
      icon: '⬡',
      title: 'DOCX → PDF',
      desc: 'Convert Word documents to PDF in seconds. Runs entirely in your browser.',
      tag: 'Convert',
      color: 'violet',
      metric: '100% client-side',
    },
    {
      icon: '⊞',
      title: 'ZIP Bundling',
      desc: 'Bundle any set of files into a ZIP archive for clean, single-package delivery.',
      tag: 'Archive',
      color: 'green',
      metric: 'Any file type',
    },
    {
      icon: '⟳',
      title: 'Smart Tool Chaining',
      desc: 'Compress an image, convert it, then share it — all in one continuous flow.',
      tag: 'System',
      color: 'red',
      metric: 'Zero context switches',
    },
    {
      icon: '⟷',
      title: 'Direct P2P Transfer',
      desc: 'Send files browser-to-browser via WebRTC. No relay, no server storage.',
      tag: 'Transfer',
      color: 'cyan',
      metric: 'End-to-end encrypted',
    },
    {
      icon: '⊡',
      title: 'Local Network Routing',
      desc: 'Detected on the same Wi-Fi? Files route locally for near-instant delivery.',
      tag: 'Transfer',
      color: 'green',
      metric: 'LAN speed',
    },
    {
      icon: '↑',
      title: 'Google Drive Fallback',
      desc: 'When direct transfer isn\'t possible, upload to your own Drive and share the link.',
      tag: 'Cloud',
      color: 'violet',
      metric: 'Your storage, your control',
    },
    {
      icon: '⬡',
      title: 'QR Code Sharing',
      desc: 'Generate a QR code from any share link. Point and receive — no typing required.',
      tag: 'Share',
      color: 'amber',
      metric: 'Instant mobile handoff',
    },
    {
      icon: '◎',
      title: 'Offline Capable',
      desc: 'All file operations work offline after the first load. Reliable anywhere.',
      tag: 'System',
      color: 'green',
      metric: 'Works without internet',
    },
  ]

  const colorMap: Record<string, string> = {
    cyan:   '#22D3EE',
    violet: '#9B7FFF',
    amber:  '#FFAA00',
    green:  '#00E570',
    red:    '#FF4466',
  }

  let sectionEl: HTMLElement
  let visible = false
  let visibleCards: boolean[] = new Array(tools.length).fill(false)

  onMount(() => {
    const sectionObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; sectionObs.disconnect() } },
      { threshold: 0.08 }
    )
    if (sectionEl) sectionObs.observe(sectionEl)

    const cardEls = sectionEl?.querySelectorAll('.tool-card') ?? []
    const cardObs = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const idx = Number((entry.target as HTMLElement).dataset.idx)
          if (entry.isIntersecting) {
            visibleCards[idx] = true
            visibleCards = [...visibleCards]
          }
        })
      },
      { threshold: 0.15 }
    )
    cardEls.forEach((el: Element) => cardObs.observe(el))

    return () => { sectionObs.disconnect(); cardObs.disconnect() }
  })
</script>

<section id="features" class="features section" bind:this={sectionEl}>
  <div class="container">

    <!-- Header -->
    <div class="features-header reveal" class:is-visible={visible}>
      <div class="section-label">
        <span class="section-label-dot" />
        Capabilities
      </div>
      <h2 class="features-title">
        Every tool in one
        <span class="title-accent">motion.</span>
      </h2>
      <p class="features-sub">
        File preparation and delivery live in the same surface.
        Compress, convert, merge, then send — without switching apps or tabs.
      </p>
    </div>

    <!-- Statement strip -->
    <div class="features-statement reveal reveal-2" class:is-visible={visible}>
      <div class="statement-inner">
        <div class="statement-col">
          <span class="stat-num">12+</span>
          <span class="stat-label">File formats</span>
        </div>
        <div class="statement-divider" />
        <div class="statement-col">
          <span class="stat-num">3</span>
          <span class="stat-label">Transfer routes</span>
        </div>
        <div class="statement-divider" />
        <div class="statement-col">
          <span class="stat-num">0</span>
          <span class="stat-label">Server uploads (P2P)</span>
        </div>
        <div class="statement-divider" />
        <div class="statement-col">
          <span class="stat-num">100%</span>
          <span class="stat-label">Client-side processing</span>
        </div>
      </div>
    </div>

    <!-- Tool grid -->
    <div class="tools-grid">
      {#each tools as tool, i}
        <article
          class="tool-card"
          class:is-visible={visibleCards[i]}
          data-idx={i}
          style="--card-color: {colorMap[tool.color] ?? '#FFE600'};
                 transition-delay: {(i % 4) * 60}ms"
        >
          <div class="card-top">
            <div class="tool-icon-wrap">
              <span class="tool-icon">{tool.icon}</span>
            </div>
            <span class="tool-tag" style="color: var(--card-color); border-color: var(--card-color); background: color-mix(in srgb, var(--card-color) 12%, transparent)">{tool.tag}</span>
          </div>

          <h3 class="tool-title">{tool.title}</h3>
          <p class="tool-desc">{tool.desc}</p>

          <div class="tool-metric">
            <span class="metric-dot" style="background: var(--card-color)" />
            <span class="metric-text">{tool.metric}</span>
          </div>
        </article>
      {/each}
    </div>

    <!-- Bottom CTA -->
    <div class="features-cta reveal reveal-3" class:is-visible={visible}>
      <p class="cta-note">All tools run in your browser. Nothing leaves your device during preparation.</p>
      <a href={routes.workspace} class="btn-accent">Try it now</a>
    </div>

  </div>
</section>

<style>
  /* ── HEADER ─────────────────────────────────────── */
  .features-header {
    max-width: 640px;
    margin-bottom: 48px;
  }

  .features-title {
    font-family: var(--font-display);
    font-size: clamp(2.4rem, 5vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
    color: var(--text-1);
    margin-bottom: 18px;
  }

  .title-accent {
    color: var(--accent-text);
  }

  .features-sub {
    font-size: 17px;
    line-height: 1.7;
    color: var(--text-2);
    max-width: 48ch;
  }

  /* ── STATEMENT STRIP ─────────────────────────────── */
  .features-statement {
    margin-bottom: 56px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .statement-inner {
    display: flex;
    align-items: stretch;
  }

  .statement-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 28px 20px;
  }

  .stat-num {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text-1);
    line-height: 1;
  }

  .stat-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    text-align: center;
  }

  .statement-divider {
    width: 2px;
    background: var(--border);
    flex-shrink: 0;
  }

  @media (max-width: 640px) {
    .statement-inner { flex-direction: column; }
    .statement-divider { width: auto; height: 1px; }
  }

  /* ── TOOL GRID ───────────────────────────────────── */
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 64px;
  }

  @media (max-width: 1100px) { .tools-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 760px)  { .tools-grid { grid-template-columns: 1fr; } }

  /* ── TOOL CARD ───────────────────────────────────── */
  .tool-card {
    padding: 32px 28px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 16px;
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 500ms var(--ease-out),
      transform 500ms var(--ease-out),
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .tool-card.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .tool-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--card-color);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .tool-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: var(--shadow-sm);
    display: grid;
    place-items: center;
  }

  .tool-icon {
    font-size: 28px;
    line-height: 1;
  }

  .tool-tag {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1.5px solid;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .tool-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-1);
    line-height: 1.3;
  }

  .tool-desc {
    font-size: 15px;
    line-height: 1.65;
    color: var(--text-2);
    flex: 1;
  }

  .tool-metric {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .metric-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .metric-text {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  /* ── BOTTOM CTA ──────────────────────────────────── */
  .features-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 32px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    flex-wrap: wrap;
  }

  .cta-note {
    font-size: 15px;
    color: var(--text-2);
    max-width: 52ch;
  }
</style>
