<section id="features" class="features-section">
  <div class="features-inner">

    <!-- Section header -->
    <div class="section-header">
      <p class="section-eyebrow">What it does</p>
      <h2 class="section-headline">Prepare. Then share.<br/>No in-between.</h2>
      <p class="section-sub">Every feature is connected. One workspace, one flow.</p>
    </div>

    <!-- Bento grid -->
    <div class="bento-grid">

      <!-- Large featured cell — P2P transfer -->
      <div class="bento-cell bento-large">
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
        <!-- Transfer beam illustration -->
        <div class="beam-illustration" aria-hidden="true">
          <div class="beam-device beam-sender">
            <div class="bd-screen">
              <div class="bd-file" />
              <div class="bd-file" style="width:70%" />
            </div>
          </div>
          <div class="beam-track">
            <div class="beam-particle" />
            <div class="beam-label">P2P · encrypted</div>
          </div>
          <div class="beam-device beam-receiver">
            <div class="bd-screen">
              <div class="bd-file" style="background: var(--text-1); opacity: 0.8" />
              <div class="bd-file" style="width:55%; background: var(--text-1); opacity: 0.4" />
            </div>
          </div>
        </div>
      </div>

      <!-- Local network detection -->
      <div class="bento-cell bento-medium">
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
      <div class="bento-cell bento-medium">
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
      <div class="bento-cell bento-small">
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
      <div class="bento-cell bento-small">
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

      <!-- Smart flow / chaining — wide cell -->
      <div class="bento-cell bento-wide">
        <div class="bento-icon-wrap">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9h4l2-5 2 10 2-5h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="bento-title">Smart tool chaining</h3>
        <p class="bento-desc">After every operation Clex suggests what to do next. Compress → Convert → Share feels like one motion, not three separate tools.</p>
        <!-- Chain suggestion chips -->
        <div class="chain-chips">
          <span class="chain-step">Compress</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step chain-step-active">Convert</span>
          <span class="chain-arrow">→</span>
          <span class="chain-step">Share</span>
        </div>
      </div>

      <!-- Word to PDF -->
      <div class="bento-cell bento-small">
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
      <div class="bento-cell bento-small">
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
    padding: 100px 24px;
    border-top: 1px solid var(--border);
  }

  .features-inner {
    max-width: 1000px;
    margin: 0 auto;
  }

  /* Section header */
  .section-header {
    text-align: center;
    margin-bottom: 64px;
  }

  .section-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
    margin-bottom: 16px;
  }

  .section-headline {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: var(--text-1);
    margin-bottom: 16px;
  }

  .section-sub {
    font-size: 15px;
    color: var(--text-2);
    max-width: 380px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* Bento grid */
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }

  /* Cell base */
  .bento-cell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .bento-cell:hover {
    border-color: var(--border-strong);
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }

  :global(.dark) .bento-cell:hover {
    box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  }

  /* Grid placements */
  .bento-large  { grid-column: span 3; grid-row: span 2; }
  .bento-medium { grid-column: span 3; }
  .bento-wide   { grid-column: span 4; }
  .bento-small  { grid-column: span 2; }

  /* Icon */
  .bento-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    margin-bottom: 16px;
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
    line-height: 1.65;
  }

  /* Beam illustration */
  .beam-illustration {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 28px;
  }

  .beam-device {
    flex-shrink: 0;
    width: 56px;
    height: 40px;
    border-radius: 6px;
    background: var(--raised);
    border: 1px solid var(--border);
    padding: 6px;
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

  .beam-track {
    flex: 1;
    position: relative;
    height: 2px;
    background: var(--border);
    border-radius: 1px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .beam-particle {
    position: absolute;
    top: 0;
    left: -20%;
    width: 40%;
    height: 100%;
    background: linear-gradient(90deg, transparent, var(--text-1), transparent);
    border-radius: 1px;
    animation: slideBeam 2s ease-in-out infinite;
  }

  .beam-label {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: var(--text-3);
    white-space: nowrap;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  @keyframes slideBeam {
    0% { transform: translateX(-100%); opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translateX(350%); opacity: 0; }
  }

  /* Nearby badge */
  .nearby-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 5px 12px;
    border-radius: 100px;
    background: rgba(34,197,94,0.08);
    border: 1px solid rgba(34,197,94,0.2);
    font-size: 11px;
    color: #22c55e;
    font-weight: 500;
  }

  .nearby-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34,197,94,0.5);
    animation: pulseDot 2s ease-in-out infinite;
  }

  @keyframes pulseDot {
    0%,100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Chain chips */
  .chain-chips {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
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
    transition: all 0.2s;
  }

  .chain-step-active {
    background: var(--text-1);
    color: var(--text-inv);
    border-color: var(--text-1);
  }

  .chain-arrow {
    font-size: 13px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  /* Responsive */
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
