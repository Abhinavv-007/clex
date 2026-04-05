<script lang="ts">
  import { onMount } from 'svelte'
  import QR from 'qrcode'

  export let value: string
  export let size = 180

  let canvas: HTMLCanvasElement

  $: if (canvas && value) {
    QR.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      color: { dark: '#e2e8f0', light: '#00000000' },
    })
  }

  onMount(() => {
    if (value) {
      QR.toCanvas(canvas, value, {
        width: size,
        margin: 1,
        color: { dark: '#e2e8f0', light: '#00000000' },
      })
    }
  })
</script>

<canvas bind:this={canvas} width={size} height={size} class="rounded-lg" aria-label="QR code for {value}" />
