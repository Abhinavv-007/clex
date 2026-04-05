<script lang="ts">
  import { onMount } from 'svelte'

  let sectionEl: HTMLElement
  let visible = false
  let cardEls: HTMLElement[] = []
  let cardVisible = [false, false, false]

  onMount(() => {
    const sectionObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; sectionObs.disconnect() } },
      { threshold: 0.12 }
    )
    sectionObs.observe(sectionEl)

    cardEls.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setTimeout(() => { cardVisible[i] = true; cardVisible = cardVisible }, i * 120)
            obs.disconnect()
          }
        },
        { threshold: 0.15 }
      )
      obs.observe(el)
    })
  })
</script>

<section class="methods-section" bind:this={sectionEl}>
  <div class="methods-inner">

    <div class="methods-header" class:header-visible={visible}>
      <p class="methods-eyebrow">Transfer methods</p>
      <h2 class="methods-headline">
        <span class="mh-word">Smart</span>
        <span class="mh-word">routing,</span>
        <span class="mh-word mh-muted">your</span>
        <span class="mh-word mh-muted">choice.</span>
      </h2>
      <p class="methods-sub">Clex automatically picks the best method. You always stay in control.</p>
    </div>

    <div class="methods-grid">

      <!-- P2P -->
      <div
        class="method-card method-primary"
        class:card-visible={cardVisible[0]}
        bind:this={cardEls[0]}
      >
        <div class="method-top">
          <div class="method-priority">
            <span class="priority-dot priority-green" />
            Primary
          </div>
          <div class="method-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="4.5" cy="9" r="2" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="13.5" cy="4.5" r="2" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="13.5" cy="13.5" r="2" stroke="currentColor" stroke-width="1.4"/>
              <path d="M6.5 8.1L11.5 5.4M6.5 9.9L11.5 12.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h3 class="method-name">Direct Transfer</h3>
        <p class="method-desc">Pure P2P using WebRTC DataChannel. Files go directly between browsers — zero servers in the transfer path.</p>
        <ul class="method-features">
          <li>No server relay</li>
          <li>No file storage anywhere</li>
          <li>Works across networks</li>
          <li>Any file size</li>
        </ul>
      </div>

      <!-- Local -->
      <div
        class="method-card"
        class:card-visible={cardVisible[1]}
        bind:this={cardEls[1]}
      >
        <div class="method-top">
          <div class="method-priority">
            <span class="priority-dot priority-blue" />
            Fast Track
          </div>
          <div class="method-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 13a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
              <path d="M5.5 10.5a5 5 0 017 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M2.5 7.5a9 9 0 0113 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h3 class="method-name">Local Network</h3>
        <p class="method-desc">Same Wi-Fi? Detected automatically. Transfer at full local speeds with no cloud overhead.</p>
        <ul class="method-features">
          <li>Automatic detection</li>
          <li>Maximum speeds</li>
          <li>No setup needed</li>
          <li>Private by nature</li>
        </ul>
      </div>

      <!-- Drive -->
      <div
        class="method-card"
        class:card-visible={cardVisible[2]}
        bind:this={cardEls[2]}
      >
        <div class="method-top">
          <div class="method-priority">
            <span class="priority-dot priority-amber" />
            Cloud Fallback
          </div>
          <div class="method-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 12V5M6 8l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 14h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h3 class="method-name">Google Drive</h3>
        <p class="method-desc">Upload to your own Drive and generate a shareable link. Secure fallback when direct transfer isn't possible.</p>
        <ul class="method-features">
          <li>Your own Drive account</li>
          <li>Shareable link output</li>
          <li>drive.file scope only</li>
          <li>OAuth 2.0 secure</li>
        </ul>
      </div>
    </div>

    <!-- CTA -->
    <div class="methods-cta" class:cta-visible={cardVisible[2]}>
      <a href="/workspace" class="methods-cta-btn">
        <span>Start sending files</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="cta-btn-shine" />
      </a>
      <p class="methods-cta-note">Free to use · No account required for P2P</p>
    </div>

  </div>
</section>

<style>
  .methods-section {
    padding: 120px 24px;
    border-top: 1px solid var(--border);
  }

  .methods-inner {
    max-width: 920px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .methods-header {
    text-align: center;
    margin-bottom: 60px;
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
  }

  .methods-header.header-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .methods-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-3);
    margin-bottom: 16px;
  }

  .methods-headline {
    font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
    font-size: clamp(2.2rem, 5.5vw, 3.8rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    margin-bottom: 16px;
    line-height: 1.08;
  }

  .mh-word {
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

  :global(:not(.dark)) .mh-word {
    background: linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,1) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .mh-muted { opacity: 0.5; }

  .methods-sub {
    font-size: 15px;
    color: var(--text-2);
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.65;
  }

  /* ── Grid ── */
  .methods-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .method-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 26px;
    /* Scroll reveal + hover */
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 0.6s cubic-bezier(0.16,1,0.3,1),
      transform 0.6s cubic-bezier(0.16,1,0.3,1),
      border-color 0.25s ease,
      box-shadow 0.25s ease;
  }

  .method-card.card-visible {
    opacity: 1;
    transform: translateY(0);
  }

  :global(.dark) .method-card {
    background: rgba(14,14,18,0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .method-card:hover {
    border-color: var(--border-strong);
    box-shadow: 0 6px 28px rgba(0,0,0,0.08);
    transform: translateY(-3px);
  }

  .method-card.card-visible:hover {
    transform: translateY(-3px);
  }

  :global(.dark) .method-card:hover {
    box-shadow: 0 6px 32px rgba(0,0,0,0.35);
  }

  .method-primary {
    background: var(--raised);
  }

  :global(.dark) .method-primary {
    background: rgba(18,18,22,0.7);
  }

  .method-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }

  .method-priority {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .priority-green { background: #10b981; box-shadow: 0 0 6px rgba(16,185,129,0.4); }
  .priority-blue { background: #3b82f6; box-shadow: 0 0 6px rgba(59,130,246,0.3); }
  .priority-amber { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.3); }

  .method-icon-wrap {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    transition: border-color 0.2s;
  }

  .method-card:hover .method-icon-wrap {
    border-color: var(--border-strong);
  }

  .method-primary .method-icon-wrap {
    background: var(--surface);
  }

  .method-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }

  .method-desc {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.7;
    margin-bottom: 20px;
  }

  .method-features {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .method-features li {
    font-size: 12px;
    color: var(--text-2);
    display: flex;
    align-items: center;
    gap: 8px;
    transition: color 0.2s;
  }

  .method-card:hover .method-features li {
    color: var(--text-1);
  }

  .method-features li::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--border-strong);
    flex-shrink: 0;
    transition: background 0.2s;
  }

  .method-card:hover .method-features li::before {
    background: rgba(16,185,129,0.4);
  }

  /* ── CTA ── */
  .methods-cta {
    text-align: center;
    margin-top: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s;
  }

  .methods-cta.cta-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .methods-cta-btn {
    position: relative;
    padding: 14px 32px;
    font-size: 15px;
    border-radius: 12px;
    gap: 10px;
    display: inline-flex;
    align-items: center;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    font-weight: 500;
    text-decoration: none;
    overflow: hidden;
    transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease;
  }

  .methods-cta-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  }

  .methods-cta-btn:active {
    transform: translateY(0) scale(0.98);
  }

  .cta-btn-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 60%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
    animation: ctaShine 4s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes ctaShine {
    0%, 80%, 100% { left: -100%; }
    40% { left: 120%; }
  }

  .methods-cta-note {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 680px) {
    .methods-grid { grid-template-columns: 1fr; }
  }
</style>
