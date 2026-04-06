<script lang="ts">
  import Footer from '$components/landing/Footer.svelte'

  const steps = [
    {
      num: '1',
      title: 'Open the workspace',
      body: 'Go to clex.in/workspace (or click "Open workspace" in the nav). No signup, no install — the workspace loads in your browser and is ready immediately.',
      tip: 'Works in Chrome, Firefox, Edge, and Safari. For P2P transfer, both sender and receiver need a modern browser.',
      action: { label: 'Open workspace', href: '/workspace' },
    },
    {
      num: '2',
      title: 'Drop your files',
      body: 'Drag any files onto the workspace, or click the drop zone to browse your device. Clex reads each file type and prepares the tool panel automatically.',
      tip: 'You can drop multiple files at once. Images, PDFs, DOCX, and any other file type are all supported.',
      action: null,
    },
    {
      num: '3',
      title: 'Prepare (optional)',
      body: 'Use the tool panel to compress images, merge or split PDFs, convert DOCX to PDF, or bundle files into a ZIP. All processing runs in your browser.',
      tip: 'You can chain tools. After compressing an image, Clex will suggest converting or sharing it next.',
      action: { label: 'See all tools', href: '/features' },
    },
    {
      num: '4',
      title: 'Choose a transfer method',
      body: 'Click "Share" to open the transfer panel. Three routes are available: Direct P2P (fastest), Local Network (same Wi-Fi), and Google Drive (cloud fallback).',
      tip: 'For P2P transfer, the receiver needs to open Clex in their browser and enter the room code.',
      action: { label: 'See transfer routes', href: '/how-it-works' },
    },
    {
      num: '5',
      title: 'Send — and receive',
      body: 'Share the room code or QR code with your receiver. They go to clex.in/receive, enter the code, and the transfer begins automatically.',
      tip: 'The receiver can also scan the QR code with their phone camera — no typing needed.',
      action: { label: 'Receive files', href: '/receive' },
    },
  ]

  const quickTips = [
    { icon: '⟷', title: 'P2P vs Drive', body: 'Use P2P when sender and receiver are both online simultaneously. Use Drive when you need to share a link that someone can download later.' },
    { icon: '⊡', title: 'Same Wi-Fi speed', body: "If you're on the same local network, transfers happen at LAN speed. Great for large files between two devices on your desk." },
    { icon: '⬡', title: 'No signup needed for P2P', body: 'Direct transfer requires no account. Google Drive transfer requires a Google account (yours, not the receiver\'s).' },
    { icon: '◎', title: 'Offline tools', body: 'Image compression, PDF operations, and DOCX conversion all work offline after the first page load.' },
    { icon: '⊕', title: 'Tool chaining', body: 'After any tool operation, Clex suggests the next step. Compress → Convert → Share without re-dropping files.' },
    { icon: '↑', title: 'Drive fallback', body: 'When P2P isn\'t possible (different networks, delayed delivery), connect Google Drive and share a secure link from your own storage.' },
  ]
</script>

<svelte:head>
  <title>Getting started — Clex</title>
  <meta name="description" content="How to use Clex: open the workspace, drop files, prepare them with built-in tools, and share via direct P2P, local network, or Google Drive." />
</svelte:head>

<!-- Hero -->
<section class="page-hero section">
  <div class="container">
    <div class="section-label enter-1"><span class="section-label-dot" />Getting started</div>
    <h1 class="page-title enter-2">Your first Clex session.</h1>
    <p class="page-sub enter-3">
      From zero to shared file in under two minutes.
      No account, no install — just a browser and this guide.
    </p>
  </div>
</section>

<!-- Step-by-step -->
<section class="steps-section section">
  <div class="container">
    <div class="steps-list">
      {#each steps as step, i}
        <div class="guide-step">
          <div class="step-badge">
            <span class="step-badge-inner font-mono">{step.num}</span>
          </div>

          <div class="step-body-wrap">
            <h2 class="step-title">{step.title}</h2>
            <p class="step-body">{step.body}</p>

            <div class="step-tip">
              <span class="tip-icon">💡</span>
              <p class="tip-text">{step.tip}</p>
            </div>

            {#if step.action}
              <a href={step.action.href} class="btn-secondary step-btn">{step.action.label} →</a>
            {/if}
          </div>

          {#if i < steps.length - 1}
            <div class="step-line" />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Quick tips grid -->
<section class="tips-section section">
  <div class="container">
    <div class="tips-header">
      <h2 class="tips-title">Quick tips</h2>
      <p class="tips-sub">Things that make Clex faster and easier to use.</p>
    </div>

    <div class="tips-grid">
      {#each quickTips as tip}
        <div class="tip-card">
          <div class="tip-icon-wrap">{tip.icon}</div>
          <h3 class="tip-title">{tip.title}</h3>
          <p class="tip-body">{tip.body}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- FAQ shortcut -->
<section class="faq-shortcut section-sm">
  <div class="container">
    <div class="faq-card">
      <div class="faq-left">
        <h2 class="faq-title">Still have questions?</h2>
        <p class="faq-body">The FAQ covers common questions about privacy, transfer speed, browser support, Google Drive setup, and more.</p>
      </div>
      <div class="faq-actions">
        <a href="/faq" class="btn-accent">Read the FAQ</a>
        <a href="/workspace" class="btn-secondary">Try it now</a>
      </div>
    </div>
  </div>
</section>

<Footer />

<style>
  .page-hero { padding-top: 140px; border-bottom: 2px solid var(--border-hard); }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(3rem, 7vw, 5.5rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 0.95;
    color: var(--text-1);
    margin: 12px 0 16px;
  }

  .page-sub { font-size: 18px; line-height: 1.7; color: var(--text-2); max-width: 52ch; }

  /* ── STEPS ───────────────────────────────────────── */
  .steps-list { display: flex; flex-direction: column; gap: 0; max-width: 800px; }

  .guide-step {
    display: grid;
    grid-template-columns: 56px 1fr;
    gap: 28px;
    position: relative;
  }

  .step-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
  }

  .step-badge-inner {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    background: var(--accent);
    color: #000;
    box-shadow: var(--shadow-sm);
    display: grid;
    place-items: center;
    font-size: 18px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .step-line {
    position: absolute;
    left: 26px;
    top: 52px;
    width: 2px;
    height: calc(100% - 20px);
    background: var(--border);
  }

  .step-body-wrap {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 48px;
  }

  .guide-step:last-child .step-body-wrap { padding-bottom: 0; }

  .step-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-1);
  }

  .step-body { font-size: 15px; line-height: 1.72; color: var(--text-2); }

  .step-tip {
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border: 1.5px solid var(--accent-border);
    border-radius: 10px;
    background: var(--accent-dim);
  }

  .tip-icon { font-size: 16px; flex-shrink: 0; }

  .tip-text { font-size: 13px; line-height: 1.6; color: var(--text-2); }

  .step-btn { font-size: 13px; width: fit-content; }

  /* ── QUICK TIPS ──────────────────────────────────── */
  .tips-header { margin-bottom: 36px; }

  .tips-title {
    font-family: var(--font-display);
    font-size: clamp(1.8rem, 3.5vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin-bottom: 10px;
  }

  .tips-sub { font-size: 16px; color: var(--text-2); }

  .tips-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  @media (max-width: 900px) { .tips-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 560px) { .tips-grid { grid-template-columns: 1fr; } }

  .tip-card {
    padding: 24px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .tip-card:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-lg); }

  .tip-icon-wrap { font-size: 28px; }

  .tip-title { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }

  .tip-body { font-size: 13px; line-height: 1.65; color: var(--text-2); }

  /* ── FAQ SHORTCUT ────────────────────────────────── */
  .faq-shortcut { border-top: 2px solid var(--border-hard); }

  .faq-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 32px;
    padding: 36px 40px;
    border: 2px solid var(--border-hard);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-xl);
    flex-wrap: wrap;
  }

  .faq-title { font-family: var(--font-display); font-size: clamp(1.3rem, 2.5vw, 2rem); font-weight: 700; letter-spacing: -0.03em; color: var(--text-1); margin-bottom: 10px; }

  .faq-body { font-size: 14px; line-height: 1.65; color: var(--text-2); max-width: 52ch; }

  .faq-actions { display: flex; gap: 12px; flex-shrink: 0; flex-wrap: wrap; }
</style>
