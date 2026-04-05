<script lang="ts">
  import { onMount } from 'svelte'

  const steps = [
    {
      num: '01',
      title: 'Drop your files',
      body: 'Drag any files into the workspace. Clex instantly reads every file type, maps your queue, and surfaces the right tools — no form-filling, no upload wait.',
      detail: 'JPEG, PNG, WebP, PDF, DOCX, ZIP, and more — auto-classified the moment they land.',
      visual: 'drop',
    },
    {
      num: '02',
      title: 'Prepare them',
      body: 'Compress images, merge PDFs, convert DOCX to PDF, bundle into ZIP. Tools chain together so the output of one becomes the input of the next.',
      detail: 'Everything runs in your browser. Nothing is sent to a server during preparation.',
      visual: 'prepare',
    },
    {
      num: '03',
      title: 'Share anywhere',
      body: 'Clex picks the fastest route: direct browser-to-browser if possible, local network if you\'re nearby, or Google Drive as a secure fallback. One click.',
      detail: 'Room codes, QR codes, and direct links — receiver gets a clean pull experience.',
      visual: 'share',
    },
  ]

  let sectionEl: HTMLElement
  let visible = false
  let activeStep = 0

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.1 }
    )
    if (sectionEl) obs.observe(sectionEl)

    const stepTimer = setInterval(() => {
      activeStep = (activeStep + 1) % steps.length
    }, 3200)

    return () => { obs.disconnect(); clearInterval(stepTimer) }
  })
</script>

<section id="how-it-works" class="hiw section" bind:this={sectionEl}>
  <div class="container">

    <!-- Header -->
    <div class="hiw-header reveal" class:is-visible={visible}>
      <div class="section-label">
        <span class="section-label-dot" />
        Three steps
      </div>
      <h2 class="hiw-title">One flow. Zero tool-switching.</h2>
      <p class="hiw-sub">
        Clex is built around a single idea: drop files once, prepare them in place,
        send them in one motion. No tabs, no uploads, no handoffs.
      </p>
    </div>

    <!-- Steps grid -->
    <div class="steps-grid">
      {#each steps as step, i}
        <div
          class="step-card reveal"
          class:is-visible={visible}
          class:step-active={activeStep === i}
          on:mouseenter={() => activeStep = i}
          on:click={() => activeStep = i}
          style="transition-delay: {i * 100}ms"
          role="button"
          tabindex="0"
          on:keydown={(e) => e.key === 'Enter' && (activeStep = i)}
        >
          <div class="step-num">{step.num}</div>

          <div class="step-visual step-visual-{step.visual}" />

          <div class="step-content">
            <h3 class="step-title">{step.title}</h3>
            <p class="step-body">{step.body}</p>
            <p class="step-detail">{step.detail}</p>
          </div>

          <!-- Active indicator -->
          <div class="step-indicator" />
        </div>
      {/each}
    </div>

    <!-- Connector line (desktop only) -->
    <div class="steps-connector" aria-hidden="true">
      <div class="connector-line" />
      <div class="connector-fill" style="width: {((activeStep + 1) / steps.length) * 100}%" />
    </div>

    <!-- Big statement block -->
    <div class="statement-block reveal reveal-3" class:is-visible={visible}>
      <div class="statement-left">
        <p class="statement-quote">
          "The entire experience — prepare, route, deliver — stays inside one browser tab. That's the product."
        </p>
      </div>
      <div class="statement-right">
        <div class="statement-metric">
          <span class="metric-big">0</span>
          <span class="metric-unit">server uploads</span>
          <span class="metric-note">during P2P transfer</span>
        </div>
        <div class="statement-metric">
          <span class="metric-big">3</span>
          <span class="metric-unit">routing modes</span>
          <span class="metric-note">smart auto-detection</span>
        </div>
      </div>
    </div>

  </div>
</section>

<style>
  /* ── HEADER ─────────────────────────────────────── */
  .hiw-header { max-width: 640px; margin-bottom: 56px; }

  .hiw-title {
    font-family: var(--font-display);
    font-size: clamp(2.2rem, 4.5vw, 3.6rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
    color: var(--text-1);
    margin-bottom: 16px;
  }

  .hiw-sub {
    font-size: 17px;
    line-height: 1.7;
    color: var(--text-2);
    max-width: 52ch;
  }

  /* ── STEPS GRID ──────────────────────────────────── */
  .steps-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 0;
  }

  @media (max-width: 900px) {
    .steps-grid { grid-template-columns: 1fr; }
  }

  /* ── STEP CARD ───────────────────────────────────── */
  .step-card {
    position: relative;
    padding: 28px 24px 24px;
    border: 2px solid var(--border-hard);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow: hidden;
    transition:
      transform 200ms var(--ease-out),
      box-shadow 200ms var(--ease-out),
      background 200ms ease;
  }

  .step-card:hover,
  .step-card.step-active {
    transform: translate(-3px, -3px);
    box-shadow: var(--shadow-xl);
    background: var(--surface);
  }

  /* Step indicator bar at bottom */
  .step-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--border);
    transition: background 200ms ease;
  }

  .step-active .step-indicator { background: var(--accent); }

  /* ── STEP NUMBER ─────────────────────────────────── */
  .step-num {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .step-num::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── VISUAL BLOCKS ───────────────────────────────── */
  .step-visual {
    width: 100%;
    height: 140px;
    border-radius: 12px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    position: relative;
    overflow: hidden;
  }

  /* Drop visual — animated drop zone */
  .step-visual-drop::before {
    content: '⬇ Drop files here';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.06em;
    border: 2px dashed var(--border-strong);
    border-radius: 10px;
    margin: 12px;
    text-transform: uppercase;
  }

  .step-visual-drop::after {
    content: '';
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--accent);
    border: 2px solid #000;
    box-shadow: 2px 2px 0 #000;
    animation: float 3s ease-in-out infinite;
  }

  /* Prepare visual — tool chips */
  .step-visual-prepare {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
    align-content: flex-start;
  }

  .step-visual-prepare::before,
  .step-visual-prepare::after {
    content: '';
  }

  /* Share visual — beam line */
  .step-visual-share::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 16px;
    right: 16px;
    height: 2px;
    background: var(--border-strong);
    transform: translateY(-50%);
  }

  .step-visual-share::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 16px;
    width: 30%;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    transform: translateY(-50%);
    animation: beam-travel 2s ease-in-out infinite;
  }

  /* ── STEP CONTENT ────────────────────────────────── */
  .step-title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-1);
    margin-bottom: 10px;
  }

  .step-body {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-2);
    margin-bottom: 12px;
  }

  .step-detail {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-3);
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
  }

  /* ── CONNECTOR ───────────────────────────────────── */
  .steps-connector {
    position: relative;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 28px 0 56px;
    overflow: hidden;
  }

  .connector-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--accent);
    border-radius: 2px;
    transition: width 600ms var(--ease-out);
  }

  @media (max-width: 900px) {
    .steps-connector { display: none; }
    .steps-grid { margin-bottom: 40px; }
  }

  /* ── STATEMENT BLOCK ─────────────────────────────── */
  .statement-block {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 0;
    border: 2px solid var(--border-hard);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
    margin-top: 28px;
  }

  .statement-left {
    padding: 48px 40px;
    border-right: 2px solid var(--border);
    display: flex;
    align-items: center;
  }

  .statement-quote {
    font-family: var(--font-display);
    font-size: clamp(1.15rem, 2vw, 1.5rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.5;
    color: var(--text-1);
  }

  .statement-right {
    display: flex;
    flex-direction: column;
  }

  .statement-metric {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 32px;
    gap: 4px;
    text-align: center;
  }

  .statement-metric + .statement-metric {
    border-top: 2px solid var(--border);
  }

  .metric-big {
    font-family: var(--font-display);
    font-size: clamp(3rem, 5vw, 4.5rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1;
    color: var(--accent);
    -webkit-text-stroke: 2px var(--text-1);
    paint-order: stroke fill;
  }

  :global(:not(.dark)) .metric-big { -webkit-text-stroke: 2px #000; }

  .metric-unit {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .metric-note {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  @media (max-width: 760px) {
    .statement-block { grid-template-columns: 1fr; }
    .statement-left { border-right: none; border-bottom: 2px solid var(--border); padding: 32px 24px; }
    .statement-right { flex-direction: row; }
    .statement-metric + .statement-metric { border-top: none; border-left: 2px solid var(--border); }
  }
</style>
