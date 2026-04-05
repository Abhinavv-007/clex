<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade } from 'svelte/transition'

  let visible = false
  let demoPhase = 0
  let progressWidth = 0
  let statusText = 'Analyzing files…'
  let roomCode = ''
  let roomRevealed = false
  let filesEntered = false
  let codeChars = 'XK7F2P'.split('')

  const statusTexts = [
    'Analyzing files…',
    'Compressing photo.jpg…',
    'Converting to WebP…',
    'Preparing transfer…',
    'Transfer ready ✓'
  ]

  onMount(() => {
    requestAnimationFrame(() => { visible = true })

    // Animate demo card phases
    setTimeout(() => { filesEntered = true }, 1200)

    // Progress bar animation
    let progress = 0
    const progressInterval = setInterval(() => {
      progress += 0.8
      progressWidth = Math.min(progress, 100)
      if (progress >= 100) {
        clearInterval(progressInterval)
      }
    }, 60)

    // Status text rotation
    let statusIdx = 0
    const statusInterval = setInterval(() => {
      statusIdx = (statusIdx + 1) % statusTexts.length
      statusText = statusTexts[statusIdx]
    }, 2200)

    // Room code reveal
    setTimeout(() => {
      roomRevealed = true
      let charIdx = 0
      const codeInterval = setInterval(() => {
        if (charIdx < codeChars.length) {
          roomCode += codeChars[charIdx]
          charIdx++
        } else {
          clearInterval(codeInterval)
        }
      }, 120)
    }, 2400)

    return () => {
      clearInterval(progressInterval)
      clearInterval(statusInterval)
    }
  })
</script>

<section class="hero-section">
  <!-- Eyebrow badge -->
  {#if visible}
    <div in:fly={{ y: 16, duration: 600, delay: 100 }} class="hero-eyebrow">
      <span class="eyebrow-pulse" />
      <span>File workspace · No storage · P2P transfer</span>
    </div>
  {/if}

  <!-- Headline with metallic gradient -->
  {#if visible}
    <h1 in:fly={{ y: 28, duration: 700, delay: 220 }} class="hero-headline">
      <span class="headline-line">
        <span class="headline-word" style="--delay: 0">Prepare</span>
        <span class="headline-word" style="--delay: 1">files.</span>
      </span>
      <span class="headline-line">
        <span class="headline-word" style="--delay: 2">Share</span>
        <span class="headline-word headline-accent" style="--delay: 3">instantly.</span>
      </span>
    </h1>
  {/if}

  <!-- Sub copy -->
  {#if visible}
    <p in:fly={{ y: 18, duration: 600, delay: 380 }} class="hero-sub">
      One workspace to compress, convert, and transfer files — peer-to-peer,
      over local network, or via Google Drive. Everything runs in your browser.
    </p>
  {/if}

  <!-- CTAs -->
  {#if visible}
    <div in:fly={{ y: 14, duration: 550, delay: 480 }} class="hero-ctas">
      <a href="/workspace" class="cta-primary">
        <span class="cta-text">Open workspace</span>
        <span class="cta-arrow">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="cta-shine" />
      </a>
      <a href="/#how-it-works" class="cta-secondary">
        See how it works
      </a>
    </div>
  {/if}

  <!-- Product Demo Card — the centerpiece -->
  {#if visible}
    <div in:fade={{ duration: 800, delay: 640 }} class="demo-wrap">
      <a href="/workspace" class="demo-card">
        <!-- Window chrome -->
        <div class="demo-chrome">
          <div class="chrome-dots">
            <span class="dot dot-red" />
            <span class="dot dot-yellow" />
            <span class="dot dot-green" />
          </div>
          <span class="chrome-title">clex — workspace</span>
          <div class="chrome-actions">
            <span class="chrome-pill">⌘K</span>
          </div>
        </div>

        <!-- Body -->
        <div class="demo-body">
          <!-- Files panel -->
          <div class="demo-col demo-files">
            <div class="col-label">
              <span>Files</span>
              <span class="col-count">3</span>
            </div>

            {#if filesEntered}
              <div class="file-item file-active" in:fly={{ x: -20, duration: 400, delay: 0 }}>
                <div class="file-icon file-pdf">PDF</div>
                <div class="file-info">
                  <span class="file-name">report.pdf</span>
                  <span class="file-size">2.4 MB</span>
                </div>
                <span class="file-badge file-badge-done">Ready</span>
              </div>
              <div class="file-item" in:fly={{ x: -20, duration: 400, delay: 120 }}>
                <div class="file-icon file-img">IMG</div>
                <div class="file-info">
                  <span class="file-name">photo.jpg</span>
                  <span class="file-size">4.1 MB → 1.2 MB</span>
                </div>
                <span class="file-badge file-badge-active">−71%</span>
              </div>
              <div class="file-item" in:fly={{ x: -20, duration: 400, delay: 240 }}>
                <div class="file-icon file-doc">DOC</div>
                <div class="file-info">
                  <span class="file-name">brief.docx</span>
                  <span class="file-size">0.8 MB</span>
                </div>
              </div>
            {/if}

            <div class="drop-zone">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <span>Drop files here</span>
            </div>
          </div>

          <!-- Tools panel -->
          <div class="demo-col demo-tools">
            <div class="col-label">
              <span>Processing</span>
            </div>

            <div class="tool-active">
              <div class="tool-header">
                <span class="tool-name">Compress images</span>
                <span class="tool-badge">{statusText}</span>
              </div>
              <div class="tool-progress">
                <div class="tool-bar" style="width: {progressWidth}%" />
              </div>
              <div class="tool-meta">
                <span>4.1 MB → 1.2 MB</span>
                <span class="tool-savings">−71% size</span>
              </div>
            </div>

            <div class="tool-suggestion">
              <span class="suggestion-arrow">→</span>
              <span>Convert to WebP</span>
              <span class="suggestion-tag">Suggested</span>
            </div>
            <div class="tool-suggestion">
              <span class="suggestion-arrow">→</span>
              <span>Share files</span>
            </div>
          </div>

          <!-- Share panel -->
          <div class="demo-col demo-share">
            <div class="col-label">
              <span>Transfer</span>
            </div>

            <div class="share-method share-method-active">
              <div class="share-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="3" cy="6" r="1.5" fill="currentColor"/>
                  <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
                  <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
                  <path d="M4.5 5.1L7.5 3.9M4.5 6.9L7.5 8.1" stroke="currentColor" stroke-width="1"/>
                </svg>
              </div>
              <span>Direct P2P</span>
              <span class="share-check">✓</span>
            </div>
            <div class="share-method">
              <div class="share-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 8a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                  <path d="M3.5 7.5a3.5 3.5 0 015 0" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                  <path d="M1.5 5.5a6.5 6.5 0 019 0" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                </svg>
              </div>
              <span>Local network</span>
            </div>
            <div class="share-method">
              <div class="share-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 8V2M3 5l3-3 3 3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                  <path d="M1 10h10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                </svg>
              </div>
              <span>Google Drive</span>
            </div>

            <!-- Room code reveal -->
            <div class="room-block">
              <span class="room-label">Room code</span>
              <div class="room-code">
                {#each codeChars as char, i}
                  <span
                    class="room-char"
                    class:revealed={i < roomCode.length}
                    style="--char-delay: {i * 80}ms"
                  >{roomCode.length > i ? char : '·'}</span>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </a>

      <!-- Glow behind card -->
      <div class="demo-glow" aria-hidden="true" />
      <div class="demo-reflection" aria-hidden="true" />
    </div>
  {/if}
</section>

<style>
  .hero-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 160px 24px 100px;
    max-width: 1200px;
    margin: 0 auto;
    position: relative;
  }

  /* ── Eyebrow ── */
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--text-3);
    padding: 6px 16px;
    border: 1px solid var(--border);
    border-radius: 100px;
    background: var(--raised);
    margin-bottom: 40px;
    text-transform: uppercase;
  }

  .eyebrow-pulse {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px rgba(16,185,129,0.6);
    animation: pulse 2.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(16,185,129,0.6); }
    50% { opacity: 0.6; box-shadow: 0 0 16px rgba(16,185,129,0.3); }
  }

  /* ── Headline ── */
  .hero-headline {
    font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
    font-size: clamp(3.2rem, 8vw, 7rem);
    font-weight: 700;
    line-height: 1.02;
    letter-spacing: -0.04em;
    margin-bottom: 28px;
    max-width: 820px;
  }

  .headline-line {
    display: block;
  }

  .headline-word {
    display: inline-block;
    background: linear-gradient(
      180deg,
      rgba(190,190,195,1) 0%,
      rgba(230,230,235,1) 40%,
      rgba(255,255,255,1) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: wordReveal 0.8s cubic-bezier(0.16,1,0.3,1) calc(var(--delay) * 0.12s + 0.3s) both;
  }

  /* Light mode: dark text */
  :global(:not(.dark)) .headline-word {
    background: linear-gradient(
      180deg,
      rgba(10,10,10,0.6) 0%,
      rgba(10,10,10,0.85) 40%,
      rgba(10,10,10,1) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .headline-accent {
    background: linear-gradient(
      180deg,
      rgba(16,185,129,0.5) 0%,
      rgba(220,220,225,1) 50%,
      rgba(255,255,255,1) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  :global(:not(.dark)) .headline-accent {
    background: linear-gradient(
      180deg,
      rgba(16,185,129,0.3) 0%,
      rgba(10,10,10,0.8) 50%,
      rgba(10,10,10,1) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes wordReveal {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Sub copy ── */
  .hero-sub {
    font-size: 17px;
    color: var(--text-2);
    line-height: 1.75;
    max-width: 540px;
    margin-bottom: 44px;
    opacity: 0.85;
  }

  /* ── CTAs ── */
  .hero-ctas {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 80px;
  }

  .cta-primary {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 13px 28px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    text-decoration: none;
    overflow: hidden;
    transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease;
  }

  .cta-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }

  .cta-primary:active {
    transform: translateY(0) scale(0.98);
  }

  .cta-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    animation: shine 4s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes shine {
    0%, 80%, 100% { left: -100%; }
    40% { left: 120%; }
  }

  .cta-text { position: relative; z-index: 1; }
  .cta-arrow {
    position: relative;
    z-index: 1;
    display: flex;
    transition: transform 0.2s ease;
  }
  .cta-primary:hover .cta-arrow { transform: translateX(3px); }

  .cta-secondary {
    display: inline-flex;
    align-items: center;
    padding: 13px 28px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--border-strong);
    text-decoration: none;
    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
  }

  .cta-secondary:hover {
    background: var(--raised);
    color: var(--text-1);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .cta-secondary:active { transform: scale(0.98); }

  /* ── Demo card wrapper ── */
  .demo-wrap {
    position: relative;
    width: 100%;
    max-width: 960px;
  }

  .demo-glow {
    display: none;
    position: absolute;
    inset: -60px;
    border-radius: 32px;
    background: radial-gradient(
      ellipse 50% 40% at 50% 50%,
      rgba(16,185,129,0.04) 0%,
      rgba(255,255,255,0.02) 40%,
      transparent 70%
    );
    pointer-events: none;
    z-index: 0;
    animation: glowPulse 8s ease-in-out infinite;
  }

  :global(.dark) .demo-glow { display: block; }

  @keyframes glowPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .demo-reflection {
    display: none;
    position: absolute;
    bottom: -40px;
    left: 10%;
    right: 10%;
    height: 80px;
    background: linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%);
    border-radius: 0 0 24px 24px;
    filter: blur(8px);
    pointer-events: none;
    z-index: 0;
  }

  :global(.dark) .demo-reflection { display: block; }

  /* ── Demo card ── */
  .demo-card {
    position: relative;
    z-index: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.04) inset,
      0 12px 56px rgba(0,0,0,0.12),
      0 2px 8px rgba(0,0,0,0.06);
    transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease;
  }

  :global(.dark) .demo-card {
    background: rgba(14,14,18,0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.04) inset,
      0 12px 56px rgba(0,0,0,0.6),
      0 2px 8px rgba(0,0,0,0.4);
  }

  .demo-card:hover {
    transform: translateY(-3px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.06) inset,
      0 20px 80px rgba(0,0,0,0.16),
      0 4px 12px rgba(0,0,0,0.08);
  }

  :global(.dark) .demo-card:hover {
    box-shadow:
      0 1px 0 rgba(255,255,255,0.06) inset,
      0 20px 80px rgba(0,0,0,0.7),
      0 4px 12px rgba(0,0,0,0.5);
  }

  /* ── Chrome bar ── */
  .demo-chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 18px;
    background: var(--raised);
    border-bottom: 1px solid var(--border);
  }

  :global(.dark) .demo-chrome {
    background: rgba(18,18,22,0.8);
  }

  .chrome-dots {
    display: flex;
    gap: 7px;
    align-items: center;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot-red { background: #ff5f57; }
  .dot-yellow { background: #ffbd2e; }
  .dot-green { background: #28c840; }

  :global(.dark) .dot-red { background: rgba(255,95,87,0.6); }
  :global(.dark) .dot-yellow { background: rgba(255,189,46,0.6); }
  :global(.dark) .dot-green { background: rgba(40,200,64,0.6); }

  .chrome-title {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  .chrome-pill {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--border);
    color: var(--text-3);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.02em;
  }

  .chrome-actions {
    display: flex;
    gap: 6px;
  }

  /* ── Body 3-col ── */
  .demo-body {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1fr;
    min-height: 260px;
  }

  .demo-col {
    padding: 16px;
    border-right: 1px solid var(--border);
  }

  .demo-col:last-child { border-right: none; }

  .col-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
    margin-bottom: 12px;
  }

  .col-count {
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 100px;
    background: var(--border);
    color: var(--text-3);
  }

  /* ── File items ── */
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border-radius: 9px;
    margin-bottom: 4px;
    border: 1px solid transparent;
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
    cursor: default;
  }

  .file-item:hover {
    background: var(--raised);
    transform: translateX(2px);
  }

  .file-active {
    background: var(--raised);
    border-color: var(--border);
  }

  .file-icon {
    font-size: 8px;
    font-weight: 700;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
    flex-shrink: 0;
    letter-spacing: 0.03em;
  }

  .file-pdf { background: rgba(239,68,68,0.1); color: #ef4444; }
  :global(.dark) .file-pdf { background: rgba(239,68,68,0.08); }
  .file-img { background: rgba(59,130,246,0.1); color: #3b82f6; }
  :global(.dark) .file-img { background: rgba(59,130,246,0.08); }
  .file-doc { background: rgba(16,185,129,0.1); color: #10b981; }
  :global(.dark) .file-doc { background: rgba(16,185,129,0.08); }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    flex: 1;
  }

  .file-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    font-size: 10px;
    color: var(--text-3);
  }

  .file-badge {
    font-size: 9px;
    padding: 2px 7px;
    border-radius: 100px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .file-badge-done {
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.2);
    color: #10b981;
  }

  .file-badge-active {
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.2);
    color: #3b82f6;
    animation: badgePulse 2s ease-in-out infinite;
  }

  @keyframes badgePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .drop-zone {
    margin-top: 10px;
    padding: 10px;
    border: 1px dashed var(--border-strong);
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 10px;
    color: var(--text-3);
    transition: border-color 0.2s, background 0.2s;
  }

  .drop-zone:hover {
    border-color: rgba(16,185,129,0.3);
    background: rgba(16,185,129,0.03);
  }

  /* ── Tool panel ── */
  .tool-active {
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 10px;
  }

  :global(.dark) .tool-active {
    background: rgba(20,20,25,0.8);
  }

  .tool-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    gap: 8px;
  }

  .tool-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-1);
  }

  .tool-badge {
    font-size: 9px;
    padding: 2px 8px;
    border-radius: 100px;
    background: rgba(16,185,129,0.1);
    color: #10b981;
    font-weight: 500;
    border: 1px solid rgba(16,185,129,0.15);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    transition: opacity 0.3s ease;
  }

  .tool-progress {
    height: 3px;
    background: var(--border);
    border-radius: 100px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .tool-bar {
    height: 100%;
    border-radius: 100px;
    background: linear-gradient(90deg, var(--text-1), rgba(16,185,129,0.6));
    transition: width 0.15s ease-out;
  }

  :global(.dark) .tool-bar {
    background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(16,185,129,0.5));
  }

  .tool-meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-3);
  }

  .tool-savings {
    color: #10b981;
    font-weight: 500;
  }

  .tool-suggestion {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 9px;
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--text-2);
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
    cursor: default;
  }

  .tool-suggestion:hover {
    background: var(--raised);
    border-color: var(--border-strong);
    transform: translateX(3px);
  }

  .suggestion-arrow {
    color: var(--text-3);
    font-size: 10px;
    flex-shrink: 0;
  }

  .suggestion-tag {
    margin-left: auto;
    font-size: 9px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(16,185,129,0.08);
    color: #10b981;
    font-weight: 500;
  }

  /* ── Share panel ── */
  .share-method {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 9px;
    border-radius: 9px;
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--text-2);
    border: 1px solid transparent;
    cursor: default;
    transition: background 0.2s, transform 0.2s;
  }

  .share-method:hover {
    background: var(--raised);
    transform: translateX(2px);
  }

  .share-method-active {
    background: var(--raised);
    border-color: var(--border);
    color: var(--text-1);
    font-weight: 500;
  }

  .share-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    flex-shrink: 0;
  }

  .share-method-active .share-icon {
    background: var(--surface);
    color: var(--text-1);
  }

  .share-check {
    margin-left: auto;
    color: #10b981;
    font-size: 11px;
    font-weight: 600;
  }

  /* ── Room code reveal ── */
  .room-block {
    margin-top: 12px;
    padding: 10px 12px;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 9px;
  }

  :global(.dark) .room-block {
    background: rgba(16,16,20,0.8);
  }

  .room-label {
    display: block;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    font-weight: 600;
    margin-bottom: 4px;
  }

  .room-code {
    display: flex;
    gap: 4px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  .room-char {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-3);
    transition: color 0.3s ease, text-shadow 0.3s ease;
    min-width: 18px;
    text-align: center;
  }

  .room-char.revealed {
    color: var(--text-1);
  }

  :global(.dark) .room-char.revealed {
    text-shadow: 0 0 12px rgba(255,255,255,0.1);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .hero-section { padding: 120px 16px 64px; }

    .demo-body {
      grid-template-columns: 1fr;
    }

    .demo-col {
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .demo-col:last-child { border-bottom: none; }

    .chrome-pill { display: none; }
  }
</style>
