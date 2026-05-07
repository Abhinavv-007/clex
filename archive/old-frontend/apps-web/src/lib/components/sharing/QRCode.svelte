<script lang="ts">
  import { onMount } from 'svelte'
  import QR from 'qrcode'

  export let value: string
  export let size = 180

  let svgContent = ''

  $: if (value) {
    generateQR(value)
  }

  async function generateQR(text: string) {
    try {
      const rawSvg = await QR.toString(text, {
        type: 'svg',
        width: size,
        margin: 1.5,
        color: { dark: '#111111', light: '#FFFFFF' },
      })
      svgContent = rawSvg
    } catch (err) {
      console.error('Failed to generate QR', err)
    }
  }

  onMount(() => {
    if (value) generateQR(value)
  })
</script>

<div class="qr-container" style="width: {size}px; height: {size}px;" aria-label="QR code for {value}">
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
    border: 2px solid var(--border-hard, #111111);
    box-shadow: 4px 4px 0 var(--border-hard, #111111);
    overflow: hidden;
    padding: 6px;
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .qr-container:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--border-hard, #111111);
  }

  .qr-container :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
    border-radius: 6px;
  }
</style>
