<script lang="ts">
  import { uiStore } from '$stores/ui'
  import { scale, fade } from 'svelte/transition'
  import { createEventDispatcher } from 'svelte'
  import { quintOut } from 'svelte/easing'

  export let title = ''
  export let showClose = true

  const dispatch = createEventDispatcher<{ close: void }>()

  function close() {
    uiStore.closeModal()
    dispatch('close')
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $uiStore.modalOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-[8000] flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
    on:click={handleBackdropClick}
    role="presentation"
    style="background: rgba(8,8,16,0.8); backdrop-filter: blur(8px);"
  >
    <!-- Modal panel -->
    <div
      transition:scale={{ duration: 280, easing: quintOut, start: 0.95 }}
      class="nb-card w-full max-w-md relative"
      style="max-height: 90vh; overflow-y: auto;"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
    >
      {#if title || showClose}
        <div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          {#if title}
            <h2 class="font-display font-semibold text-base text-slate-100">{title}</h2>
          {/if}
          {#if showClose}
            <button
              class="btn-icon ml-auto"
              on:click={close}
              aria-label="Close"
            >
              <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M4 4l8 8M12 4l-8 8"/>
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <div class="px-6 py-5">
        <slot />
      </div>
    </div>
  </div>
{/if}
