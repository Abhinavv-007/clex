<script lang="ts">
  /**
   * A handwritten word inside the apps, in the same hand the site draws
   * (Bodoni Moda Italic, written on like Apple's "hello"). The markup is built ahead
   * of time by apps/web/scripts/hand-words.mjs into hand/words.json; a word
   * not in that list falls back to plain text. It writes itself when it
   * appears, and again when the text changes.
   */
  import { onMount, tick } from 'svelte'
  import words from '../../hand/words.json'
  import { writeInk } from '../../hand/pen.js'

  export let text: string
  /** Size relative to the surrounding text. */
  export let scale = 1.2
  /** Wait before writing, in ms. */
  export let delay = 0

  let host: HTMLSpanElement
  let mounted = false
  const uid = `hw${Math.random().toString(36).slice(2, 8)}`
  const table = words as Record<string, string>

  $: html = table[text]?.replace(/__ID__/g, `${uid}${text.length}`) ?? ''
  $: if (mounted && html) void write()

  async function write() {
    await tick()
    const svg = host?.querySelector('svg.ink')
    if (!(svg instanceof SVGSVGElement)) return
    window.setTimeout(() => writeInk(svg), delay)
  }

  onMount(() => {
    mounted = true
  })
</script>

<span class="hello-word" style="font-size: {scale}em" bind:this={host}>
  {#if html}{@html html}{:else}{text}{/if}
</span>

<style>
  .hello-word {
    display: inline-block;
    line-height: 0;
  }

  .hello-word :global(.ink) {
    display: inline-block;
    overflow: visible;
  }

  .hello-word :global(.ink__a) { stop-color: var(--script-a, #1f6446); }
  .hello-word :global(.ink__b) { stop-color: var(--script-b, #2f8a60); }
  .hello-word :global(.ink__c) { stop-color: var(--script-c, #a8792a); }

  .hello-word :global(.ink__letters) {
    stroke-linejoin: round;
  }

  .hello-word :global(.ink:not(.is-writing):not(.is-written) .ink__pen path) {
    opacity: 0;
  }

  .hello-word :global(.ink.is-written .ink__letters) {
    mask: none;
  }

  .hello-word :global(.visually-hidden) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
