<script lang="ts">
  import { onMount } from 'svelte'

  type ChainStep = {
    label: string
    detail: string
    explanation: string
    highlight: string
    accent?: boolean
    final?: boolean
  }

  const steps: ChainStep[] = [
    {
      label: 'Drop',
      detail: 'photo.jpg (4.2MB)',
      explanation:
        'Start with the original file in the workspace. Clex detects the type immediately and suggests the most useful next actions without uploading anything.',
      highlight: 'Detected as image input and ready for browser-side processing.',
    },
    {
      label: 'Compress',
      detail: '→ 890KB',
      explanation:
        'Compression reduces the payload before you send it. That means faster transfer, lower bandwidth use, and a cleaner handoff for large image sets.',
      highlight: 'Cuts the file down from 4.2MB to 890KB before delivery.',
      accent: true,
    },
    {
      label: 'Convert',
      detail: '→ WebP',
      explanation:
        'Format conversion lets you move into a lighter or more compatible output without leaving the chain. The output of compression becomes the input here automatically.',
      highlight: 'Transforms the optimized file into WebP for smaller final output.',
      accent: true,
    },
    {
      label: 'Merge PDF',
      detail: '+ 2 pages',
      explanation:
        'If the workflow needs packaging into a document, the converted asset can be merged into a PDF flow with other pages. Clex keeps the chain intact instead of making you restart.',
      highlight: 'Adds two supporting pages into the same deliverable.',
      accent: true,
    },
    {
      label: 'ZIP',
      detail: 'bundle.zip',
      explanation:
        'Once the assets are ready, bundle them into one archive so the recipient gets a single clean download instead of multiple loose files.',
      highlight: 'Creates one export package that is easier to send and receive.',
      accent: true,
    },
    {
      label: 'Share',
      detail: 'P2P Transfer',
      explanation:
        'The finished output moves into delivery. Clex selects the best route, and here the transfer resolves to direct browser-to-browser sharing for the fastest private path.',
      highlight: 'Routes the final package through direct P2P transfer.',
      final: true,
    },
  ]

  let activeIndex = 0
  let autoCycle = true
  $: activeStep = steps[activeIndex]

  function selectStep(index: number) {
    activeIndex = index
    autoCycle = false
  }

  onMount(() => {
    const timer = setInterval(() => {
      if (!autoCycle) return
      activeIndex = activeIndex === steps.length - 1 ? 0 : activeIndex + 1
    }, 2200)

    return () => clearInterval(timer)
  })
</script>

<div class="cfm-shell">
  <div class="cfm-root" role="group" aria-label="Tool chaining flow">
    {#each steps as step, index}
      <button
        type="button"
        class="cfm-step"
        class:cfm-step--accent={step.accent || index === activeIndex}
        class:cfm-step--active={index === activeIndex}
        class:cfm-step--final={step.final}
        aria-expanded={index === activeIndex}
        aria-pressed={index === activeIndex}
        on:click={() => selectStep(index)}
      >
        <span class="cfm-step__label">{step.label}</span>
        <span class="cfm-step__detail">{step.detail}</span>
      </button>

      {#if index < steps.length - 1}
        <span class="cfm-connector">→</span>
      {/if}
    {/each}
  </div>

  <div class="cfm-detail-wrap">
    <section class="cfm-detail" aria-live="polite">
      <div class="cfm-detail__eyebrow">Step {activeIndex + 1}</div>
      <div class="cfm-detail__header">
        <h3>{activeStep.label}</h3>
        <span>{activeStep.detail}</span>
      </div>
      <p>{activeStep.explanation}</p>
      <div class="cfm-detail__highlight">{activeStep.highlight}</div>
    </section>
  </div>
</div>

<style>
  .cfm-shell {
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
  }

  .cfm-root {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: flex-start;
    justify-content: center;
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
  }

  .cfm-step {
    min-width: 132px;
    padding: 16px 18px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--text-1);
    cursor: pointer;
    text-align: center;
    box-sizing: border-box;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      background 180ms ease,
      border-color 180ms ease;
  }

  .cfm-step__label,
  .cfm-step__detail {
    display: block;
  }

  .cfm-step__detail {
    margin-top: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .cfm-step:hover {
    transform: translate(-2px, -2px);
    box-shadow: var(--shadow-md);
  }

  .cfm-step--accent {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    box-shadow: var(--shadow-md);
  }

  .cfm-step--active {
    border-color: var(--accent);
    transform: translate(-3px, -3px);
    box-shadow: var(--shadow-md);
  }

  .cfm-step--final {
    background: var(--accent);
    color: #000;
  }

  .cfm-step--final .cfm-step__detail {
    color: rgba(0, 0, 0, 0.72);
  }

  .cfm-connector {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--text-3);
    line-height: 1;
    padding-top: 18px;
  }

  .cfm-detail {
    padding: 18px 20px;
    border: 2px solid color-mix(in srgb, var(--accent) 38%, var(--border-hard));
    border-radius: 18px;
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    box-shadow: var(--shadow-md);
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  .cfm-detail-wrap {
    margin-top: 22px;
    width: 100%;
    max-width: 100%;
    overflow-x: clip;
  }

  .cfm-detail__eyebrow {
    margin-bottom: 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .cfm-detail__header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px 16px;
    margin-bottom: 10px;
  }

  .cfm-detail__header h3 {
    margin: 0;
    font-size: 24px;
    line-height: 1;
    color: var(--text-1);
  }

  .cfm-detail__header span {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
  }

  .cfm-detail p {
    margin: 0 0 14px;
    max-width: 62ch;
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-2);
  }

  .cfm-detail__highlight {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--text-1);
    max-width: 100%;
    align-self: flex-start;
  }

  .cfm-detail__highlight::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--accent);
    flex-shrink: 0;
  }

  @media (max-width: 767px) {
    .cfm-root {
      gap: 10px;
      justify-content: flex-start;
    }

    .cfm-step {
      min-width: calc(50% - 18px);
      flex: 1 1 calc(50% - 18px);
    }

    .cfm-connector {
      display: none;
    }

    .cfm-detail {
      padding: 16px;
      min-height: 250px;
    }

    .cfm-detail__header h3 {
      font-size: 21px;
    }
  }
</style>
