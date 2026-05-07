<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import type { WebRTCTransfer } from '$transfer/webrtc'

  /** Active transfer instance — controls are no-ops without it. */
  export let transfer: WebRTCTransfer | null = null

  $: state = $transferStore.state
  $: paused = $transferStore.paused
  $: protocol = $transferStore.protocol
  $: showControls = (state === 'transferring' || state === 'connecting') && protocol === 'reliable' && transfer != null

  function pause() { transfer?.pause() }
  function resume() { transfer?.resume() }
  function cancel() { transfer?.cancel() }
</script>

{#if showControls}
  <div class="tc-row">
    {#if paused}
      <button class="tc-btn tc-btn--primary" on:click={resume}>
        ▶ Resume
      </button>
    {:else}
      <button class="tc-btn" on:click={pause}>
        ❚❚ Pause
      </button>
    {/if}
    <button class="tc-btn tc-btn--ghost" on:click={cancel}>
      Cancel
    </button>
  </div>
{/if}

<style>
  .tc-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tc-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-1);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-display);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tc-btn:hover { background: var(--surface); border-color: var(--border-hard); }

  .tc-btn--primary {
    background: var(--text-1);
    color: var(--text-inv);
    border-color: transparent;
  }

  .tc-btn--ghost {
    background: transparent;
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
</style>
