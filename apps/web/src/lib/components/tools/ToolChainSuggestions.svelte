<script lang="ts">
  import type { ChainSuggestion } from '$stores/tools'
  import { TOOLS } from '$tools/chain'
  import { createEventDispatcher } from 'svelte'
  import { slide } from 'svelte/transition'

  export let suggestions: ChainSuggestion[] = []

  const dispatch = createEventDispatcher<{
    selectTool: string
    share: void
  }>()

  function handleClick(s: ChainSuggestion) {
    if (s.toolId === 'share') {
      dispatch('share')
    } else {
      dispatch('selectTool', s.toolId)
    }
  }

  const iconMap: Record<string, string> = {
    'image-compress': '🗜',
    'image-convert': '🔄',
    'pdf-merge': '📎',
    'pdf-split': '✂️',
    'pdf-to-image': '🖼',
    'word-to-pdf': '📄',
    'zip': '📦',
    'share': '🚀',
  }
</script>

{#if suggestions.length}
  <div transition:slide={{ duration: 200 }} class="mt-4">
    <p class="text-[11px] text-slate-500 uppercase tracking-widest font-display mb-3">What's next</p>
    <div class="flex flex-col gap-2">
      {#each suggestions as s, i}
        <button
          class="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200
                 glass-panel-hover enter enter-delay-{Math.min(i + 1, 5)}"
          on:click={() => handleClick(s)}
        >
          <span class="text-base w-7 text-center flex-shrink-0">{iconMap[s.toolId] ?? '✦'}</span>
          <div class="min-w-0">
            <p class="font-display font-semibold text-sm text-slate-200">{s.label}</p>
            <p class="text-xs text-slate-500 truncate">{s.description}</p>
          </div>
          <span class="ml-auto text-slate-600 text-sm flex-shrink-0">→</span>
        </button>
      {/each}
    </div>
  </div>
{/if}
