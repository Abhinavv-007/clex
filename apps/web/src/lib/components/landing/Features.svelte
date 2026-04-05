<script lang="ts">
  import { onMount } from 'svelte'

  let sectionEl: HTMLElement
  let visible = false
  let cardEls: HTMLElement[] = []
  let cardVisible: boolean[] = [false, false, false, false, false, false, false, false]

  onMount(() => {
    // Section header reveal
    const sectionObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; sectionObs.disconnect() } },
      { threshold: 0.15 }
    )
    sectionObs.observe(sectionEl)

    // Individual card staggered reveals
    cardEls.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setTimeout(() => { cardVisible[i] = true; cardVisible = cardVisible }, i * 80)
            obs.disconnect()
          }
        },
        { threshold: 0.1 }
      )
      obs.observe(el)
    })
  })
</script>

<section id="features" class="features-section" bind:this={sectionEl}>
  <div class="features-inner">

    <!-- Section header -->
    <div class="section-header" class:section-visible={visible}>
      <p class="section-eyebrow">What it does</p>
      <h2 class="section-headline">
        <span class="sh-word" style="--d:0">Prepare.</span>
        <span class="sh-word" style="--d:1">Then</span>
        <span class="sh-word" style="--d:2">share.</span>
        <br/>
        <span class="sh-word sh-muted" style="--d:3">No</span>
        <span class="sh-word sh-muted" style="--d:4">in-between.</span>
      </h2>
      <p class="section-sub">Every feature is connected. One workspace, one flow.</p>
    </div>

    <!-- Bento grid -->
    <div class="bento-grid">

      <!-- Large: P2P -->
      <div
        class="bento-cell bento-large"
        class:card-revealed={cardVisible[0]}
        bind:this={cardEls[0]}
      >
        <div class="bento-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="15" cy="5" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="15" cy="15" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M7.5 9L12.5 6M7.5 11L12.5 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Direct P2P transfer</h3>
        <p class="bento-desc">Files travel browser-to-browser using WebRTC. No cloud hop, no server storage. Your data never leaves the devices.</p>
        <!-- Beam illustration -->
        <div class="beam-illustration" aria-hidden="true">
          <div class="beam-device">
            <div class="bd-screen">
              <div class="bd-file" />
              <div class="bd-file" style="width:70%" />
            </div>
          </div>
          <div class="beam-track">
            <div class="beam-particle" />
            <div class="beam-label">P2P · encrypted</div>
          </div>
          <div class="beam-device">
            <div class="bd-screen">
              <div class="bd-file bd-received" />
              <div class="bd-file bd-received" style="width:55%; opacity: 0.5" />
            </div>
          </div>
        </div>
      </div>

      <!-- Local network -->
      <div
        class="bento-cell bento-medium"
        class:card-revealed={cardVisible[1]}
        bind:this={cardEls[1]}
      >
        <div class="bento-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 14a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
            <path d="M5.5 11.5a5 5 0 017 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M2.5 8.5a9 9 0 0113 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Local network speed</h3>
        <p class="bento-desc">On the same Wi-Fi? Detected automatically. Full local speed, zero latency overhead.</p>
        <div class="nearby-badge">
          <span class="nearby-dot" />
          Nearby device detected
        </div>
      </div>

      <!-- Google Drive -->
      <div
        class="bento-cell bento-medium"
        class:card-revealed={cardVisible[2]}
        bind:this={cardEls[2]}
      >
        <div class="bento-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 13l3-6 3 6H3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M9 13l3-6 3 6H9z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M6 7h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Google Drive fallback</h3>
        <p class="bento-desc">Upload to your Drive, generate a link. Elegant cloud fallback when direct isn't possible.</p>
      </div>

      <!-- Image tools -->
      <div
        class="bento-cell bento-small"
        class:card-revealed={cardVisible[3]}
        bind:this={cardEls[3]}
      >
        <div class="bento-icon-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" stroke-width="1.3"/>
            <circle cx="5.5" cy="5.5" r="1.2" fill="currentColor"/>
            <path d="M2 11l3.5-3.5L8 10l2.5-2.5L14 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Image tools</h3>
        <p class="bento-desc">Compress, convert between formats (WebP, AVIF, JPEG, PNG). Client-side, instant.</p>
      </div>

      <!-- PDF tools -->
      <div
        class="bento-cell bento-small"
        class:card-revealed={cardVisible[4]}
        bind:this={cardEls[4]}
      >
        <div class="bento-icon-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M9.5 1.5H4a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 004 14.5h8a1.5 1.5 0 001.5-1.5V5.5L9.5 1.5z" stroke="currentColor" stroke-width="1.3"/>
            <path d="M9.5 1.5v3a.5.5 0 00.5.5h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M5 8.5h6M5 11h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="bento-title">PDF operations</h3>
        <p class="bento-desc">Merge, split, extract pages, or export to images. No uploads.</p>
      </div>

      <!-- Smart chaining — wide -->
      <div
        class="bento-cell bento-wide"
        class:card-revealed={cardVisible[5]}
        bind:this={cardEls[5]}
      >
        <div class="bento-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9h4l2-5 2 10 2-5h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Smart tool chaining</h3>
        <p class="bento-desc">After every operation Clex suggests what to do next. Compress → Convert → Share feels like one motion, not three separate tools.</p>
        <div class="chain-chips">
          <span class="chain-step">Compress</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step chain-step-active">Convert</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step">Share</span>
        </div>
      </div>

      <!-- Word to PDF -->
      <div
        class="bento-cell bento-small"
        class:card-revealed={cardVisible[6]}
        bind:this={cardEls[6]}
      >
        <div class="bento-icon-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 3h6l2 2h4v9H2V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M8 9l2 2-2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Word → PDF</h3>
        <p class="bento-desc">DOCX to PDF conversion, all in the browser.</p>
      </div>

      <!-- ZIP -->
      <div
        class="bento-cell bento-small"
        class:card-revealed={cardVisible[7]}
        bind:this={cardEls[7]}
      >
        <div class="bento-icon-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 1.5h8A1.5 1.5 0 0113.5 3v10A1.5 1.5 0 0112 14.5H4A1.5 1.5 0 012.5 13V3A1.5 1.5 0 014 1.5z" stroke="currentColor" stroke-width="1.3"/>
            <path d="M6.5 1.5v3M9.5 1.5v3M6.5 7v1.5M9.5 7v1.5M6.5 10.5V12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <rect x="5.5" y="4.5" width="5" height="2" rx=".5" stroke="currentColor" stroke-width="1.1"/>
          </svg>
        </div>
        <h3 class="bento-title">ZIP bundler</h3>
        <p class="bento-desc">Pack multiple files into a single ZIP for easy sharing.</p>
      </div>

    </div>
  </div>
</section>

<style>
  .features-section {
    padding: 120px 24px;
    border-top: 1px solid var(--border);
  }

  .features-inner {
    max-width: 1000px;
    margin: 0 auto;
  }

  /* ── Section header with reveal ── */
  .section-header {
    text-align: center;
    margin-bottom: 72px;
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
  }

  .section-header.section-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .section-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-3);
    margin-bottom: 20px;
  }

  .section-headline {
    font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
    font-size: clamp(2.2rem, 5.5vw, 3.8rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.08;
    margin-bottom: 18px;
  }

  .sh-word {
    display: inline-block;
    background: linear-gradient(
      180deg,
      rgba(190,190,195,1) 0%,
      rgba(230,230,235,1) 50%,
      rgba(255,255,255,1) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  :global(:not(.dark)) .sh-word {
    background: linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,1) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .sh-muted {
    opacity: 0.5;
  }

  .section-sub {
    font-size: 15px;
    color: var(--text-2);
    max-width: 380px;
    margin: 0 auto;
    line-height: 1.65;
  }

  /* ── Bento grid ── */
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }

  /* Cell base */
  .bento-cell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 26px;
    /* Scroll reveal */
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 0.6s cubic-bezier(0.16,1,0.3,1),
      transform 0.6s cubic-bezier(0.16,1,0.3,1),
      border-color 0.25s ease,
      box-shadow 0.25s ease;
  }

  .bento-cell.card-revealed {
    opacity: 1;
    transform: translateY(0);
  }

  :global(.dark) .bento-cell {
    background: rgba(14,14,18,0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .bento-cell:hover {
    border-color: var(--border-strong);
    box-shadow: 0 6px 28px rgba(0,0,0,0.08);
    transform: translateY(-3px);
  }

  :global(.dark) .bento-cell:hover {
    box-shadow: 0 6px 32px rgba(0,0,0,0.35);
  }

  .bento-cell.card-revealed:hover {
    transform: translateY(-3px);
  }

  /* Grid placements */
  .bento-large  { grid-column: span 3; grid-row: span 2; }
  .bento-medium { grid-column: span 3; }
  .bento-wide   { grid-column: span 4; }
  .bento-small  { grid-column: span 2; }

  /* Icon */
  .bento-icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    margin-bottom: 18px;
    transition: background 0.2s, border-color 0.2s;
  }

  .bento-cell:hover .bento-icon-wrap {
    border-color: var(--border-strong);
  }

  .bento-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }

  .bento-desc {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.7;
  }

  /* ── Beam illustration ── */
  .beam-illustration {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 32px;
  }

  .beam-device {
    flex-shrink: 0;
    width: 56px;
    height: 42px;
    border-radius: 7px;
    background: var(--raised);
    border: 1px solid var(--border);
    padding: 7px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bd-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .bd-file {
    height: 4px;
    border-radius: 2px;
    background: var(--border-strong);
    width: 100%;
  }

  .bd-received {
    background: var(--text-1);
    opacity: 0.7;
  }

  .beam-track {
    flex: 1;
    position: relative;
    height: 2px;
    background: var(--border);
    border-radius: 1px;
    overflow: hidden;
  }

  .beam-particle {
    position: absolute;
    top: 0;
    left: -30%;
    width: 40%;
    height: 100%;
    background: linear-gradient(90deg, transparent, var(--text-1), transparent);
    border-radius: 1px;
    animation: slideBeam 2.2s ease-in-out infinite;
  }

  .beam-label {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: var(--text-3);
    white-space: nowrap;
    font-weight: 500;
    letter-spacing: 0.05em;
  }

  @keyframes slideBeam {
    0% { transform: translateX(-100%); opacity: 0; }
    15% { opacity: 1; }
    85% { opacity: 1; }
    100% { transform: translateX(350%); opacity: 0; }
  }

  /* ── Nearby badge ── */
  .nearby-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 18px;
    padding: 5px 13px;
    border-radius: 100px;
    background: rgba(16,185,129,0.06);
    border: 1px solid rgba(16,185,129,0.15);
    font-size: 11px;
    color: #10b981;
    font-weight: 500;
  }

  .nearby-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px rgba(16,185,129,0.5);
    animation: nearbyPulse 2.5s ease-in-out infinite;
  }

  @keyframes nearbyPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* ── Chain chips ── */
  .chain-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 22px;
    flex-wrap: wrap;
  }

  .chain-step {
    padding: 5px 14px;
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
    background: var(--raised);
    border: 1px solid var(--border);
    color: var(--text-2);
    transition: all 0.25s ease;
  }

  .chain-step:hover {
    border-color: var(--border-strong);
    color: var(--text-1);
  }

  .chain-step-active {
    background: var(--text-1);
    color: var(--text-inv);
    border-color: var(--text-1);
  }

  .chain-step-active:hover {
    color: var(--text-inv);
    opacity: 0.9;
  }

  .chain-arrow {
    font-size: 13px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .bento-grid { grid-template-columns: repeat(2, 1fr); }
    .bento-large  { grid-column: span 2; grid-row: span 1; }
    .bento-medium { grid-column: span 2; }
    .bento-wide   { grid-column: span 2; }
    .bento-small  { grid-column: span 1; }
    .beam-illustration { display: none; }
  }

  @media (max-width: 480px) {
    .bento-grid { grid-template-columns: 1fr; }
    .bento-large, .bento-medium, .bento-wide, .bento-small {
      grid-column: span 1;
      grid-row: span 1;
    }
  }
</style>
