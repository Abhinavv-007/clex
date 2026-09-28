<script lang="ts">
  import { onMount } from 'svelte'
  import QR from 'qrcode'

  export let value = ''
  export let text = ''
  export let size = 180

  let svgContent = ''
  $: qrValue = value || text

  $: if (qrValue) {
    generateQR(qrValue)
  }

  async function generateQR(text: string) {
    try {
      const rawSvg = await QR.toString(text, {
        type: 'svg',
        width: size,
        margin: 1.5,
        color: { dark: '#1c1b18', light: '#FFFFFF' },
      })
      svgContent = rawSvg
    } catch (err) {
      console.error('Failed to generate QR', err)
    }
  }

  onMount(() => {
    if (qrValue) generateQR(qrValue)
  })
</script>

<div class="qr-container" style="width: {size}px; height: {size}px;" aria-label="QR code for {qrValue}">
  {#if svgContent}
    {@html svgContent}
  {/if}
</div>

<style>
  .qr-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #FFFFFF;
    border-radius: 12px;
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    padding: 6px;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .qr-container:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .qr-container :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 6px;
  }
</style>
