<script lang="ts">
  import { onMount } from 'svelte'
  import Footer from '$components/landing/Footer.svelte'

  const toolCategories = [
    {
      id: 'images',
      label: 'Images',
      color: '#22D3EE',
      tools: [
        {
          title: 'Image Compression',
          desc: 'Reduce file size by up to 90% while preserving visual quality. Uses smart lossy compression that respects your quality threshold. Supports JPEG, PNG, and WebP.',
          specs: ['Up to 90% size reduction', 'Adjustable quality slider', 'Batch processing', 'JPEG · PNG · WebP'],
        },
        {
          title: 'Format Conversion',
          desc: 'Convert any image to your target format instantly. No cloud processing — conversions happen in your browser via the Canvas API.',
          specs: ['JPEG · PNG · WebP · AVIF', 'Lossless and lossy modes', 'Preview before download', 'Preserves EXIF on demand'],
        },
      ],
    },
    {
      id: 'pdf',
      label: 'PDF',
      color: '#FFAA00',
      tools: [
        {
          title: 'PDF Merge',
          desc: 'Combine multiple PDF files into one document. Drag to reorder pages before merging. All merging happens client-side using pdf-lib.',
          specs: ['Unlimited input files', 'Drag-to-reorder pages', 'Preserves bookmarks', 'Client-side only'],
        },
        {
          title: 'PDF Split & Extract',
          desc: 'Pull specific page ranges from a PDF, or split a large PDF into individual single-page files. Page-level precision with live preview.',
          specs: ['Range-based splitting', 'Individual page extraction', 'Preview before export', 'Retains original quality'],
        },
        {
          title: 'PDF to Image',
          desc: 'Export any PDF page as a high-resolution PNG or JPEG. Uses PDF.js for accurate rendering at any DPI.',
          specs: ['Configurable DPI', 'Page-level selection', 'PNG · JPEG export', 'Accurate text rendering'],
        },
      ],
    },
    {
      id: 'convert',
      label: 'Convert',
      color: '#9B7FFF',
      tools: [
        {
          title: 'DOCX → PDF',
          desc: 'Convert Microsoft Word documents to PDF without any server-side processing. Uses Mammoth for accurate layout fidelity.',
          specs: ['100% client-side', 'Preserves formatting', 'Tables and lists supported', 'No Word required'],
        },
      ],
    },
    {
      id: 'archive',
      label: 'Archive',
      color: '#00E570',
      tools: [
        {
          title: 'ZIP Bundling',
          desc: 'Bundle any collection of files into a ZIP archive for clean single-package delivery. Supports any file type, any size.',
          specs: ['Any file type', 'Custom archive name', 'Folder structure support', 'Instant download'],
        },
      ],
    },
    {
      id: 'transfer',
      label: 'Transfer',
      color: '#FF4466',
      tools: [
        {
          title: 'Direct P2P (WebRTC)',
          desc: 'Send files directly browser-to-browser. Files never touch Clex servers. The signaling layer only handles connection negotiation.',
          specs: ['End-to-end encrypted', 'No server file storage', 'No account required', '6-char room codes'],
        },
        {
          title: 'Local Network Routing',
          desc: 'Clex detects when sender and receiver share a local network and routes the transfer locally for maximum speed.',
          specs: ['Auto-detected', 'LAN throughput speed', 'No internet dependency', 'Same Wi-Fi or hotspot'],
        },
        {
          title: 'Google Drive Fallback',
          desc: "Upload to your own Google Drive when P2P isn't available. Clex never touches your files — they go directly to your account.",
          specs: ['Your Drive, your files', 'OAuth 2.0 secured', 'Token never persisted to server', 'Shareable Drive links'],
        },
        {
          title: 'QR Code Sharing',
          desc: 'Generate a scannable QR code from any share link. Ideal for phone-to-phone handoff without typing.',
          specs: ['Instant QR generation', 'Works with all routes', 'Mobile-optimized receive flow', 'One scan to receive'],
        },
      ],
    },
    {
      id: 'system',
      label: 'System',
      color: '#FFE600',
      tools: [
        {
          title: 'Smart Tool Chaining',
          desc: 'The output of one tool becomes the suggested input for the next. Compress → Convert → Share in one continuous motion without re-dropping files.',
          specs: ['Context-aware suggestions', 'State persists between tools', 'Zero re-upload friction', 'Works across all tools'],
        },
        {
          title: 'Offline Mode',
          desc: 'After the first page load, all file preparation tools work without internet. Compression, conversion, and PDF operations are fully offline-capable.',
          specs: ['Progressive Web App ready', 'All tools work offline', 'Transfer requires network', 'Reliable anywhere'],
        },
      ],
    },
  ]

  let visible = false
  let sectionEl: HTMLElement
  let activeCategory = 'images'

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.05 }
    )
    if (sectionEl) obs.observe(sectionEl)
    return () => obs.disconnect()
  })

  $: activeCat = toolCategories.find(c => c.id === activeCategory) ?? toolCategories[0]
</script>

<svelte:head>
  <title>Features — Clex</title>
  <meta name="description" content="Every tool Clex includes: image compression, PDF operations, DOCX conversion, ZIP bundling, direct P2P transfer, local network routing, and Google Drive fallback." />
</svelte:head>

<!-- Page hero -->
<section class="page-hero section" bind:this={sectionEl}>
  <div class="container">
    <div class="page-hero-inner reveal" class:is-visible={visible}>
      <div class="section-label enter-1">
        <span class="section-label-dot" />
        Features
      </div>
      <h1 class="page-title enter-2">
        Everything in<br/>
        <span class="title-accent">one surface.</span>
      </h1>
      <p class="page-sub enter-3">
        12 tools across 6 categories. All running in your browser,
        all chaining together, all designed to eliminate the gap
        between preparing files and sending them.
      </p>
      <a href="/workspace" class="btn-accent enter-4">Open workspace →</a>
    </div>
  </div>
</section>

<!-- Category nav -->
<div class="cat-nav-wrap">
  <div class="cat-nav container">
    {#each toolCategories as cat}
      <button
        class="cat-btn"
        class:cat-active={activeCategory === cat.id}
        style="--cat-color: {cat.color}"
        on:click={() => activeCategory = cat.id}
      >
        {cat.label}
      </button>
    {/each}
  </div>
</div>

<!-- Tool detail -->
<section class="tools-detail section">
  <div class="container">
    {#each toolCategories as cat}
      {#if activeCategory === cat.id}
        <div class="cat-header" style="--cat-color: {cat.color}">
          <div class="cat-color-bar" />
          <h2 class="cat-title">{cat.label}</h2>
          <span class="cat-count font-mono">{cat.tools.length} {cat.tools.length === 1 ? 'tool' : 'tools'}</span>
        </div>

        <div class="detail-grid">
          {#each cat.tools as tool, i}
            <div class="detail-card" style="animation-delay: {i * 80}ms" style:--cat-color={cat.color}>
              <h3 class="detail-title">{tool.title}</h3>
              <p class="detail-desc">{tool.desc}</p>
              <ul class="detail-specs">
                {#each tool.specs as spec}
                  <li class="spec-item">
                    <span class="spec-dot" />
                    {spec}
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
</section>

<!-- Chain explanation -->
<section class="chain-section section-sm">
  <div class="container">
    <div class="chain-inner">
      <div class="chain-copy">
        <div class="section-label">
          <span class="section-label-dot" />
          Tool chaining
        </div>
        <h2 class="chain-title">The output of one tool is the input of the next.</h2>
        <p class="chain-body">
          Compress an image, convert it to a different format, then send it — all in one continuous workspace motion.
          Clex tracks what you've processed and surfaces the next logical action.
        </p>
        <a href="/how-it-works" class="btn-secondary">See the full flow →</a>
      </div>
      <div class="chain-visual">
        <div class="chain-step">
          <div class="chain-node">IMG</div>
          <span>Compress</span>
        </div>
        <div class="chain-arrow">→</div>
        <div class="chain-step">
          <div class="chain-node chain-node-2">PNG</div>
          <span>Convert</span>
        </div>
        <div class="chain-arrow">→</div>
        <div class="chain-step">
          <div class="chain-node chain-node-3">ZIP</div>
          <span>Bundle</span>
        </div>
        <div class="chain-arrow">→</div>
        <div class="chain-step chain-step-share">
          <div class="chain-node chain-node-4">⟷</div>
          <span>Share</span>
        </div>
      </div>
    </div>
  </div>
</section>

<Footer />

<style>
  /* ── PAGE HERO ───────────────────────────────────── */
  .page-hero {
    padding-top: 140px;
    border-bottom: 2px solid var(--border-hard);
  }

  .page-hero-inner {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 680px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 6rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.95;
    color: var(--text-1);
  }

  .title-accent {
    color: var(--accent);
    -webkit-text-stroke: 2px var(--text-1);
    paint-order: stroke fill;
  }

  :global(:not(.dark)) .title-accent { -webkit-text-stroke: 2px #000; }

  .page-sub {
    font-size: 18px;
    line-height: 1.7;
    color: var(--text-2);
    max-width: 52ch;
  }

  /* ── CATEGORY NAV ────────────────────────────────── */
  .cat-nav-wrap {
    position: sticky;
    top: 82px;
    z-index: 40;
    background: var(--surface);
    border-bottom: 2px solid var(--border-hard);
    border-top: 2px solid var(--border);
  }

  .cat-nav {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 12px 24px;
    scrollbar-width: none;
  }

  .cat-nav::-webkit-scrollbar { display: none; }

  .cat-btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 2px solid transparent;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    cursor: pointer;
    white-space: nowrap;
    transition: color 150ms ease, border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
  }

  .cat-btn:hover { color: var(--text-1); border-color: var(--border); }

  .cat-active {
    color: #000 !important;
    background: var(--cat-color) !important;
    border-color: #000 !important;
    box-shadow: 2px 2px 0 #000 !important;
  }

  /* ── DETAIL SECTION ──────────────────────────────── */
  .cat-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid var(--border);
  }

  .cat-color-bar {
    width: 6px;
    height: 40px;
    border-radius: 3px;
    background: var(--cat-color);
    border: 1.5px solid #000;
    flex-shrink: 0;
  }

  .cat-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-1);
    flex: 1;
  }

  .cat-count {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-3);
    text-transform: uppercase;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }

  .detail-card {
    padding: 28px;
    border: 2px solid var(--border-hard);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: fadeUp 300ms var(--ease-out) both;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .detail-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-lg);
    border-color: var(--cat-color);
  }

  .detail-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .detail-desc {
    font-size: 14px;
    line-height: 1.72;
    color: var(--text-2);
    flex: 1;
  }

  .detail-specs {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .spec-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-2);
  }

  .spec-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--cat-color);
    flex-shrink: 0;
  }

  /* ── CHAIN SECTION ───────────────────────────────── */
  .chain-section {
    border-top: 2px solid var(--border-hard);
    background: var(--surface-2);
  }

  .chain-inner {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 56px;
    align-items: center;
  }

  @media (max-width: 900px) { .chain-inner { grid-template-columns: 1fr; } }

  .chain-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-1);
    margin: 12px 0 16px;
  }

  .chain-body {
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-2);
    margin-bottom: 24px;
    max-width: 48ch;
  }

  .chain-visual {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .chain-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .chain-step span {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .chain-node {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 2px solid #000;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    background: #BFF3FF;
    color: #04131D;
    box-shadow: 3px 3px 0 #000;
  }

  .chain-node-2 { background: #DDD6FE; color: #2D1B69; }
  .chain-node-3 { background: #D1FAE5; color: #064E3B; }
  .chain-node-4 { background: var(--accent); color: #000; font-size: 18px; }

  .chain-arrow {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 700;
    color: var(--text-3);
    margin-bottom: 20px;
  }
</style>
