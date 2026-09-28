<script lang="ts">
  /**
   * The receipt at the end of a transfer, as an actual receipt: it prints
   * out when the transfer completes, and it can be kept — saved as an image,
   * shared, or copied as text. It holds no file names and no content.
   */
  import { transferStore } from '$stores/transfer'
  import {
    receiptBars,
    receiptFileName,
    receiptLines,
    receiptPng,
    receiptText,
  } from '$utils/receiptExport'

  $: receipt = $transferStore.receipt
  $: lines = receipt ? receiptLines(receipt) : []
  $: bars = receipt ? receiptBars(receipt) : []

  let note = ''
  let noteTimer: ReturnType<typeof setTimeout> | null = null
  let busy = false

  function flash(message: string) {
    note = message
    if (noteTimer) clearTimeout(noteTimer)
    noteTimer = setTimeout(() => { note = '' }, 1800)
  }

  function midTruncate(value: string, head = 12, tail = 8): string {
    if (value.length <= head + tail + 1) return value
    return `${value.slice(0, head)}…${value.slice(-tail)}`
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text)
      flash(done)
    } catch {
      flash('Copy was blocked by the browser')
    }
  }

  async function saveImage() {
    if (!receipt || busy) return
    busy = true
    try {
      const blob = await receiptPng(receipt)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = receiptFileName(receipt)
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      flash('Saved as an image')
    } catch {
      flash('Could not make the image')
    } finally {
      busy = false
    }
  }

  async function share() {
    if (!receipt || busy) return
    busy = true
    const text = receiptText(receipt)
    try {
      const blob = await receiptPng(receipt)
      const file = new File([blob], receiptFileName(receipt), { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Clex transfer receipt', text })
        flash('Shared')
      } else if (navigator.share) {
        await navigator.share({ title: 'Clex transfer receipt', text })
        flash('Shared')
      } else {
        await copy(text, 'Copied, ready to paste')
      }
    } catch (err) {
      // Closing the share sheet is not an error worth showing.
      if ((err as DOMException)?.name !== 'AbortError') await copy(text, 'Copied, ready to paste')
    } finally {
      busy = false
    }
  }
</script>

{#if receipt}
  <div class="rc">
    <div class="rc-slot" aria-hidden="true"></div>
    <article class="rc-paper" aria-label="Transfer receipt">
      <header class="rc-head">
        <b class="rc-brand">CLEX</b>
        <span class="rc-kind">Transfer receipt</span>
      </header>

      <dl class="rc-lines">
        {#each lines as line, i}
          <div style="--i:{i}"><dt>{line.label}</dt><dd>{line.value}</dd></div>
        {/each}
      </dl>

      {#if receipt.rootHash}
        {@const rootHashValue = receipt.rootHash}
        <button type="button" class="rc-root" title="Copy the proof root" on:click={() => copy(rootHashValue, 'Proof root copied')}>
          <span>Proof root</span>
          <code>{midTruncate(rootHashValue, 10, 6)}</code>
        </button>
      {/if}

      <div class="rc-bars" aria-hidden="true">
        {#each bars as b}<i style="flex:{Math.max(1, b)};opacity:{b ? 1 : 0}"></i>{/each}
      </div>

      <div class="rc-stamp" class:rc-stamp--warn={!receipt.verified}>
        {receipt.verified ? 'Verified · no content kept' : 'Not verified'}
      </div>
      <p class="rc-foot">No file names or contents recorded</p>
    </article>

    <div class="rc-actions">
      <button type="button" class="rc-btn rc-btn--primary" on:click={share} disabled={busy}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 10V2.5M5 5.5 8 2.5l3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Share
      </button>
      <button type="button" class="rc-btn" on:click={saveImage} disabled={busy}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2.5V10M5 7l3 3 3-3M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Image
      </button>
      <button type="button" class="rc-btn" on:click={() => receipt && copy(receiptText(receipt), 'Receipt copied as text')}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M11 5V3.8A1.3 1.3 0 0 0 9.7 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.9A1.3 1.3 0 0 0 3.8 11H5" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
        Text
      </button>
    </div>
    <p class="rc-note" aria-live="polite">{note}</p>
  </div>
{/if}

<style>
  .rc {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  /* The printer's slot the receipt comes out of. */
  .rc-slot {
    width: calc(100% - 8px);
    max-width: 320px;
    height: 8px;
    border-radius: 6px;
    background: linear-gradient(180deg, #151412, #2a2925);
    box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.7);
  }

  .rc-paper {
    --tooth: 7px;
    position: relative;
    display: grid;
    gap: 10px;
    width: calc(100% - 24px);
    max-width: 296px;
    margin-top: -8px;
    padding: 20px 16px 18px;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.05), transparent 18px),
      #fbfaf5;
    color: #2a2823;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.35;
    filter: drop-shadow(0 12px 18px rgba(40, 32, 18, 0.16));
    -webkit-mask:
      conic-gradient(from -45deg at 50% 100%, #0000, #000 1deg 89deg, #0000 90deg) 50% 100% / calc(var(--tooth) * 2) 51% repeat-x,
      conic-gradient(from 135deg at 50% 0, #0000, #000 1deg 89deg, #0000 90deg) 50% 0 / calc(var(--tooth) * 2) 51% repeat-x;
    mask:
      conic-gradient(from -45deg at 50% 100%, #0000, #000 1deg 89deg, #0000 90deg) 50% 100% / calc(var(--tooth) * 2) 51% repeat-x,
      conic-gradient(from 135deg at 50% 0, #0000, #000 1deg 89deg, #0000 90deg) 50% 0 / calc(var(--tooth) * 2) 51% repeat-x;
    transform-origin: 50% 0;
    animation: rc-print 1100ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  @keyframes rc-print {
    from { clip-path: inset(0 0 100% 0); transform: translateY(-14px); }
    to { clip-path: inset(0 0 -40px 0); transform: none; }
  }

  .rc-head {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding-bottom: 10px;
    border-bottom: 1.5px dashed #b9b3a8;
  }

  .rc-brand {
    font-family: var(--font-sans);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.34em;
    padding-left: 0.34em;
  }

  .rc-kind {
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #6b665c;
  }

  .rc-lines {
    display: grid;
    gap: 4px;
    margin: 0;
    padding-bottom: 10px;
    border-bottom: 1.5px dashed #b9b3a8;
  }

  .rc-lines div {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    animation: rc-line 300ms ease-out both;
    animation-delay: calc(250ms + var(--i) * 60ms);
  }

  @keyframes rc-line {
    from { opacity: 0; }
  }

  .rc-lines dt {
    color: #6b665c;
  }

  .rc-lines dd {
    margin: 0;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rc-root {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: #6b665c;
    cursor: copy;
  }

  .rc-root code {
    color: #2e6a4f;
  }

  .rc-bars {
    display: flex;
    gap: 1.5px;
    height: 28px;
    margin: 2px 4px 0;
  }

  .rc-bars i {
    background: #2a2823;
  }

  .rc-stamp {
    justify-self: center;
    padding: 4px 10px;
    border: 1.5px solid #2e6a4f;
    border-radius: 4px;
    color: #2e6a4f;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transform: rotate(-3deg);
    animation: rc-stamp 420ms cubic-bezier(0.34, 1.36, 0.64, 1) 1100ms both;
  }

  .rc-stamp--warn {
    border-color: #93650f;
    color: #93650f;
  }

  @keyframes rc-stamp {
    from { opacity: 0; transform: rotate(-3deg) scale(1.8); }
  }

  .rc-foot {
    margin: 0;
    text-align: center;
    font-size: 9px;
    color: #9a9488;
  }

  .rc-actions {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 6px;
    width: 100%;
    max-width: 320px;
  }

  .rc-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text-1);
    font-family: var(--font-sans);
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    transition: background 150ms, border-color 150ms, transform 200ms var(--spring);
  }

  .rc-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: var(--border-focus);
  }

  .rc-btn:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .rc-btn--primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-fg);
  }

  .rc-note {
    min-height: 1.2em;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .rc-paper,
    .rc-lines div,
    .rc-stamp {
      animation: none;
    }
  }
</style>
