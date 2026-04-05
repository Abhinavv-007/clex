<script lang="ts">
  import { onMount } from 'svelte'

  let visible = false
  let sectionEl: HTMLElement | null = null

  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true
          observer.disconnect()
        }
      },
      { threshold: 0.16 }
    )

    if (sectionEl) observer.observe(sectionEl)

    return () => observer.disconnect()
  })
</script>

<section id="how-it-works" class="orchestra" bind:this={sectionEl}>
  <div class="orchestra-head" class:is-visible={visible}>
    <p class="orchestra-kicker">Interface choreography</p>
    <h2 class="orchestra-title">Every panel carries motion, status, and trust.</h2>
    <p class="orchestra-sub">
      The site sells the product by behaving like the product: precise, alive, and confident under interaction.
    </p>
  </div>

  <div class="orchestra-grid" class:is-visible={visible}>
    <article class="orchestra-main">
      <div class="main-top">
        <div>
          <span class="mini-kicker">Hero product demo</span>
          <strong>Mock app screens with live state changes</strong>
        </div>
        <span class="mini-pill">Always in motion</span>
      </div>

      <div class="main-display">
        <div class="screen-shell shell-back" />
        <div class="screen-shell shell-mid" />
        <div class="screen-shell shell-front">
          <div class="screen-row">
            <span>Transfer board</span>
            <strong>Queue synchronized</strong>
          </div>
          <div class="screen-grid">
            <div class="screen-cell screen-cell-wide">
              <div class="sparkline">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div class="screen-cell">
              <div class="cell-pulse" />
            </div>
            <div class="screen-cell">
              <div class="cell-stack">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div class="screen-cell screen-cell-wide">
              <div class="screen-feed">
                <div><span />Processing hero-shot.jpg</div>
                <div><span />Preparing room token</div>
                <div><span />Direct path approved</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="orchestra-side">
      <span class="mini-kicker">Micro-interactions</span>
      <h3>Status changes stay visible.</h3>
      <p>Hover lifts, scanning lines, route pulses, progress sweeps, and queue highlights all reinforce the same product language.</p>
      <div class="interaction-list">
        <div class="interaction-item">
          <strong>Buttons</strong>
          <span>Soft lift, glow lock, tactile press</span>
        </div>
        <div class="interaction-item">
          <strong>Cards</strong>
          <span>Parallax hover and luminous edges</span>
        </div>
        <div class="interaction-item">
          <strong>Feed states</strong>
          <span>Animated pulses instead of dead labels</span>
        </div>
      </div>
    </article>

    <article class="orchestra-side">
      <span class="mini-kicker">Motion system</span>
      <h3>One timing curve across the site.</h3>
      <p>Entrances, sticky transitions, chip swaps, and demo beams use the same motion grammar so the experience feels authored, not assembled.</p>
      <div class="timing-rail">
        <div class="timing-item timing-item-fast">
          <strong>180ms</strong>
          <span>micro lift</span>
        </div>
        <div class="timing-item timing-item-mid">
          <strong>320ms</strong>
          <span>state transition</span>
        </div>
        <div class="timing-item timing-item-slow">
          <strong>700ms</strong>
          <span>section reveal</span>
        </div>
      </div>
    </article>
  </div>

  <div class="proof-band" class:is-visible={visible}>
    <div class="proof-block">
      <span>Presentation</span>
      <strong>Poster-scale hero with live product context</strong>
    </div>
    <div class="proof-block">
      <span>Interaction</span>
      <strong>Sticky storytelling and animated command surfaces</strong>
    </div>
    <div class="proof-block">
      <span>Trust</span>
      <strong>Private routing explained in the interface itself</strong>
    </div>
  </div>
</section>

<style>
  .orchestra {
    padding: 110px 24px;
  }

  .orchestra-head,
  .orchestra-grid,
  .proof-band {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out);
  }

  .orchestra-head.is-visible,
  .orchestra-grid.is-visible,
  .proof-band.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .orchestra-grid.is-visible { transition-delay: 100ms; }
  .proof-band.is-visible { transition-delay: 180ms; }

  .orchestra-head {
    max-width: 760px;
    margin: 0 auto 48px;
    text-align: center;
  }

  .orchestra-kicker,
  .mini-kicker {
    display: inline-block;
    margin: 0 0 14px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .orchestra-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 5.2vw, 4.6rem);
    line-height: 1;
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .orchestra-sub {
    max-width: 38rem;
    margin: 18px auto 0;
    font-size: 16px;
    line-height: 1.72;
    color: var(--text-2);
  }

  .orchestra-grid {
    max-width: 1240px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.72fr) minmax(0, 0.72fr);
    gap: 18px;
  }

  .orchestra-main,
  .orchestra-side,
  .proof-band {
    border-radius: 30px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  :global(:not(.dark)) .orchestra-main,
  :global(:not(.dark)) .orchestra-side,
  :global(:not(.dark)) .proof-band {
    background: rgba(255, 255, 255, 0.6);
  }

  .orchestra-main {
    padding: 24px;
    overflow: hidden;
  }

  .main-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }

  .main-top strong {
    display: block;
    max-width: 20rem;
    font-size: 20px;
    line-height: 1.2;
    letter-spacing: -0.03em;
  }

  .mini-pill {
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(53, 212, 255, 0.18);
    background: rgba(53, 212, 255, 0.08);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .main-display {
    position: relative;
    min-height: 420px;
    display: grid;
    place-items: center;
  }

  .screen-shell {
    position: absolute;
    inset: auto;
    width: min(100%, 440px);
    border-radius: 28px;
    transition: transform 240ms var(--ease-out);
  }

  .shell-back {
    height: 320px;
    transform: translate(-34px, 24px) rotate(-10deg);
    background: rgba(135, 140, 255, 0.12);
    filter: blur(4px);
  }

  .shell-mid {
    height: 340px;
    transform: translate(28px, -8px) rotate(8deg);
    background: rgba(53, 212, 255, 0.1);
    filter: blur(3px);
  }

  .shell-front {
    position: relative;
    width: min(100%, 520px);
    min-height: 360px;
    padding: 18px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      rgba(8, 12, 21, 0.88);
    box-shadow:
      0 34px 90px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  :global(:not(.dark)) .shell-front {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.72)),
      rgba(255, 255, 255, 0.84);
  }

  .screen-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .screen-row span {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .screen-row strong {
    font-size: 14px;
    color: var(--text-1);
  }

  .screen-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .screen-cell {
    min-height: 118px;
    padding: 14px;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  :global(:not(.dark)) .screen-cell {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.62);
  }

  .screen-cell-wide {
    grid-column: span 2;
  }

  .sparkline {
    height: 100%;
    display: flex;
    align-items: end;
    gap: 10px;
  }

  .sparkline span {
    flex: 1;
    border-radius: 999px 999px 6px 6px;
    background: linear-gradient(180deg, rgba(191, 243, 255, 0.92), rgba(33, 187, 255, 0.34));
    animation: wave 2.8s ease-in-out infinite;
  }

  .sparkline span:nth-child(1) { height: 34%; }
  .sparkline span:nth-child(2) { height: 62%; animation-delay: 0.1s; }
  .sparkline span:nth-child(3) { height: 88%; animation-delay: 0.2s; }
  .sparkline span:nth-child(4) { height: 52%; animation-delay: 0.3s; }
  .sparkline span:nth-child(5) { height: 72%; animation-delay: 0.4s; }

  .cell-pulse {
    width: 74px;
    height: 74px;
    margin: auto;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(53, 212, 255, 0.4), rgba(53, 212, 255, 0.06));
    animation: pulseCell 2.4s ease-in-out infinite;
  }

  .cell-stack {
    display: grid;
    gap: 10px;
  }

  .cell-stack span {
    height: 18px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.12), rgba(53, 212, 255, 0.3), rgba(255, 255, 255, 0.12));
    background-size: 200% 100%;
    animation: shimmerRail 2.8s linear infinite;
  }

  .screen-feed {
    display: grid;
    gap: 10px;
  }

  .screen-feed div {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--text-1);
  }

  .screen-feed span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--success);
    box-shadow: 0 0 12px rgba(74, 222, 179, 0.46);
  }

  .orchestra-side {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .orchestra-side h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  .orchestra-side p {
    margin: 0;
    font-size: 14px;
    line-height: 1.72;
    color: var(--text-2);
  }

  .interaction-list,
  .timing-rail {
    display: grid;
    gap: 12px;
  }

  .interaction-item,
  .timing-item {
    padding: 14px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  :global(:not(.dark)) .interaction-item,
  :global(:not(.dark)) .timing-item {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.66);
  }

  .interaction-item strong,
  .timing-item strong {
    display: block;
    margin-bottom: 4px;
    font-size: 13px;
    color: var(--text-1);
  }

  .interaction-item span,
  .timing-item span {
    font-size: 12px;
    color: var(--text-2);
  }

  .timing-item-fast { border-color: rgba(53, 212, 255, 0.18); }
  .timing-item-mid { border-color: rgba(135, 140, 255, 0.18); }
  .timing-item-slow { border-color: rgba(74, 222, 179, 0.18); }

  .proof-band {
    max-width: 1240px;
    margin: 18px auto 0;
    padding: 18px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .proof-block {
    padding: 14px 16px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  :global(:not(.dark)) .proof-block {
    background: rgba(255, 255, 255, 0.68);
    border-color: rgba(12, 19, 34, 0.08);
  }

  .proof-block span {
    display: block;
    margin-bottom: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .proof-block strong {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-1);
  }

  @keyframes wave {
    0%, 100% { transform: scaleY(0.82); opacity: 0.8; }
    50% { transform: scaleY(1.08); opacity: 1; }
  }

  @keyframes pulseCell {
    0%, 100% { transform: scale(0.88); opacity: 0.72; }
    50% { transform: scale(1.06); opacity: 1; }
  }

  @keyframes shimmerRail {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }

  @media (max-width: 1080px) {
    .orchestra-grid {
      grid-template-columns: 1fr;
    }

    .proof-band {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .orchestra {
      padding: 88px 18px;
    }

    .orchestra-main,
    .orchestra-side {
      padding: 20px;
    }

    .main-top {
      flex-direction: column;
      align-items: flex-start;
    }

    .screen-grid {
      grid-template-columns: 1fr;
    }

    .screen-cell-wide {
      grid-column: span 1;
    }
  }
</style>
