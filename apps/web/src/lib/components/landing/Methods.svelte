<script lang="ts">
  import { onMount } from 'svelte'

  const routes = [
    {
      id: 'p2p',
      num: '01',
      label: 'Direct P2P',
      tagline: 'The primary path',
      desc: "Files travel browser-to-browser over an encrypted WebRTC channel. Nothing touches a relay server. No account needed. Just a 6-character room code.",
      points: [
        'End-to-end WebRTC encryption',
        'No file relay or server storage',
        'No account or login required',
        '6-character room code handoff',
        'QR code for mobile receivers',
      ],
      badge: 'Default',
      badgeColor: 'green',
      speed: '12ms',
      speedLabel: 'handoff latency',
    },
    {
      id: 'lan',
      num: '02',
      label: 'Local Network',
      tagline: 'Same-Wi-Fi speed',
      desc: "If both devices share the same local network, Clex detects it and routes the transfer locally — staying off the public internet entirely for maximum speed.",
      points: [
        'Automatic same-network detection',
        'Transfer stays on local network',
        'No internet required for transfer',
        'Near-instant for large files',
        'Works with mobile hotspots too',
      ],
      badge: 'Fast lane',
      badgeColor: 'cyan',
      speed: 'LAN',
      speedLabel: 'throughput',
    },
    {
      id: 'drive',
      num: '03',
      label: 'Google Drive',
      tagline: 'Secure cloud fallback',
      desc: "When direct transfer isn't possible, connect your Google Drive. Files go to your own storage — not ours. Share a Drive link and the receiver pulls from your account.",
      points: [
        'Files stored in your Google Drive',
        'Clex never stores your files',
        'OAuth-secured, token never persisted',
        'Direct link sharing to any recipient',
        'Works across different networks',
      ],
      badge: 'Fallback',
      badgeColor: 'violet',
      speed: '1-click',
      speedLabel: 'fallback switch',
    },
  ]

  let sectionEl: HTMLElement
  let visible = false
  let activeRoute = 0

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.08 }
    )
    if (sectionEl) obs.observe(sectionEl)
    return () => obs.disconnect()
  })
</script>

<section id="methods" class="methods section" bind:this={sectionEl}>
  <div class="container">

    <div class="methods-header reveal" class:is-visible={visible}>
      <div class="section-label">
        <span class="section-label-dot" />
        Transfer routes
      </div>
      <h2 class="methods-title">
        Three routes.<br/>
        <span class="title-outline">One decision.</span>
      </h2>
      <p class="methods-sub">
        Clex surfaces the best transfer path for your situation.
        You're always in control — switch routes with one click at any time.
      </p>
    </div>

    <div class="methods-body">

      <div class="route-tabs reveal reveal-2" class:is-visible={visible}>
        {#each routes as route, i}
          <button
            class="route-tab"
            class:route-tab-active={activeRoute === i}
            on:click={() => activeRoute = i}
          >
            <span class="tab-num font-mono">{route.num}</span>
            <div class="tab-copy">
              <span class="tab-label">{route.label}</span>
              <span class="tab-tagline">{route.tagline}</span>
            </div>
            <div class="tab-speed">
              <span class="speed-big">{route.speed}</span>
              <span class="speed-label">{route.speedLabel}</span>
            </div>
          </button>
        {/each}
      </div>

      {#each routes as route, i}
        {#if activeRoute === i}
          <div class="route-detail reveal reveal-3" class:is-visible={visible}>
            <div class="detail-header">
              <div>
                <div class="detail-num font-mono">{route.num}</div>
                <h3 class="detail-title">{route.label}</h3>
                <p class="detail-tagline">{route.tagline}</p>
              </div>
              <div class="detail-badge badge-{route.badgeColor}">
                <span class="badge-pulse" />
                {route.badge}
              </div>
            </div>

            <p class="detail-desc">{route.desc}</p>

            <ul class="detail-points">
              {#each route.points as point, j}
                <li class="detail-point" style="animation-delay: {j * 60}ms">
                  <span class="point-check">✓</span>
                  {point}
                </li>
              {/each}
            </ul>

            <div class="detail-scene">
              <div class="scene-row">
                <div class="scene-node">
                  <div class="node-ring"
                    class:ring-cyan={route.id === 'lan'}
                    class:ring-violet={route.id === 'drive'}
                  />
                  <span class="node-label font-mono">
                    {route.id === 'p2p' ? 'Browser A' : route.id === 'lan' ? 'Device A' : 'Your Browser'}
                  </span>
                </div>
                <div class="scene-beam">
                  <div class="scene-line"
                    class:line-cyan={route.id === 'lan'}
                    class:line-violet={route.id === 'drive'}
                  />
                  <div class="scene-pulse"
                    class:pulse-cyan={route.id === 'lan'}
                    class:pulse-violet={route.id === 'drive'}
                  />
                  <div class="scene-beam-label font-mono">
                    {route.id === 'p2p' ? 'WebRTC · Encrypted' : route.id === 'lan' ? 'Local · No internet' : 'OAuth · Your Drive'}
                  </div>
                </div>
                <div class="scene-node">
                  <div class="node-ring node-ring-alt"
                    class:ring-cyan={route.id === 'lan'}
                    class:ring-violet={route.id === 'drive'}
                  />
                  <span class="node-label font-mono">
                    {route.id === 'p2p' ? 'Browser B' : route.id === 'lan' ? 'Device B' : 'Google Drive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <div class="privacy-strip reveal reveal-4" class:is-visible={visible}>
      <div class="privacy-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 6V12C4 16.42 7.44 20.6 12 22C16.56 20.6 20 16.42 20 12V6L12 2Z"
            stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="privacy-copy">
        <strong>Privacy by architecture, not policy.</strong>
        During direct P2P transfer, your files never touch a Clex server.
        The signaling server only handles connection setup — no file data passes through it.
      </div>
      <a href="/privacy" class="btn-secondary privacy-btn">Read our privacy policy →</a>
    </div>

  </div>
</section>

<style>
  .methods-header { max-width: 640px; margin-bottom: 56px; }

  .methods-title {
    font-family: var(--font-display);
    font-size: clamp(2.2rem, 4.5vw, 3.8rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.05;
    color: var(--text-1);
    margin-bottom: 16px;
  }

  .title-outline { color: transparent; -webkit-text-stroke: 2px var(--text-1); paint-order: stroke fill; }

  .methods-sub { font-size: 17px; line-height: 1.7; color: var(--text-2); max-width: 52ch; }

  .methods-body {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 24px;
    margin-bottom: 32px;
    align-items: start;
  }

  @media (max-width: 960px) { .methods-body { grid-template-columns: 1fr; } }

  .route-tabs { display: flex; flex-direction: column; gap: 12px; }

  .route-tab {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    border: 2px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    cursor: pointer;
    text-align: left;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .route-tab:hover { border-color: var(--border-strong); transform: translateX(2px); }
  .route-tab-active { border-color: var(--border-hard); box-shadow: var(--shadow-md); transform: translateX(4px); }

  .tab-num { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: var(--text-3); flex-shrink: 0; }
  .tab-copy { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .tab-label { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); letter-spacing: -0.02em; }
  .tab-tagline { font-family: var(--font-mono); font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
  .tab-speed { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
  .speed-big { font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--text-1); }
  .speed-label { font-family: var(--font-mono); font-size: 9px; color: var(--text-3); letter-spacing: 0.08em; text-transform: uppercase; }

  .route-detail {
    padding: 32px;
    border: 2px solid var(--border-hard);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    gap: 22px;
    animation: fadeUp 280ms var(--ease-out) both;
  }

  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .detail-num { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: var(--text-3); text-transform: uppercase; margin-bottom: 8px; }
  .detail-title { font-family: var(--font-display); font-size: 26px; font-weight: 700; letter-spacing: -0.03em; color: var(--text-1); margin-bottom: 4px; }
  .detail-tagline { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); }

  .detail-badge {
    padding: 7px 14px;
    border-radius: 8px;
    border: 2px solid;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .badge-green  { color: var(--green);  border-color: var(--green);  background: rgba(0,229,112,0.08); }
  .badge-cyan   { color: var(--cyan);   border-color: var(--cyan);   background: rgba(34,211,238,0.08); }
  .badge-violet { color: var(--violet); border-color: var(--violet); background: rgba(155,127,255,0.08); }

  .badge-pulse { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulse-dot 2s ease-in-out infinite; }

  .detail-desc { font-size: 15px; line-height: 1.72; color: var(--text-2); }

  .detail-points { list-style: none; display: flex; flex-direction: column; gap: 10px; }

  .detail-point {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: var(--text-1);
    animation: fadeUp 300ms var(--ease-out) both;
  }

  .point-check {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: var(--accent);
    color: #000;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 900;
    flex-shrink: 0;
    border: 1.5px solid #000;
  }

  .detail-scene { padding: 20px; border: 1.5px solid var(--border); border-radius: 14px; background: var(--surface-2); }
  .scene-row { display: flex; align-items: center; height: 80px; }
  .scene-node { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; }

  .node-ring {
    width: 44px; height: 44px; border-radius: 50%;
    border: 2px solid var(--accent);
    background: rgba(255,230,0,0.1);
  }

  .node-ring.ring-cyan   { border-color: var(--cyan);   background: rgba(34,211,238,0.1); }
  .node-ring.ring-violet { border-color: var(--violet); background: rgba(155,127,255,0.1); }
  .node-ring-alt         { border-color: var(--green);  background: rgba(0,229,112,0.1); }
  .node-ring-alt.ring-cyan   { border-color: var(--cyan); }
  .node-ring-alt.ring-violet { border-color: var(--violet); }

  .node-label { font-family: var(--font-mono); font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); white-space: nowrap; }

  .scene-beam { flex: 1; position: relative; height: 44px; padding: 0 12px; }

  .scene-line {
    position: absolute; left: 0; right: 0; height: 2px;
    background: var(--accent); top: 50%; transform: translateY(-50%); opacity: 0.35;
  }
  .scene-line.line-cyan   { background: var(--cyan); }
  .scene-line.line-violet { background: var(--violet); }

  .scene-pulse {
    position: absolute; left: 0; width: 30%; height: 4px; border-radius: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    top: 50%; transform: translateY(-50%);
    animation: beam-travel 2s ease-in-out infinite;
  }
  .scene-pulse.pulse-cyan   { background: linear-gradient(90deg, transparent, var(--cyan),   transparent); }
  .scene-pulse.pulse-violet { background: linear-gradient(90deg, transparent, var(--violet), transparent); }

  .scene-beam-label {
    position: absolute; top: 3px; left: 50%; transform: translateX(-50%);
    font-family: var(--font-mono); font-size: 9px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); white-space: nowrap;
  }

  .privacy-strip {
    display: flex; align-items: center; gap: 20px; padding: 24px 28px;
    border: 2px solid var(--border-hard); border-radius: 16px; background: var(--surface);
    box-shadow: var(--shadow-md); flex-wrap: wrap; margin-top: 12px;
  }

  .privacy-icon {
    width: 48px; height: 48px; border-radius: 12px;
    border: 2px solid var(--accent); background: var(--accent-dim);
    display: grid; place-items: center; color: var(--accent); flex-shrink: 0;
  }

  :global(:not(.dark)) .privacy-icon { color: #000; }

  .privacy-copy { flex: 1; font-size: 14px; line-height: 1.65; color: var(--text-2); min-width: 240px; }
  .privacy-copy strong { display: block; font-weight: 700; color: var(--text-1); margin-bottom: 4px; font-family: var(--font-display); }
  .privacy-btn { font-size: 13px; white-space: nowrap; }
</style>
