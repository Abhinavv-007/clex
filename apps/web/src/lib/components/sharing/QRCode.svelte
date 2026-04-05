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
        margin: 1,
        color: { dark: '#000000', light: '#00000000' },
      })
      // Make the dark blocks use the current text color so it adapts to light/dark mode automatically
      svgContent = rawSvg.replace(/fill="#000000"/g, 'fill="currentColor"')
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
    color: var(--text-1); /* This passes down to currentColor */
  }

  .qr-container :global(svg) {
    width: 100%;
    height: 100%;
    border-radius: 8px;
  }
</style>
