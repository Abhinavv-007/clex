<script lang="ts">
  import { onMount } from 'svelte'

  let sectionEl: HTMLElement
  let visible = false
  let stepsVisible = [false, false, false]
  let stepEls: HTMLElement[] = []

  onMount(() => {
    const sectionObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; sectionObs.disconnect() } },
      { threshold: 0.12 }
    )
    sectionObs.observe(sectionEl)

    stepEls.forEach((el, i) => {
      if (!el) return
      const obs = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            setTimeout(() => { stepsVisible[i] = true; stepsVisible = stepsVisible }, i * 150)
            obs.disconnect()
          }
        },
        { threshold: 0.2 }
      )
      obs.observe(el)
    })
  })
</script>

<section id="how-it-works" class="hiw-section" bind:this={sectionEl}>
  <div class="hiw-inner">

    <div class="hiw-header" class:header-visible={visible}>
      <p class="hiw-eyebrow">How it works</p>
      <h2 class="hiw-headline">
        <span class="hiw-word">Three</span>
        <span class="hiw-word hiw-muted">steps.</span>
      </h2>
    </div>

    <div class="hiw-steps">
      <!-- Connecting line -->
      <div class="hiw-connector" aria-hidden="true">
        <div class="connector-fill" class:connector-active={stepsVisible[2]} />
      </div>

      <!-- Step 1 -->
      <div
        class="hiw-step"
        class:step-visible={stepsVisible[0]}
        bind:this={stepEls[0]}
      >
        <div class="step-number">01</div>
        <div class="step-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v8M7 8l3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 14h12a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1a1 1 0 011-1z" stroke="currentColor" stroke-width="1.4"/>
          </svg>
        </div>
        <h3 class="step-title">Drop your files</h3>
        <p class="step-desc">Drag files onto the workspace. Images, PDFs, Word docs — multiple files at once.</p>
      </div>

      <!-- Step 2 -->
      <div
        class="hiw-step"
        class:step-visible={stepsVisible[1]}
        bind:this={stepEls[1]}
      >
        <div class="step-number">02</div>
        <div class="step-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 7v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="step-title">Prepare them</h3>
        <p class="step-desc">Compress, convert, merge, or split. Clex guides you to the right tool and suggests the next step automatically.</p>
      </div>

      <!-- Step 3 -->
      <div
        class="hiw-step"
        class:step-visible={stepsVisible[2]}
        bind:this={stepEls[2]}
      >
        <div class="step-number">03</div>
        <div class="step-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17 10H3M13 6l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="step-title">Share your way</h3>
        <p class="step-desc">Send P2P, over local network, or upload to Drive. Clex picks the best method, or you choose.</p>
      </div>
    </div>

    <!-- Trust row -->
    <div class="hiw-trust" class:trust-visible={stepsVisible[2]}>
      <span class="trust-item">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1.5l1.2 3.7h3.8l-3.1 2.3 1.2 3.7-3.1-2.3-3.1 2.3 1.2-3.7-3.1-2.3h3.8z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
        </svg>
        Files never stored on our servers
      </span>
      <span class="trust-dot" />
      <span class="trust-item">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="2" y="5.5" width="9" height="6" rx="1.2" stroke="currentColor" stroke-width="1.1"/>
          <path d="M4 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
        </svg>
        End-to-end P2P encryption
      </span>
      <span class="trust-dot" />
      <span class="trust-item">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.1"/>
          <path d="M4.5 6.5l1.5 1.5 2.5-2.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Works offline after load
      </span>
    </div>

  </div>
</section>

<style>
  .hiw-section {
    padding: 120px 24px;
    border-top: 1px solid var(--border);
  }

  .hiw-inner {
    max-width: 900px;
    margin: 0 auto;
  }

  /* ── Header ── */
  .hiw-header {
    text-align: center;
    margin-bottom: 80px;
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1);
  }

  .hiw-header.header-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hiw-eyebrow {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-3);
    margin-bottom: 16px;
  }

  .hiw-headline {
    font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
    font-size: clamp(2.6rem, 5.5vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.04em;
  }

  .hiw-word {
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

  :global(:not(.dark)) .hiw-word {
    background: linear-gradient(180deg, rgba(10,10,10,0.6) 0%, rgba(10,10,10,1) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hiw-muted { opacity: 0.5; }

  /* ── Steps ── */
  .hiw-steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 40px;
    position: relative;
  }

  .hiw-connector {
    display: none;
    position: absolute;
    top: 56px;
    left: calc(16.67% + 24px);
    right: calc(16.67% + 24px);
    height: 1px;
    background: var(--border);
    z-index: 0;
    overflow: hidden;
  }

  .connector-fill {
    width: 0%;
    height: 100%;
    background: var(--text-3);
    transition: width 1.2s cubic-bezier(0.16,1,0.3,1);
  }

  .connector-fill.connector-active {
    width: 100%;
  }

  @media (min-width: 640px) {
    .hiw-connector { display: block; }
  }

  .hiw-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    z-index: 1;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1);
  }

  .hiw-step.step-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .step-number {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--text-3);
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .step-icon-wrap {
    width: 54px;
    height: 54px;
    border-radius: 15px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    margin-bottom: 22px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
  }

  :global(.dark) .step-icon-wrap {
    background: rgba(18,18,22,0.8);
    box-shadow: 0 2px 16px rgba(0,0,0,0.3);
  }

  .hiw-step:hover .step-icon-wrap {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.1);
    border-color: rgba(16,185,129,0.2);
  }

  :global(.dark) .hiw-step:hover .step-icon-wrap {
    box-shadow: 0 6px 24px rgba(0,0,0,0.4);
  }

  .step-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
    margin-bottom: 10px;
  }

  .step-desc {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.7;
    max-width: 240px;
    margin: 0 auto;
  }

  /* ── Trust row ── */
  .hiw-trust {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 72px;
    padding-top: 40px;
    border-top: 1px solid var(--border);
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s;
  }

  .hiw-trust.trust-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .trust-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-3);
  }

  .trust-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--border-strong);
    flex-shrink: 0;
  }

  @media (max-width: 600px) {
    .hiw-steps {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }
</style>
