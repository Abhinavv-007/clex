<script lang="ts">
  import { onMount } from 'svelte'

  const routeModes = [
    {
      label: 'Direct P2P',
      tag: 'Primary path',
      latency: '12 ms handoff',
      note: 'Encrypted browser-to-browser delivery with zero file relay.',
    },
    {
      label: 'Local Mesh',
      tag: 'Fast lane',
      latency: 'LAN throughput',
      note: 'Same-network devices stay on the shortest path for near-instant delivery.',
    },
    {
      label: 'Drive Fallback',
      tag: 'Cloud link',
      latency: '1-click backup',
      note: 'If a direct route is unavailable, switch to your own Drive without leaving the flow.',
    },
  ]

  const statusBursts = [
    'Classifying uploads',
    'Compressing image set',
    'Rendering share scene',
    'Negotiating direct route',
    'Delivery ready',
  ]

  const commandChips = ['Compress', 'Convert', 'Watermark', 'Merge PDF', 'Share']
  const roomCodeChars = 'A7M2QX'.split('')

  let mounted = false
  let routeIndex = 0
  let statusIndex = 0
  let progress = 18
  let roomReveal = 0

  onMount(() => {
    const raf = requestAnimationFrame(() => {
      mounted = true
    })

    const routeTimer = window.setInterval(() => {
      routeIndex = (routeIndex + 1) % routeModes.length
    }, 2800)

    const statusTimer = window.setInterval(() => {
      statusIndex = (statusIndex + 1) % statusBursts.length
    }, 1800)

    const progressTimer = window.setInterval(() => {
      progress = progress > 92 ? 24 : progress + 7
    }, 340)

    const roomTimer = window.setInterval(() => {
      roomReveal = roomReveal >= roomCodeChars.length ? 0 : roomReveal + 1
    }, 420)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(routeTimer)
      clearInterval(statusTimer)
      clearInterval(progressTimer)
      clearInterval(roomTimer)
    }
  })

  $: activeRoute = routeModes[routeIndex]
  $: activeStatus = statusBursts[statusIndex]
</script>

<section class="hero">
  <div class="hero-inner">
    <div class="hero-copy">
      <div class="hero-kicker" class:is-mounted={mounted}>
        <span class="kicker-dot" />
        File motion layer
      </div>

      <p class="hero-brand" class:is-mounted={mounted}>clex</p>

      <h1 class="hero-title" class:is-mounted={mounted}>
        The file workspace
        <span class="hero-title-accent">that moves like software.</span>
      </h1>

      <p class="hero-sub" class:is-mounted={mounted}>
        Prepare, route, and deliver files from one browser-native surface.
        Compression, transfer, fallback, and sharing all stay in the same
        motion system.
      </p>

      <div class="hero-actions" class:is-mounted={mounted}>
        <a href="/workspace" class="btn-primary hero-primary">Open workspace</a>
        <a href="#features" class="btn-secondary hero-secondary">See the product flow</a>
      </div>

      <div class="hero-proof" class:is-mounted={mounted}>
        <div class="proof-item">
          <span class="proof-label">Browser-native</span>
          <strong>Prepare files without uploads</strong>
        </div>
        <div class="proof-item">
          <span class="proof-label">Routing engine</span>
          <strong>Direct, local, or Drive in one surface</strong>
        </div>
        <div class="proof-item">
          <span class="proof-label">Private by design</span>
          <strong>No server storage in the transfer path</strong>
        </div>
      </div>
    </div>

    <div class="hero-stage" class:is-mounted={mounted}>
      <div class="stage-shell">
        <div class="stage-toolbar">
          <div class="toolbar-dots">
            <span />
            <span />
            <span />
          </div>
          <span class="toolbar-title">Clex orchestration layer</span>
          <span class="toolbar-chip">Live demo</span>
        </div>

        <div class="stage-layout">
          <aside class="stage-sidebar">
            <div class="sidebar-brand">
              <span class="sidebar-logo">C</span>
              <div>
                <p>clex</p>
                <span>Workspace OS</span>
              </div>
            </div>

            <div class="sidebar-nav">
              <div class="sidebar-link sidebar-link-active">Ingest</div>
              <div class="sidebar-link">Prepare</div>
              <div class="sidebar-link">Share</div>
            </div>

            <div class="sidebar-meter">
              <div class="meter-head">
                <span>Processing load</span>
                <strong>{progress}%</strong>
              </div>
              <div class="meter-track">
                <div class="meter-fill" style={`width: ${progress}%`} />
              </div>
            </div>

            <div class="sidebar-card">
              <span>Queue health</span>
              <strong>08 files ready</strong>
              <p>Classification, conversion, and delivery are chained automatically.</p>
            </div>
          </aside>

          <div class="stage-main">
            <div class="stage-header">
              <div>
                <span class="stage-label">Live activity</span>
                <strong>{activeStatus}</strong>
              </div>
              <div class="stage-pill">
                <span class="stage-pill-dot" />
                Syncing motion states
              </div>
            </div>

            <div class="stage-canvas">
              <div class="file-rail">
                <div class="file-row file-row-active">
                  <div class="file-icon">IMG</div>
                  <div>
                    <strong>hero-shot.jpg</strong>
                    <span>4.8 MB → 1.4 MB</span>
                  </div>
                  <em>-71%</em>
                </div>
                <div class="file-row">
                  <div class="file-icon file-icon-pdf">PDF</div>
                  <div>
                    <strong>launch-brief.pdf</strong>
                    <span>Merged and staged</span>
                  </div>
                  <em>Ready</em>
                </div>
                <div class="file-row">
                  <div class="file-icon file-icon-doc">DOC</div>
                  <div>
                    <strong>pricing.docx</strong>
                    <span>Converted to PDF</span>
                  </div>
                  <em>Done</em>
                </div>
              </div>

              <div class="preview-core">
                <div class="preview-stack preview-stack-back" />
                <div class="preview-stack preview-stack-mid" />
                <div class="preview-stack preview-stack-front">
                  <div class="preview-header">
                    <span>Share scene</span>
                    <strong>{activeRoute.label}</strong>
                  </div>
                  <div class="preview-beam">
                    <div class="beam-node">
                      <span class="beam-ring" />
                      <strong>Sender</strong>
                    </div>
                    <div class="beam-track">
                      <span class="beam-pulse" />
                    </div>
                    <div class="beam-node beam-node-alt">
                      <span class="beam-ring" />
                      <strong>Receiver</strong>
                    </div>
                  </div>
                  <div class="preview-metrics">
                    <div>
                      <span>Method</span>
                      <strong>{activeRoute.latency}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>End-to-end ready</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div class="route-rail">
                {#each routeModes as route, index}
                  <div class="route-card" class:route-card-active={routeIndex === index}>
                    <span>{route.label}</span>
                    <strong>{route.tag}</strong>
                    <p>{route.note}</p>
                  </div>
                {/each}
              </div>
            </div>

            <div class="command-strip">
              {#each commandChips as chip, index}
                <span class="command-chip" class:command-chip-active={statusIndex === index}>{chip}</span>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="hero-marquee" aria-hidden="true">
    <span>Micro-interactions</span>
    <span>Product demo motion</span>
    <span>Direct P2P routing</span>
    <span>Landing page choreography</span>
    <span>Browser-native processing</span>
  </div>
</section>

<style>
  .hero {
    position: relative;
    min-height: calc(100svh - 56px);
    padding: 112px 24px 64px;
    overflow: clip;
  }

  .hero-inner {
    max-width: 1320px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr);
    gap: 40px;
    align-items: center;
  }

  .hero-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 22px;
    position: relative;
    z-index: 1;
  }

  .hero-kicker,
  .hero-brand,
  .hero-title,
  .hero-sub,
  .hero-actions,
  .hero-proof,
  .hero-stage {
    opacity: 0;
    transform: translateY(24px);
    transition:
      opacity 700ms var(--ease-out),
      transform 700ms var(--ease-out);
  }

  .hero-kicker.is-mounted,
  .hero-brand.is-mounted,
  .hero-title.is-mounted,
  .hero-sub.is-mounted,
  .hero-actions.is-mounted,
  .hero-proof.is-mounted,
  .hero-stage.is-mounted {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-brand.is-mounted { transition-delay: 80ms; }
  .hero-title.is-mounted { transition-delay: 140ms; }
  .hero-sub.is-mounted { transition-delay: 200ms; }
  .hero-actions.is-mounted { transition-delay: 260ms; }
  .hero-proof.is-mounted { transition-delay: 320ms; }
  .hero-stage.is-mounted { transition-delay: 220ms; }

  .hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.04);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .kicker-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.2);
    animation: pulseKicker 2.4s ease-in-out infinite;
  }

  .hero-brand {
    margin: 0;
    font-size: clamp(1rem, 1.5vw, 1.18rem);
    font-weight: 800;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: rgba(244, 247, 253, 0.72);
  }

  :global(:not(.dark)) .hero-brand {
    color: rgba(9, 17, 31, 0.46);
  }

  .hero-title {
    margin: 0;
    max-width: 11ch;
    font-family: var(--font-display);
    font-size: clamp(3.8rem, 8vw, 7rem);
    line-height: 0.94;
    letter-spacing: -0.06em;
    color: var(--text-1);
    text-wrap: balance;
  }

  .hero-title-accent {
    display: block;
    margin-top: 8px;
    color: rgba(255, 255, 255, 0.4);
  }

  :global(:not(.dark)) .hero-title-accent {
    color: rgba(0, 0, 0, 0.4);
  }

  .hero-sub {
    max-width: 34rem;
    margin: 0;
    font-size: 17px;
    line-height: 1.72;
    color: var(--text-2);
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .hero-primary,
  .hero-secondary {
    min-width: 178px;
  }

  .hero-proof {
    width: min(100%, 42rem);
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .proof-item {
    padding: 16px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  :global(:not(.dark)) .proof-item {
    background: rgba(255, 255, 255, 0.54);
  }

  .proof-item strong {
    display: block;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-1);
  }

  .proof-label {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .hero-stage {
    position: relative;
    min-height: 720px;
    display: flex;
    align-items: center;
    justify-content: center;
  }



  .stage-shell {
    width: min(100%, 760px);
    border-radius: 30px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      rgba(8, 12, 21, 0.88);
    box-shadow:
      0 40px 120px rgba(0, 0, 0, 0.46),
      0 0 0 1px rgba(255, 255, 255, 0.06);
    overflow: hidden;
    transform: perspective(1800px) rotateX(8deg) rotateY(-12deg);
    transform-style: preserve-3d;
  }

  :global(:not(.dark)) .stage-shell {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(247, 250, 255, 0.74)),
      rgba(255, 255, 255, 0.82);
    border-color: rgba(255, 255, 255, 0.44);
    box-shadow:
      0 40px 120px rgba(10, 22, 45, 0.14),
      0 0 0 1px rgba(0, 0, 0, 0.08);
  }

  .stage-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  :global(:not(.dark)) .stage-toolbar {
    border-bottom-color: rgba(12, 19, 34, 0.08);
  }

  .toolbar-dots {
    display: flex;
    gap: 7px;
  }

  .toolbar-dots span {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.18);
  }

  :global(:not(.dark)) .toolbar-dots span {
    background: rgba(12, 19, 34, 0.14);
  }

  .toolbar-title,
  .toolbar-chip {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .toolbar-chip {
    padding: 7px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.08);
  }

  .stage-layout {
    display: grid;
    grid-template-columns: 188px minmax(0, 1fr);
    min-height: 560px;
  }

  .stage-sidebar {
    padding: 24px 18px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  :global(:not(.dark)) .stage-sidebar {
    border-right-color: rgba(12, 19, 34, 0.08);
    background: rgba(12, 19, 34, 0.03);
  }

  .sidebar-brand {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .sidebar-logo {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: #ffffff;
    color: #000000;
    font-weight: 900;
  }

  .sidebar-brand p,
  .sidebar-brand span {
    margin: 0;
  }

  .sidebar-brand p {
    font-size: 14px;
    font-weight: 800;
  }

  .sidebar-brand span {
    font-size: 11px;
    color: var(--text-3);
  }

  .sidebar-nav {
    display: grid;
    gap: 8px;
  }

  .sidebar-link {
    padding: 10px 12px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
    border: 1px solid transparent;
  }

  .sidebar-link-active {
    color: var(--text-1);
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
  }

  .sidebar-meter,
  .sidebar-card {
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  :global(:not(.dark)) .sidebar-meter,
  :global(:not(.dark)) .sidebar-card {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.56);
  }

  .meter-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 11px;
    color: var(--text-3);
  }

  .meter-head strong {
    color: var(--text-1);
    font-size: 12px;
  }

  .meter-track {
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #333333 0%, #888888 58%, #ffffff 100%);
    transition: width 260ms ease;
  }

  .sidebar-card strong {
    display: block;
    margin: 8px 0 4px;
    font-size: 15px;
    color: var(--text-1);
  }

  .sidebar-card p {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-2);
  }

  .stage-main {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .stage-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .stage-label {
    display: block;
    margin-bottom: 4px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .stage-header strong {
    font-size: 19px;
    letter-spacing: -0.03em;
    color: var(--text-1);
  }

  .stage-pill {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 10px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-2);
  }

  .stage-pill-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--success);
    box-shadow: 0 0 14px rgba(74, 222, 179, 0.46);
    animation: pulseKicker 2.4s ease-in-out infinite;
  }

  .stage-canvas {
    display: grid;
    grid-template-columns: 1.02fr 1.22fr 1fr;
    gap: 14px;
    min-height: 360px;
  }

  .file-rail,
  .route-rail {
    display: grid;
    gap: 12px;
  }

  .file-row,
  .route-card {
    padding: 14px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    transition:
      transform 220ms var(--ease-out),
      border-color 220ms ease,
      background 220ms ease;
  }

  :global(:not(.dark)) .file-row,
  :global(:not(.dark)) .route-card {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.6);
  }

  .file-row-active,
  .route-card-active {
    transform: translateY(-2px);
    border-color: rgba(53, 212, 255, 0.22);
    background: rgba(53, 212, 255, 0.08);
    box-shadow: 0 0 0 1px rgba(53, 212, 255, 0.08);
  }

  .file-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
  }

  .file-icon {
    width: 38px;
    height: 38px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #04131d;
    background: linear-gradient(135deg, #bff3ff 0%, #4dd6ff 100%);
  }

  .file-icon-pdf {
    background: linear-gradient(135deg, #ffe2b4 0%, #f1b464 100%);
  }

  .file-icon-doc {
    background: linear-gradient(135deg, #c9d0ff 0%, #878cff 100%);
  }

  .file-row strong,
  .route-card strong {
    display: block;
    font-size: 13px;
    line-height: 1.35;
    color: var(--text-1);
  }

  .file-row span,
  .route-card span,
  .route-card p {
    display: block;
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-2);
  }

  .file-row em {
    font-style: normal;
    font-size: 11px;
    font-weight: 800;
    color: var(--accent);
  }

  .preview-core {
    position: relative;
    min-height: 100%;
    display: grid;
    place-items: center;
  }

  .preview-stack {
    position: absolute;
    inset: 0;
    border-radius: 28px;
  }

  .preview-stack-back {
    transform: translateY(20px) scale(0.92);
    background: rgba(53, 212, 255, 0.08);
    filter: blur(4px);
  }

  .preview-stack-mid {
    transform: translateY(10px) scale(0.96);
    background: rgba(135, 140, 255, 0.08);
    filter: blur(2px);
  }

  .preview-stack-front {
    position: relative;
    inset: auto;
    width: 100%;
    min-height: 100%;
    padding: 18px;
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
      rgba(4, 9, 17, 0.92);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  .preview-stack-front::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 30%, rgba(53, 212, 255, 0.16), transparent 30%),
      linear-gradient(135deg, transparent, rgba(255, 255, 255, 0.06), transparent 66%);
    pointer-events: none;
  }

  .preview-header,
  .preview-metrics {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .preview-header span,
  .preview-metrics span {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .preview-header strong,
  .preview-metrics strong {
    font-size: 12px;
    color: var(--text-1);
  }

  .preview-beam {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    margin: 40px 0;
  }

  .beam-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--text-1);
  }

  .beam-ring {
    width: 54px;
    height: 54px;
    border-radius: 999px;
    border: 1px solid rgba(53, 212, 255, 0.24);
    background: radial-gradient(circle, rgba(53, 212, 255, 0.22), rgba(53, 212, 255, 0.02));
    box-shadow: inset 0 0 24px rgba(53, 212, 255, 0.14);
  }

  .beam-node-alt .beam-ring {
    border-color: rgba(74, 222, 179, 0.24);
    background: radial-gradient(circle, rgba(74, 222, 179, 0.22), rgba(74, 222, 179, 0.02));
  }

  .beam-track {
    position: relative;
    height: 2px;
    background: linear-gradient(90deg, rgba(53, 212, 255, 0.04), rgba(53, 212, 255, 0.38), rgba(74, 222, 179, 0.18));
    overflow: hidden;
  }

  .beam-pulse {
    position: absolute;
    top: -3px;
    left: 0;
    width: 38%;
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(191, 243, 255, 0.92), transparent);
    animation: beamTravel 2.8s linear infinite;
  }

  .route-card p {
    margin-top: 8px;
  }

  .command-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .command-chip {
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
    transition: all 200ms ease;
  }

  .command-chip-active {
    color: var(--text-1);
    border-color: rgba(53, 212, 255, 0.24);
    background: rgba(53, 212, 255, 0.08);
  }

  .hero-marquee {
    display: flex;
    gap: 32px;
    padding-top: 34px;
    margin-top: 36px;
    border-top: 1px solid var(--border);
    overflow: auto hidden;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
    scrollbar-width: none;
  }

  .hero-marquee::-webkit-scrollbar {
    display: none;
  }

  @keyframes pulseKicker {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.65; transform: scale(0.92); }
  }

  @keyframes orbitFloat {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(16px, -18px, 0); }
  }

  @keyframes orbitFloatAlt {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(-20px, 18px, 0); }
  }

  @keyframes beamTravel {
    0% { transform: translateX(-110%); opacity: 0; }
    20% { opacity: 1; }
    100% { transform: translateX(320%); opacity: 0; }
  }

  @media (max-width: 1180px) {
    .hero-inner {
      grid-template-columns: 1fr;
      gap: 30px;
    }

    .hero-copy {
      max-width: 760px;
    }

    .hero-stage {
      min-height: auto;
      padding-bottom: 20px;
    }
  }

  @media (max-width: 900px) {
    .hero {
      padding-top: 96px;
    }

    .hero-proof {
      grid-template-columns: 1fr;
    }

    .stage-shell {
      transform: none;
      width: 100%;
    }

    .stage-layout {
      grid-template-columns: 1fr;
    }

    .stage-sidebar {
      border-right: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    :global(:not(.dark)) .stage-sidebar {
      border-bottom-color: rgba(12, 19, 34, 0.08);
    }

    .stage-canvas {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .hero {
      padding: 88px 18px 40px;
    }

    .hero-title {
      font-size: clamp(3rem, 18vw, 4.2rem);
      max-width: 8.4ch;
    }

    .hero-sub {
      font-size: 15px;
    }

    .hero-actions {
      width: 100%;
      flex-direction: column;
    }

    .hero-primary,
    .hero-secondary {
      width: 100%;
    }

    .stage-main {
      padding: 18px;
    }

    .stage-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .hero-marquee {
      gap: 22px;
      margin-top: 26px;
      padding-top: 24px;
    }
  }
</style>
