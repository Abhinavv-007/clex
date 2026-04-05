<script lang="ts">
  import type { ToolResult } from '$stores/tools'
  import { toolsStore } from '$stores/tools'
  import ToolChainSuggestions from './ToolChainSuggestions.svelte'
  import { formatBytes } from '$utils/format'
  import { createEventDispatcher } from 'svelte'

  export let result: ToolResult

  const dispatch = createEventDispatcher<{
    selectTool: string
    share: void
  }>()

  function download() {
    const a = document.createElement('a')
    a.href = result.outputUrl
    a.download = result.outputName
    a.click()
  }

  $: isImage = result.outputType.startsWith('image/')
</script>

<div class="glass-panel p-5 flex flex-col gap-4">
  <!-- Header -->
  <div class="flex items-start justify-between gap-3">
    <div class="flex items-start gap-3">
      <!-- Preview thumbnail -->
      {#if isImage}
        <div class="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
          <img src={result.outputUrl} alt={result.outputName} class="w-full h-full object-cover" loading="lazy" />
        </div>
      {:else}
        <div
          class="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style="background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.2);"
        >
          {result.outputType === 'application/pdf' ? '📄' :
           result.outputType === 'application/zip' ? '📦' : '📎'}
        </div>
      {/if}

      <div class="min-w-0">
        <p class="font-display font-semibold text-sm text-slate-100 truncate">{result.outputName}</p>
        <p class="text-xs text-slate-500 mt-0.5">{formatBytes(result.outputBlob.size)}</p>
        <span class="badge badge-green mt-1.5">✓ Ready</span>
      </div>
    </div>

    <!-- Reset -->
    <button class="btn-icon w-7 h-7 flex-shrink-0" on:click={() => toolsStore.reset()} title="Clear result">
      <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M2 2l10 10M12 2l-10 10" />
      </svg>
    </button>
  </div>

  <!-- Download button -->
  <button class="btn-primary w-full justify-center flex items-center gap-2 py-3" on:click={download}>
    <span>↓</span>
    Download
  </button>

  <!-- Chain suggestions -->
  <ToolChainSuggestions
    suggestions={result.suggestions}
    on:selectTool={e => dispatch('selectTool', e.detail)}
    on:share={() => dispatch('share')}
  />
</div>
