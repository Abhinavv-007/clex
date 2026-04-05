<script lang="ts">
  import { onMount } from 'svelte'

  const beats = [
    {
      label: 'Ingest',
      title: 'Drop files once. The interface maps the next move for you.',
      body: 'Clex reads file types, prepares the queue, and creates a working surface that feels immediate instead of form-driven.',
      metric: '12+ formats auto-classified',
      chips: ['Image compression', 'PDF merge', 'DOCX conversion'],
    },
    {
      label: 'Prepare',
      title: 'Transformations stay visible while they happen.',
      body: 'Compression, conversion, and preparation are treated like live states, not modal dead ends. Every step keeps the next action in reach.',
      metric: 'Live processing rail',
      chips: ['Queued previews', 'Progress choreography', 'Suggestion engine'],
    },
    {
      label: 'Deliver',
      title: 'Routing becomes part of the product story, not a hidden backend detail.',
      body: 'Direct, local, and fallback routes are surfaced with confidence, so users always understand how a file is moving.',
      metric: 'Direct, LAN, or Drive',
      chips: ['Room creation', 'Fallback readiness', 'Private defaults'],
    },
  ]

  let sectionVisible = false
  let activeIndex = 0
  let beatEls: HTMLElement[] = []
  let sectionEl: HTMLElement | null = null

  onMount(() => {
    const sectionObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          sectionVisible = true
          sectionObserver.disconnect()
        }
      },
      { threshold: 0.12 }
    )

    if (sectionEl) sectionObserver.observe(sectionEl)

    const observers = beatEls.map((el, index) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) activeIndex = index
        },
        {
          threshold: 0.55,
          rootMargin: '-12% 0px -22% 0px',
        }
      )

      observer.observe(el)
      return observer
    })

    return () => {
      sectionObserver.disconnect()
      observers.forEach(observer => observer.disconnect())
    }
  })
</script>

<section id="features" class="story" bind:this={sectionEl}>
  <div class="story-head" class:is-visible={sectionVisible}>
    <p class="story-kicker">Workflow system</p>
    <h2 class="story-title">One cinematic workflow, three product states.</h2>
    <p class="story-sub">
      The interface is designed so upload, preparation, and delivery feel like a continuous move.
    </p>
  </div>

  <div class="story-grid">
    <div class="story-stage">
      <div class="stage-frame" data-state={activeIndex}>
        <div class="stage-frame-top">
          <span class="stage-mini-label">System choreography</span>
          <strong>{beats[activeIndex].metric}</strong>
        </div>

        <div class="stage-panels">
          <div class="panel panel-ingest">
            <div class="panel-header">
              <span>Upload queue</span>
              <strong>06 live files</strong>
            </div>
            <div class="panel-rows">
              <div class="panel-row panel-row-hot">
                <span>launch-poster.png</span>
                <em>Detected</em>
              </div>
              <div class="panel-row">
                <span>sales-pack.pdf</span>
                <em>Merged</em>
              </div>
              <div class="panel-row">
                <span>pricing.docx</span>
                <em>Ready</em>
              </div>
            </div>
          </div>

          <div class="panel panel-prepare">
            <div class="prepare-core">
              <div class="prepare-badge">Pipeline live</div>
              <div class="prepare-track">
                <span class="prepare-node prepare-node-active">Compress</span>
                <span class="prepare-link" />
                <span class="prepare-node">Convert</span>
                <span class="prepare-link" />
                <span class="prepare-node">Share</span>
              </div>
              <div class="prepare-meter">
                <span>Processing depth</span>
                <div class="prepare-meter-track">
                  <div class="prepare-meter-fill" />
                </div>
              </div>
            </div>
          </div>

          <div class="panel panel-deliver">
            <div class="deliver-card deliver-card-active">
              <span>Direct P2P</span>
              <strong>Primary route</strong>
            </div>
            <div class="deliver-card">
              <span>Local lane</span>
              <strong>Same-network boost</strong>
            </div>
            <div class="deliver-card">
              <span>Drive link</span>
              <strong>Fallback standing by</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="story-copy">
      {#each beats as beat, index}
        <article class="story-beat" class:story-beat-active={activeIndex === index} bind:this={beatEls[index]}>
          <span class="beat-label">{beat.label}</span>
          <h3>{beat.title}</h3>
          <p>{beat.body}</p>
          <div class="beat-foot">
            <strong>{beat.metric}</strong>
            <div class="beat-chips">
              {#each beat.chips as chip}
                <span>{chip}</span>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .story {
    padding: 120px 24px 40px;
  }

  .story-head {
    max-width: 760px;
    margin: 0 auto 52px;
    text-align: center;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out);
  }

  .story-head.is-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .story-kicker {
    margin: 0 0 16px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .story-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.8rem, 6vw, 4.8rem);
    line-height: 0.98;
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .story-sub {
    max-width: 36rem;
    margin: 18px auto 0;
    font-size: 16px;
    line-height: 1.7;
    color: var(--text-2);
  }

  .story-grid {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 0.82fr);
    gap: 28px;
    align-items: start;
  }

  .story-stage {
    position: sticky;
    top: 92px;
  }

  .stage-frame {
    padding: 24px;
    border-radius: 32px;
    border: 1px solid var(--border);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
      rgba(8, 12, 21, 0.72);
    box-shadow:
      0 34px 100px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    min-height: 540px;
    transition: box-shadow 280ms ease, border-color 280ms ease;
  }

  :global(:not(.dark)) .stage-frame {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.68)),
      rgba(255, 255, 255, 0.8);
    box-shadow:
      0 28px 80px rgba(10, 22, 45, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.74);
  }

  .stage-frame[data-state='0'] {
    border-color: rgba(53, 212, 255, 0.16);
  }

  .stage-frame[data-state='1'] {
    border-color: rgba(135, 140, 255, 0.16);
  }

  .stage-frame[data-state='2'] {
    border-color: rgba(74, 222, 179, 0.16);
  }

  .stage-frame-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 22px;
  }

  .stage-mini-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .stage-frame-top strong {
    font-size: 14px;
    color: var(--text-1);
  }

  .stage-panels {
    min-height: 440px;
    display: grid;
    grid-template-columns: 1fr 1.15fr 1fr;
    gap: 16px;
    align-items: stretch;
  }

  .panel {
    position: relative;
    overflow: hidden;
    padding: 16px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    transition: transform 260ms var(--ease-out), border-color 260ms ease, opacity 260ms ease;
  }

  :global(:not(.dark)) .panel {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.56);
  }

  .stage-frame[data-state='0'] .panel-ingest,
  .stage-frame[data-state='1'] .panel-prepare,
  .stage-frame[data-state='2'] .panel-deliver {
    transform: translateY(-6px);
    border-color: rgba(53, 212, 255, 0.2);
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.16);
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 18px;
  }

  .panel-header span,
  .prepare-badge,
  .deliver-card span {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .panel-header strong,
  .deliver-card strong {
    font-size: 13px;
    color: var(--text-1);
  }

  .panel-rows {
    display: grid;
    gap: 12px;
  }

  .panel-row {
    padding: 12px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  :global(:not(.dark)) .panel-row {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.68);
  }

  .panel-row span {
    font-size: 12px;
    color: var(--text-1);
  }

  .panel-row em {
    font-style: normal;
    font-size: 11px;
    font-weight: 800;
    color: var(--accent);
  }

  .panel-row-hot {
    border-color: rgba(53, 212, 255, 0.18);
    background: rgba(53, 212, 255, 0.08);
  }

  .prepare-core {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 18px;
  }

  .prepare-track {
    display: grid;
    gap: 16px;
    align-items: center;
    justify-items: center;
    margin-top: auto;
    margin-bottom: auto;
  }

  .prepare-node {
    width: 100%;
    padding: 14px 16px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .prepare-node-active {
    color: var(--text-1);
    border-color: rgba(53, 212, 255, 0.2);
    background: rgba(53, 212, 255, 0.08);
  }

  .prepare-link {
    width: 2px;
    height: 32px;
    background: linear-gradient(180deg, rgba(53, 212, 255, 0.08), rgba(53, 212, 255, 0.38), rgba(53, 212, 255, 0.08));
  }

  .prepare-meter {
    display: grid;
    gap: 10px;
  }

  .prepare-meter span {
    font-size: 11px;
    color: var(--text-2);
  }

  .prepare-meter-track {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .prepare-meter-fill {
    height: 100%;
    width: 72%;
    border-radius: inherit;
    background: linear-gradient(90deg, #bff3ff 0%, #5bd8ff 56%, #21bbff 100%);
    animation: sweep 3.2s ease-in-out infinite;
  }

  .panel-deliver {
    display: grid;
    gap: 12px;
  }

  .deliver-card {
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }

  :global(:not(.dark)) .deliver-card {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(255, 255, 255, 0.68);
  }

  .deliver-card-active {
    border-color: rgba(74, 222, 179, 0.2);
    background: rgba(74, 222, 179, 0.08);
  }

  .story-copy {
    display: grid;
    gap: 16px;
  }

  .story-beat {
    min-height: 68vh;
    padding: 28px;
    border-radius: 30px;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
    transition: border-color 220ms ease, transform 220ms var(--ease-out), background 220ms ease;
  }

  :global(:not(.dark)) .story-beat {
    background: rgba(255, 255, 255, 0.54);
  }

  .story-beat-active {
    transform: translateY(-4px);
    border-color: rgba(53, 212, 255, 0.16);
    background: rgba(53, 212, 255, 0.05);
  }

  .beat-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .story-beat h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2rem, 3vw, 3rem);
    line-height: 1.04;
    letter-spacing: -0.04em;
    text-wrap: balance;
  }

  .story-beat p {
    margin: 0;
    max-width: 30rem;
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-2);
  }

  .beat-foot {
    display: grid;
    gap: 12px;
  }

  .beat-foot strong {
    font-size: 15px;
    color: var(--text-1);
  }

  .beat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .beat-chips span {
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--raised);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  @keyframes sweep {
    0%, 100% { width: 58%; }
    50% { width: 88%; }
  }

  @media (max-width: 1080px) {
    .story-grid {
      grid-template-columns: 1fr;
    }

    .story-stage {
      position: relative;
      top: 0;
    }

    .story-beat {
      min-height: auto;
    }
  }

  @media (max-width: 760px) {
    .story {
      padding: 88px 18px 26px;
    }

    .stage-frame {
      padding: 18px;
      min-height: auto;
    }

    .stage-panels {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .story-beat {
      padding: 22px;
    }
  }
</style>
