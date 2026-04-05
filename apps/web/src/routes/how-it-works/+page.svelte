<script lang="ts">
  import { onMount } from 'svelte'
  import Footer from '$components/landing/Footer.svelte'

  const phases = [
    {
      num: '01',
      title: 'Drop your files',
      subtitle: 'The workspace responds immediately.',
      body: [
        'Drag and drop any file — or click to browse. Clex reads every file type instantly and builds a working queue without requiring you to specify anything first.',
        'JPEG, PNG, WebP, PDF, DOCX, ZIP — all classified automatically. The interface adapts to what you dropped, surfacing the right preparation tools for that file type.',
      ],
      details: [
        { label: 'Supported types', value: '12+ formats auto-classified' },
        { label: 'Upload to server?', value: 'Never — all processing is local' },
        { label: 'File size limit', value: 'No limit for P2P transfer' },
      ],
      visual: '01',
    },
    {
      num: '02',
      title: 'Prepare them',
      subtitle: 'Tools chain together without friction.',
      body: [
        'Use the tool panel to compress, convert, merge, split, or bundle your files. Each operation runs entirely in your browser — no upload, no wait, no server round-trip.',
        'When you finish one operation, Clex suggests the next logical step. Compress an image, and it offers to convert it. Convert a DOCX, and it offers to share or ZIP it.',
      ],
      details: [
        { label: 'Processing location', value: 'Your browser, 100%' },
        { label: 'Tool chaining', value: 'Automatic suggestions' },
        { label: 'Formats', value: 'Images · PDFs · Docs · Archives' },
      ],
      visual: '02',
    },
    {
      num: '03',
      title: 'Route and share',
      subtitle: 'Clex picks the fastest path. You stay in control.',
      body: [
        'Click Share and Clex detects the best route: direct WebRTC if a receiver is on the other end, local network if you\'re on the same Wi-Fi, or Google Drive if you need a link.',
        'The receiver gets a clean pull experience — a room code, a QR scan, or a Drive link. They don\'t need Clex installed. Any modern browser works.',
      ],
      details: [
        { label: 'Primary route', value: 'Direct P2P via WebRTC' },
        { label: 'Fast lane', value: 'Local network (same Wi-Fi)' },
        { label: 'Fallback', value: 'Google Drive link' },
        { label: 'Receiver needs?', value: 'Just a browser' },
      ],
      visual: '03',
    },
  ]

  let visible = false
  let sectionEl: HTMLElement

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.05 }
    )
    if (sectionEl) obs.observe(sectionEl)
    return () => obs.disconnect()
  })
</script>

<svelte:head>
  <title>How it works — Clex</title>
  <meta name="description" content="Three steps: drop files, prepare them in your browser, then share via direct P2P, local network, or Google Drive. No uploads, no accounts." />
</svelte:head>

<section class="page-hero section" bind:this={sectionEl}>
  <div class="container">
    <div class="reveal" class:is-visible={visible}>
      <div class="section-label enter-1"><span class="section-label-dot" />Three steps</div>
      <h1 class="page-title enter-2">How Clex works.</h1>
      <p class="page-sub enter-3">
        Drop. Prepare. Share. The entire workflow happens in one browser tab —
        no accounts, no server uploads, no context switches.
      </p>
    </div>
  </div>
</section>

<!-- Phase timeline -->
<section class="phases section">
  <div class="container">
    {#each phases as phase, i}
      <div class="phase" class:phase-reverse={i % 2 !== 0}>
        <!-- Step indicator -->
        <div class="phase-num-col">
          <div class="phase-num font-mono">{phase.num}</div>
          {#if i < phases.length - 1}
            <div class="phase-connector" />
          {/if}
        </div>

        <!-- Content -->
        <div class="phase-content">
          <div class="phase-header">
            <h2 class="phase-title">{phase.title}</h2>
            <p class="phase-subtitle">{phase.subtitle}</p>
          </div>

          <div class="phase-body">
            {#each phase.body as para}
              <p class="phase-para">{para}</p>
            {/each}
          </div>

          <!-- Details table -->
          <div class="phase-details">
            {#each phase.details as detail}
              <div class="detail-row">
                <span class="detail-label font-mono">{detail.label}</span>
                <span class="detail-value">{detail.value}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Visual -->
        <div class="phase-visual phase-visual-{phase.visual}">
          <div class="visual-shell">
            {#if phase.visual === '01'}
              <div class="visual-drop">
                <div class="drop-zone">
                  <div class="drop-icon">⬇</div>
                  <p class="font-mono">Drop files here</p>
                </div>
                <div class="drop-files">
                  <div class="drop-file">
                    <span class="drop-file-icon" style="background:#BFF3FF;color:#04131D;border-color:#000">IMG</span>
                    <span>hero.jpg · 4.8MB</span>
                  </div>
                  <div class="drop-file">
                    <span class="drop-file-icon" style="background:#FFE2B4;color:#3D2200;border-color:#000">PDF</span>
                    <span>brief.pdf · 2.1MB</span>
                  </div>
                  <div class="drop-file">
                    <span class="drop-file-icon" style="background:#DDD6FE;color:#2D1B69;border-color:#000">DOC</span>
                    <span>pricing.docx · 340KB</span>
                  </div>
                </div>
              </div>
            {:else if phase.visual === '02'}
              <div class="visual-prepare">
                <div class="prep-file">
                  <span class="prep-label font-mono">hero.jpg</span>
                  <div class="prep-bar">
                    <div class="prep-fill" style="width: 72%" />
                  </div>
                  <span class="prep-result">4.8MB → 1.4MB</span>
                </div>
                <div class="prep-tools">
                  <div class="prep-chip chip-active">Compress</div>
                  <div class="prep-chip">Convert</div>
                  <div class="prep-chip">Merge PDF</div>
                  <div class="prep-chip">ZIP</div>
                </div>
                <div class="prep-chain">
                  <span class="font-mono text-text-3" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase">Next suggestion</span>
                  <div class="chain-suggest">Convert to WebP →</div>
                </div>
              </div>
            {:else}
              <div class="visual-share">
                <div class="share-code">
                  <span class="code-label font-mono">Room code</span>
                  <div class="code-display font-mono">A7·M2·QX</div>
                </div>
                <div class="share-route">
                  <div class="route-item route-active">
                    <span class="route-dot" style="background:var(--green)" />
                    <span>Direct P2P</span>
                    <span class="route-tag">12ms</span>
                  </div>
                  <div class="route-item">
                    <span class="route-dot" style="background:var(--cyan)" />
                    <span>Local network</span>
                    <span class="route-tag">LAN</span>
                  </div>
                  <div class="route-item">
                    <span class="route-dot" style="background:var(--violet)" />
                    <span>Google Drive</span>
                    <span class="route-tag">Fallback</span>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- Privacy call-out -->
<section class="privacy-banner section-sm">
  <div class="container">
    <div class="privacy-card">
      <div class="privacy-left">
        <h2 class="privacy-title">Privacy isn't a feature — it's the architecture.</h2>
        <p class="privacy-body">
          During direct P2P transfer, Clex's signaling server handles WebRTC handshaking only.
          No file bytes pass through it. Your files go browser-to-browser.
          For Drive transfers, files go directly to your own Google account — not ours.
        </p>
        <a href="/privacy" class="btn-secondary">Read the privacy policy →</a>
      </div>
      <div class="privacy-right">
        <div class="privacy-stat">
          <span class="ps-value">0</span>
          <span class="ps-label">File bytes through Clex servers (P2P)</span>
        </div>
        <div class="privacy-divider" />
        <div class="privacy-stat">
          <span class="ps-value">100%</span>
          <span class="ps-label">Client-side file processing</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Next steps -->
<section class="next-section section-sm">
  <div class="container">
    <h2 class="next-title">Ready to try it?</h2>
    <div class="next-cards">
      <a href="/workspace" class="next-card next-card-primary">
        <span class="next-card-icon">⬡</span>
        <strong>Open workspace</strong>
        <p>Start dropping files now. No signup.</p>
      </a>
      <a href="/getting-started" class="next-card">
        <span class="next-card-icon">◎</span>
        <strong>Getting started guide</strong>
        <p>Step-by-step walkthrough for first-time users.</p>
      </a>
      <a href="/features" class="next-card">
        <span class="next-card-icon">⊕</span>
        <strong>See all features</strong>
        <p>Every tool, explained in detail.</p>
      </a>
    </div>
  </div>
</section>

<Footer />

<style>
  .page-hero { padding-top: 140px; border-bottom: 2px solid var(--border-hard); }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 6rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.95;
    color: var(--text-1);
    margin: 12px 0 16px;
  }

  .page-sub { font-size: 18px; line-height: 1.7; color: var(--text-2); max-width: 52ch; }

  /* ── PHASES ──────────────────────────────────────── */
  .phases { display: flex; flex-direction: column; gap: 0; }

  .phase {
    display: grid;
    grid-template-columns: 72px 1fr 1fr;
    gap: 40px;
    padding-bottom: 64px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 64px;
    align-items: start;
  }

  .phase:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

  @media (max-width: 900px) {
    .phase { grid-template-columns: 48px 1fr; }
    .phase-visual { display: none; }
  }

  @media (max-width: 640px) {
    .phase { grid-template-columns: 1fr; }
    .phase-num-col { display: flex; align-items: center; gap: 16px; }
    .phase-connector { display: none; }
  }

  /* ── NUM COL ─────────────────────────────────────── */
  .phase-num-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .phase-num {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-1);
    flex-shrink: 0;
  }

  .phase-connector {
    width: 2px;
    flex: 1;
    min-height: 80px;
    background: var(--border);
    margin-top: 12px;
  }

  /* ── PHASE CONTENT ───────────────────────────────── */
  .phase-header { margin-bottom: 20px; }

  .phase-title {
    font-family: var(--font-display);
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text-1);
    margin-bottom: 6px;
  }

  .phase-subtitle {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .phase-para { font-size: 15px; line-height: 1.72; color: var(--text-2); margin-bottom: 12px; }

  .phase-details {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-top: 24px;
    border: 2px solid var(--border-hard);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .detail-row:last-child { border-bottom: none; }

  .detail-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .detail-value { font-size: 13px; font-weight: 600; color: var(--text-1); text-align: right; }

  /* ── PHASE VISUALS ───────────────────────────────── */
  .phase-visual {
    border: 2px solid var(--border-hard);
    border-radius: 18px;
    background: var(--surface-2);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .visual-shell { padding: 24px; }

  /* DROP */
  .visual-drop { display: flex; flex-direction: column; gap: 16px; }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 28px;
    border: 2px dashed var(--border-strong);
    border-radius: 12px;
    background: var(--surface);
  }

  .drop-icon { font-size: 28px; animation: float 3s ease-in-out infinite; }
  .drop-zone p { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }

  .drop-files { display: flex; flex-direction: column; gap: 8px; }

  .drop-file {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1.5px solid var(--border-hard);
    border-radius: 10px;
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-size: 12px;
    color: var(--text-1);
  }

  .drop-file-icon {
    width: 30px; height: 30px; border-radius: 7px; display: grid; place-items: center;
    font-family: var(--font-mono); font-size: 9px; font-weight: 700; flex-shrink: 0; border: 1.5px solid;
  }

  /* PREPARE */
  .visual-prepare { display: flex; flex-direction: column; gap: 16px; }

  .prep-file { display: flex; flex-direction: column; gap: 8px; }

  .prep-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: var(--text-2); }

  .prep-bar { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; border: 1px solid var(--border-hard); }

  .prep-fill { height: 100%; background: var(--accent); border-radius: 3px; }

  .prep-result { font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--green); }

  .prep-tools { display: flex; flex-wrap: wrap; gap: 6px; }

  .prep-chip {
    padding: 6px 12px; border-radius: 7px; border: 1.5px solid var(--border);
    background: var(--surface); font-family: var(--font-mono); font-size: 10px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-3);
  }

  .chip-active {
    background: var(--text-1); color: var(--text-inv);
    border-color: var(--border-hard); box-shadow: 2px 2px 0 var(--border-hard);
  }

  .prep-chain {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: 1.5px solid var(--accent-border);
    border-radius: 10px;
    background: var(--accent-dim);
  }

  .chain-suggest {
    font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-1); letter-spacing: 0.04em;
  }

  /* SHARE */
  .visual-share { display: flex; flex-direction: column; gap: 16px; }

  .share-code { display: flex; flex-direction: column; gap: 8px; }

  .code-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-3); }

  .code-display {
    font-size: 28px; font-weight: 700; letter-spacing: 0.2em; color: var(--text-1);
    padding: 14px; border: 2px solid var(--border-hard); border-radius: 10px;
    background: var(--surface); box-shadow: var(--shadow-sm); text-align: center;
  }

  .share-route { display: flex; flex-direction: column; gap: 8px; }

  .route-item {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border: 1.5px solid var(--border); border-radius: 9px;
    font-size: 13px; font-weight: 600; color: var(--text-2);
  }

  .route-active { border-color: var(--border-hard); background: var(--surface); box-shadow: 2px 2px 0 var(--border-hard); color: var(--text-1); }

  .route-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .route-tag { margin-left: auto; font-family: var(--font-mono); font-size: 10px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; }

  /* ── PRIVACY BANNER ──────────────────────────────── */
  .privacy-banner { border-top: 2px solid var(--border-hard); background: var(--surface-2); }

  .privacy-card {
    display: grid; grid-template-columns: 1.4fr 1fr; gap: 0;
    border: 2px solid var(--border-hard); border-radius: 20px;
    overflow: hidden; box-shadow: var(--shadow-xl); background: var(--surface);
  }

  @media (max-width: 760px) { .privacy-card { grid-template-columns: 1fr; } }

  .privacy-left { padding: 40px; display: flex; flex-direction: column; gap: 20px; }

  .privacy-title { font-family: var(--font-display); font-size: clamp(1.3rem, 2.5vw, 2rem); font-weight: 700; letter-spacing: -0.03em; color: var(--text-1); }

  .privacy-body { font-size: 14px; line-height: 1.7; color: var(--text-2); }

  .privacy-right { display: flex; flex-direction: column; border-left: 2px solid var(--border); }

  @media (max-width: 760px) { .privacy-right { border-left: none; border-top: 2px solid var(--border); } }

  .privacy-stat {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 32px; text-align: center;
  }

  .privacy-divider { height: 2px; background: var(--border); }

  .ps-value {
    font-family: var(--font-display); font-size: clamp(2.5rem, 4vw, 4rem); font-weight: 700;
    letter-spacing: -0.05em; line-height: 1; color: var(--accent);
    -webkit-text-stroke: 2px var(--text-1); paint-order: stroke fill;
  }

  :global(:not(.dark)) .ps-value { -webkit-text-stroke: 2px #000; }

  .ps-label { font-family: var(--font-mono); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); max-width: 14ch; }

  /* ── NEXT SECTION ────────────────────────────────── */
  .next-section { border-top: 2px solid var(--border-hard); }

  .next-title {
    font-family: var(--font-display); font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 700;
    letter-spacing: -0.03em; color: var(--text-1); margin-bottom: 32px;
  }

  .next-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  @media (max-width: 760px) { .next-cards { grid-template-columns: 1fr; } }

  .next-card {
    padding: 28px 24px; border: 2px solid var(--border-hard); border-radius: 18px;
    background: var(--surface); box-shadow: var(--shadow-md); text-decoration: none;
    display: flex; flex-direction: column; gap: 10px;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .next-card:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }

  .next-card-primary { background: var(--accent); border-color: #000; box-shadow: 4px 4px 0 #000; }
  .next-card-primary:hover { box-shadow: 6px 6px 0 #000; }
  .next-card-primary strong, .next-card-primary p { color: #000; }

  .next-card-icon { font-size: 28px; }

  .next-card strong { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--text-1); }

  .next-card p { font-size: 13px; color: var(--text-2); line-height: 1.5; }
</style>
