<script lang="ts">
  import { onMount } from 'svelte'
  import { fly, fade } from 'svelte/transition'

  let visible = false
  onMount(() => { requestAnimationFrame(() => { visible = true }) })
</script>

<section class="hero-section">
  <!-- Top eyebrow -->
  {#if visible}
    <div in:fly={{ y: 12, duration: 500, delay: 80 }} class="hero-eyebrow">
      <span class="eyebrow-dot" />
      <span>File workspace · No storage · P2P transfer</span>
    </div>
  {/if}

  <!-- Headline -->
  {#if visible}
    <h1 in:fly={{ y: 20, duration: 600, delay: 180 }} class="hero-headline">
      Prepare files.<br/>Share instantly.
    </h1>
  {/if}

  <!-- Sub-copy -->
  {#if visible}
    <p in:fly={{ y: 16, duration: 500, delay: 300 }} class="hero-sub">
      One workspace to compress, convert, and transfer files — peer-to-peer,
      over local network, or via Google Drive. Everything runs in your browser.
    </p>
  {/if}

  <!-- CTAs -->
  {#if visible}
    <div in:fly={{ y: 12, duration: 500, delay: 420 }} class="hero-ctas">
      <a href="/workspace" class="btn-primary hero-btn-primary">
        Open workspace
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
      <a href="/#how-it-works" class="btn-secondary hero-btn-secondary">
        See how it works
      </a>
    </div>
  {/if}

  <!-- Product UI preview card -->
  {#if visible}
    <div in:fade={{ duration: 700, delay: 560 }} class="hero-preview-wrap">
      <div class="hero-preview-card">
        <!-- Window chrome -->
        <div class="preview-chrome">
          <div class="chrome-dots">
            <span class="chrome-dot" />
            <span class="chrome-dot" />
            <span class="chrome-dot" />
          </div>
          <span class="chrome-title">clex — workspace</span>
          <div style="width:44px" />
        </div>

        <!-- Workspace mockup -->
        <div class="preview-body">
          <!-- Left: file list -->
          <div class="preview-col preview-files">
            <div class="preview-col-label">Files</div>
            <div class="preview-file-item preview-file-active">
              <div class="pfi-icon pdf">PDF</div>
              <div class="pfi-info">
                <span class="pfi-name">report.pdf</span>
                <span class="pfi-size">2.4 MB</span>
              </div>
            </div>
            <div class="preview-file-item">
              <div class="pfi-icon img">IMG</div>
              <div class="pfi-info">
                <span class="pfi-name">photo.jpg</span>
                <span class="pfi-size">4.1 MB</span>
              </div>
            </div>
            <div class="preview-file-item">
              <div class="pfi-icon doc">DOC</div>
              <div class="pfi-info">
                <span class="pfi-name">brief.docx</span>
                <span class="pfi-size">0.8 MB</span>
              </div>
            </div>
            <div class="preview-drop-area">
              <span>Drop more files</span>
            </div>
          </div>

          <!-- Center: tool area -->
          <div class="preview-col preview-tools">
            <div class="preview-col-label">Tools</div>
            <div class="preview-tool-active">
              <div class="pta-header">
                <span class="pta-name">Compress images</span>
                <span class="badge-preview">Running</span>
              </div>
              <div class="pta-progress">
                <div class="pta-bar" style="width:72%" />
              </div>
              <span class="pta-status">Compressing photo.jpg…</span>
            </div>
            <div class="preview-suggestion">
              <span class="sug-label">Next →</span>
              <span>Convert to WebP</span>
            </div>
            <div class="preview-suggestion">
              <span class="sug-label">Next →</span>
              <span>Share files</span>
            </div>
          </div>

          <!-- Right: share panel -->
          <div class="preview-col preview-share">
            <div class="preview-col-label">Share</div>
            <div class="preview-method preview-method-active">
              <div class="pm-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="3" cy="6" r="1.5" fill="currentColor"/>
                  <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
                  <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
                  <path d="M4.5 5.1L7.5 3.9M4.5 6.9L7.5 8.1" stroke="currentColor" stroke-width="1"/>
                </svg>
              </div>
              <span>Direct P2P</span>
            </div>
            <div class="preview-method">
              <div class="pm-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="4" width="10" height="6" rx="1.5" stroke="currentColor" stroke-width="1"/>
                  <path d="M4 4V3a2 2 0 014 0v1" stroke="currentColor" stroke-width="1"/>
                </svg>
              </div>
              <span>Local network</span>
            </div>
            <div class="preview-method">
              <div class="pm-icon">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 8V2M3 5l3-3 3 3" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                  <path d="M1 10h10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                </svg>
              </div>
              <span>Google Drive</span>
            </div>
            <div class="preview-code-block">
              <span class="pcb-label">Room code</span>
              <span class="pcb-code">XK7F2P</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Glow behind card (dark only) -->
      <div class="preview-glow" aria-hidden="true" />
    </div>
  {/if}
</section>

<style>
  .hero-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 140px 24px 80px;
    max-width: 1100px;
    margin: 0 auto;
  }

  /* Eyebrow */
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.03em;
    color: var(--text-3);
    padding: 5px 14px;
    border: 1px solid var(--border);
    border-radius: 100px;
    background: var(--raised);
    margin-bottom: 32px;
    text-transform: uppercase;
  }

  .eyebrow-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 6px rgba(34,197,94,0.5);
    flex-shrink: 0;
  }

  /* Headline */
  .hero-headline {
    font-size: clamp(2.8rem, 7vw, 6rem);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: var(--text-1);
    margin-bottom: 24px;
    max-width: 760px;
  }

  /* Sub */
  .hero-sub {
    font-size: 17px;
    color: var(--text-2);
    line-height: 1.7;
    max-width: 520px;
    margin-bottom: 40px;
  }

  /* CTAs */
  .hero-ctas {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 72px;
  }

  .hero-btn-primary {
    padding: 11px 24px;
    font-size: 14px;
    border-radius: 10px;
    gap: 8px;
    display: inline-flex;
    align-items: center;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    font-weight: 500;
    transition: opacity 0.15s;
    text-decoration: none;
  }

  .hero-btn-primary:hover { opacity: 0.85; }

  .hero-btn-secondary {
    padding: 11px 24px;
    font-size: 14px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--border-strong);
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
    text-decoration: none;
  }

  .hero-btn-secondary:hover {
    background: var(--raised);
    color: var(--text-1);
  }

  /* Preview card wrap */
  .hero-preview-wrap {
    position: relative;
    width: 100%;
    max-width: 900px;
  }

  .preview-glow {
    display: none;
    position: absolute;
    inset: -40px;
    border-radius: 24px;
    background: radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  :global(.dark) .preview-glow { display: block; }

  .hero-preview-card {
    position: relative;
    z-index: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  }

  :global(.dark) .hero-preview-card {
    box-shadow: 0 8px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
  }

  /* Chrome bar */
  .preview-chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--raised);
    border-bottom: 1px solid var(--border);
  }

  .chrome-dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .chrome-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border-strong);
  }

  .chrome-title {
    font-size: 12px;
    color: var(--text-3);
    font-weight: 400;
    letter-spacing: 0.01em;
  }

  /* Body 3-col */
  .preview-body {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1fr;
  }

  .preview-col {
    padding: 14px;
    border-right: 1px solid var(--border);
  }

  .preview-col:last-child { border-right: none; }

  .preview-col-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    margin-bottom: 10px;
  }

  /* File items */
  .preview-file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 8px;
    margin-bottom: 4px;
    cursor: default;
    transition: background 0.15s;
  }

  .preview-file-item:hover { background: var(--raised); }

  .preview-file-active {
    background: var(--raised);
    border: 1px solid var(--border);
  }

  .pfi-icon {
    font-size: 9px;
    font-weight: 700;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  .pfi-icon.pdf { background: rgba(239,68,68,0.1); color: #ef4444; }
  .pfi-icon.img { background: rgba(59,130,246,0.1); color: #3b82f6; }
  .pfi-icon.doc { background: rgba(34,197,94,0.1); color: #22c55e; }

  .pfi-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .pfi-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pfi-size {
    font-size: 10px;
    color: var(--text-3);
  }

  .preview-drop-area {
    margin-top: 8px;
    padding: 8px;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--text-3);
  }

  /* Tool area */
  .preview-tool-active {
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    margin-bottom: 8px;
  }

  .pta-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .pta-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-1);
  }

  .badge-preview {
    font-size: 9px;
    padding: 2px 7px;
    border-radius: 100px;
    background: rgba(34,197,94,0.12);
    color: #22c55e;
    font-weight: 600;
    border: 1px solid rgba(34,197,94,0.2);
  }

  .pta-progress {
    height: 3px;
    background: var(--border);
    border-radius: 100px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .pta-bar {
    height: 100%;
    background: var(--text-1);
    border-radius: 100px;
    animation: growBar 2s ease-in-out infinite alternate;
  }

  @keyframes growBar {
    from { width: 55%; }
    to { width: 85%; }
  }

  .pta-status {
    font-size: 10px;
    color: var(--text-3);
  }

  .preview-suggestion {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--text-2);
  }

  .sug-label {
    font-size: 9px;
    color: var(--text-3);
    font-weight: 600;
    flex-shrink: 0;
  }

  /* Share panel */
  .preview-method {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    border-radius: 8px;
    margin-bottom: 4px;
    font-size: 11px;
    color: var(--text-2);
    border: 1px solid transparent;
    cursor: default;
  }

  .preview-method-active {
    background: var(--raised);
    border-color: var(--border);
    color: var(--text-1);
    font-weight: 500;
  }

  .pm-icon {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--raised);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    flex-shrink: 0;
  }

  .preview-method-active .pm-icon {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-1);
  }

  .preview-code-block {
    margin-top: 10px;
    padding: 8px 10px;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pcb-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
    font-weight: 600;
  }

  .pcb-code {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.25em;
    color: var(--text-1);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  @media (max-width: 640px) {
    .hero-section { padding: 110px 16px 64px; }

    .preview-body {
      grid-template-columns: 1fr;
    }

    .preview-col {
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .preview-col:last-child { border-bottom: none; }
  }
</style>
