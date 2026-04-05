<script lang="ts">
  import { uiStore } from '$stores/ui'
  import { fly, fade } from 'svelte/transition'
  import { flip } from 'svelte/animate'

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }
  const colors = {
    success: 'border-green-500/50 text-green-400',
    error: 'border-red-500/50 text-red-400',
    warning: 'border-amber-500/50 text-amber-400',
    info: 'border-violet-500/50 text-violet-400',
  }
  const bgColors = {
    success: 'rgba(34,197,94,0.08)',
    error: 'rgba(239,68,68,0.08)',
    warning: 'rgba(245,158,11,0.08)',
    info: 'rgba(124,58,237,0.08)',
  }
</script>

<div class="fixed bottom-6 right-6 z-[9000] flex flex-col gap-2 items-end" aria-live="polite">
  {#each $uiStore.toasts as toast (toast.id)}
    <button
      animate:flip={{ duration: 200 }}
      in:fly={{ x: 24, duration: 300, delay: 0 }}
      out:fade={{ duration: 200 }}
      class="flex items-start gap-3 max-w-sm px-4 py-3 rounded-xl border backdrop-blur-glass
             text-sm cursor-pointer shadow-glass {colors[toast.type]} text-left w-full"
      style="background: {bgColors[toast.type]};"
      on:click={() => uiStore.dismissToast(toast.id)}
      aria-label="Dismiss notification: {toast.message}"
    >
      <span class="mt-0.5 text-base flex-shrink-0">{icons[toast.type]}</span>
      <span class="text-slate-200 leading-snug">{toast.message}</span>
    </button>
  {/each}
</div>
