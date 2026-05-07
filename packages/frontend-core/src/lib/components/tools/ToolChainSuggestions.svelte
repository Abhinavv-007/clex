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
  <div transition:slide={{ duration: 200 }} class="tool-suggestions mt-4">
    <p class="tool-suggestions__label text-[11px] uppercase tracking-widest font-display mb-3">What's next</p>
    <div class="flex flex-col gap-2">
      {#each suggestions as s, i}
        <button
          class="tool-suggestions__item flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200
                 nb-card-surface enter enter-delay-{Math.min(i + 1, 5)}"
          on:click={() => handleClick(s)}
        >
          <span class="text-base w-7 text-center flex-shrink-0">{iconMap[s.toolId] ?? '✦'}</span>
          <div class="min-w-0">
            <p class="tool-suggestions__title font-display font-semibold text-sm">{s.label}</p>
            <p class="tool-suggestions__description text-xs truncate">{s.description}</p>
          </div>
          <span class="tool-suggestions__arrow ml-auto text-sm flex-shrink-0">→</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tool-suggestions__label {
    color: var(--text-3);
  }

  .tool-suggestions__title {
    color: var(--text-1);
  }

  .tool-suggestions__description {
    color: var(--text-2);
  }

  .tool-suggestions__arrow {
    color: var(--text-3);
  }

  .tool-suggestions__item:hover .tool-suggestions__arrow,
  .tool-suggestions__item:focus-visible .tool-suggestions__arrow {
    color: var(--text-1);
  }
</style>
