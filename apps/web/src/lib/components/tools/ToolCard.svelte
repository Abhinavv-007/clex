<script lang="ts">
  import type { ToolMeta } from '$tools/chain'
  import { createEventDispatcher } from 'svelte'

  export let tool: ToolMeta
  export let enabled = true
  export let compact = false

  const dispatch = createEventDispatcher<{ select: ToolMeta }>()

  const accentColors: Record<string, string> = {
    'image-compress': '#22d3ee',
    'image-convert': '#22d3ee',
    'pdf-merge': '#f59e0b',
    'pdf-split': '#f59e0b',
    'pdf-to-image': '#f59e0b',
    'word-to-pdf': '#7c3aed',
    'zip': '#8b5cf6',
  }

  $: accent = accentColors[tool.id] ?? '#7c3aed'
</script>

<button
  class="group w-full text-left rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
  class:compact
  class:glass-panel-hover={enabled}
  class:glass-panel={!enabled}
  disabled={!enabled}
  on:click={() => dispatch('select', tool)}
  style="padding: {compact ? '10px 14px' : '16px 18px'};"
>
  <div class="flex items-start gap-3">
    <!-- Icon -->
    <span
      class="flex-shrink-0 text-xl leading-none mt-0.5 w-9 h-9 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
      style="background: {accent}15; border: 1px solid {accent}25;"
    >{tool.icon}</span>

    <div class="min-w-0 flex-1">
      <p class="font-display font-semibold text-sm text-slate-100 leading-tight">{tool.name}</p>
      {#if !compact}
        <p class="text-xs text-slate-500 mt-1 leading-snug">{tool.description}</p>
      {/if}
    </div>

    <!-- Arrow -->
    <span class="text-slate-600 group-hover:text-slate-400 transition-colors text-sm mt-1 flex-shrink-0">→</span>
  </div>
</button>
