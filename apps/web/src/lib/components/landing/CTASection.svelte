<script lang="ts">
  import { onMount } from 'svelte'

  let sectionEl: HTMLElement
  let visible = false

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.15 }
    )
    if (sectionEl) obs.observe(sectionEl)
    return () => obs.disconnect()
  })
</script>

<section class="cta-section section-sm" bind:this={sectionEl}>
  <div class="container">
    <div class="cta-inner reveal" class:is-visible={visible}>

      <!-- Decoration -->
      <div class="cta-deco" aria-hidden="true">
        <div class="deco-ring deco-ring-1" />
        <div class="deco-ring deco-ring-2" />
        <div class="deco-dot deco-dot-1" />
        <div class="deco-dot deco-dot-2" />
      </div>

      <div class="cta-content">
        <div class="cta-kicker section-label">
          <span class="section-label-dot" />
          Get started
        </div>
        <h2 class="cta-title">
          Your files.<br/>
          <span class="cta-title-accent">Your move.</span>
        </h2>
        <p class="cta-sub">
          No signup. No install. Open the workspace and start moving files
          in seconds. Everything runs in your browser.
        </p>

        <div class="cta-actions">
          <a href="/workspace" class="btn-accent cta-btn">
            Open workspace
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <a href="/getting-started" class="btn-secondary cta-btn">
            See the guide
          </a>
        </div>

        <div class="cta-checks">
          <div class="cta-check">
            <span class="check-mark">✓</span>
            No account needed
          </div>
          <div class="cta-check">
            <span class="check-mark">✓</span>
            Works in any modern browser
          </div>
          <div class="cta-check">
            <span class="check-mark">✓</span>
            Free to use
          </div>
        </div>
      </div>

      <div class="cta-receive">
        <div class="receive-card">
          <div class="receive-header">
            <span class="font-mono text-2xs uppercase tracking-widest text-text-3">Receive files</span>
            <div class="receive-status">
              <span class="receive-dot" />
              <span class="font-mono text-2xs text-green">Ready</span>
            </div>
          </div>
          <div class="receive-code-wrap">
            <div class="receive-code">A7·M2·QX</div>
          </div>
          <p class="receive-hint">Enter a room code to receive files from any sender</p>
          <a href="/receive" class="btn-secondary receive-btn">Enter room code →</a>
        </div>
      </div>

    </div>
  </div>
</section>

<style>
  .cta-section { background: var(--surface-2); border-top: 2px solid var(--border-hard); }

  .cta-inner {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 48px;
    align-items: center;
    position: relative;
    padding: 56px 48px;
    border: 2px solid var(--border-hard);
    border-radius: 24px;
    background: var(--surface);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .cta-inner { grid-template-columns: 1fr; padding: 36px 28px; }
  }

  /* ── DECORATION ──────────────────────────────────── */
  .cta-deco {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .deco-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid var(--border);
  }

  .deco-ring-1 {
    width: 400px; height: 400px;
    top: -200px; right: -100px;
    border-color: var(--accent-border);
  }

  .deco-ring-2 {
    width: 240px; height: 240px;
    bottom: -120px; left: -60px;
    border-color: var(--border);
  }

  .deco-dot {
    position: absolute;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #000;
  }

  .deco-dot-1 { width: 16px; height: 16px; top: 40px; right: 160px; }
  .deco-dot-2 { width: 10px; height: 10px; bottom: 60px; left: 80px; opacity: 0.5; }

  /* ── CONTENT ─────────────────────────────────────── */
  .cta-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .cta-kicker { margin-bottom: -6px; }

  .cta-title {
    font-family: var(--font-display);
    font-size: clamp(2.4rem, 5vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.96;
    color: var(--text-1);
  }

  .cta-title-accent {
    color: var(--accent-text);
    -webkit-text-stroke: 2px var(--text-1);
    paint-order: stroke fill;
  }

  :global(:not(.dark)) .cta-title-accent { -webkit-text-stroke: 2px #000; }

  .cta-sub {
    font-size: 16px;
    line-height: 1.7;
    color: var(--text-2);
    max-width: 42ch;
  }

  .cta-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .cta-btn { font-size: 15px; padding: 14px 24px; }

  .cta-checks {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  .cta-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .check-mark {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--accent);
    color: #000;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 900;
    border: 1px solid #000;
    flex-shrink: 0;
  }

  /* ── RECEIVE CARD ────────────────────────────────── */
  .cta-receive {
    position: relative;
    z-index: 1;
  }

  .receive-card {
    padding: 28px 24px;
    border: 2px solid var(--border-hard);
    border-radius: 18px;
    background: var(--surface-2);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .receive-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .receive-status {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .receive-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .receive-code-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border: 2px solid var(--border-hard);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .receive-code {
    font-family: var(--font-mono);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--text-1);
    text-transform: uppercase;
  }

  .receive-hint {
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
  }

  .receive-btn {
    font-size: 13px;
    width: 100%;
    justify-content: center;
  }
</style>
