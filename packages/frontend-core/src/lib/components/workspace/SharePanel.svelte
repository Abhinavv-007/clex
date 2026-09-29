<script lang="ts">
  import { hasFiles, filesStore } from '$stores/files'
  import { transferStore, type TransferMethod } from '$stores/transfer'
  import { uiStore } from '$stores/ui'
  import { siteRoutes } from '$utils'
  import DirectShare from '$components/sharing/DirectShare.svelte'

  export let receiveBasePath = siteRoutes.receive
  export let receivePathFormat: 'segment' | 'query' = 'segment'

  function setMethod(method: TransferMethod) {
    if (routeLocked || method === activeMethod) return
    transferStore.setMethod(method)
  }

  // Only the sender picks the route. The code they share leads with its
  // letter, so the receiver's browser follows without asking.
  const methods: { id: TransferMethod; label: string; desc: string }[] = [
    { id: 'webrtc', label: 'Direct', desc: 'Any network' },
    { id: 'local',  label: 'Local',  desc: 'Same Wi-Fi' },
  ]

  $: activeMethod = $transferStore.method
  $: readyCount = $filesStore.length
  // The route cannot change under a receiver who is already connecting.
  $: routeLocked = !['idle', 'complete', 'failed'].includes($transferStore.state)
</script>

<div class="sp-root">
  <!-- Header -->
  <div class="sp-header">
    <h2 class="sp-title">Share</h2>
    <p class="sp-sub">
      {#if $hasFiles}
        {readyCount} file{readyCount !== 1 ? 's' : ''} ready to send
      {:else}
        Choose how to send your files
      {/if}
    </p>
  </div>

  {#if !$hasFiles}
    <div class="sp-empty-state">
      <p>Add files in the Files tab first, then come back here to send them.</p>
      <button class="btn-secondary sp-empty-btn" on:click={() => uiStore.setPanel('files')}>
        Go to Files
      </button>
    </div>
  {/if}

  <!-- Route: the sender's choice, carried to the receiver by the code -->
  <div class="sp-tabs" role="radiogroup" aria-label="Route">
    {#each methods as m}
      <button
        class="sp-tab"
        class:sp-tab-active={activeMethod === m.id}
        role="radio"
        aria-checked={activeMethod === m.id}
        disabled={routeLocked && activeMethod !== m.id}
        on:click={() => setMethod(m.id)}
      >
        <span class="sp-tab-label">{m.label}</span>
        <span class="sp-tab-desc">{m.desc}</span>
      </button>
    {/each}
  </div>
  <p class="sp-route-note">The receiver follows your choice on its own</p>

  <!-- Content -->
  <div class="sp-content" class:sp-content-disabled={!$hasFiles}>
    <DirectShare {receiveBasePath} {receivePathFormat} />
  </div>
</div>

<style>
  .sp-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-width: 0;
  }

  .sp-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .sp-sub {
    font-size: 12px;
    color: var(--text-2);
    margin-top: 2px;
  }

  .sp-empty-state {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    background: var(--surface-2);
    border: 1.5px dashed var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow-sm);
  }

  .sp-empty-state p {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-2);
  }

  .sp-empty-btn {
    width: 100%;
    justify-content: center;
  }

  /* Tabs */
  .sp-tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    padding: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow-sm);
    border-radius: 12px;
    min-width: 0;
  }

  .sp-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 8px 4px;
    min-width: 0;
    text-align: center;
    border-radius: 8px;
    border: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sp-tab:hover:not(.sp-tab-active) {
    background: var(--surface);
  }

  .sp-tab-active {
    background: var(--surface);
    border-color: var(--border-hard);
    box-shadow: var(--shadow-sm);
  }

  .sp-tab:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }




  .sp-route-note {
    margin: -8px 2px 0;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-3);
    text-align: center;
  }

  .sp-tab-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    transition: color 0.15s;
  }

  .sp-tab-active .sp-tab-label { color: var(--text-1); }

  .sp-tab-desc {
    font-size: 10px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    color: var(--text-3);
    letter-spacing: 0.04em;
    font-weight: 500;
  }

  /* Content area */
  .sp-content {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
    min-width: 0;
  }

  .sp-content.sp-content-disabled {
    opacity: 0.55;
    pointer-events: none;
  }

  .sp-content::-webkit-scrollbar { width: 4px; }
  .sp-content::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

  @media (max-width: 767px) {
    .sp-root {
      gap: 14px;
    }

    .sp-tabs {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--surface);
    }

    .sp-content {
      overflow: visible;
    }

  }
</style>
