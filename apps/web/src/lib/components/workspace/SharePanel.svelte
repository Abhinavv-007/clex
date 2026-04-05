<script lang="ts">
  import { transferStore, type TransferMethod } from '$stores/transfer'
  import DirectShare from '$components/sharing/DirectShare.svelte'
  import DriveShare from '$components/sharing/DriveShare.svelte'

  let activeMethod: TransferMethod = 'webrtc'

  function setMethod(method: TransferMethod) {
    activeMethod = method
    transferStore.setMethod(method)
  }

  const methods: { id: TransferMethod; label: string; desc: string }[] = [
    { id: 'webrtc', label: 'Direct',  desc: 'P2P' },
    { id: 'local',  label: 'Local',   desc: 'LAN' },
    { id: 'drive',  label: 'Drive',   desc: 'Cloud' },
  ]
</script>

<div class="sp-root">
  <!-- Header -->
  <div class="sp-header">
    <h2 class="sp-title">Share</h2>
    <p class="sp-sub">Choose how to send your files</p>
  </div>

  <!-- Method tabs -->
  <div class="sp-tabs">
    {#each methods as m}
      <button
        class="sp-tab"
        class:sp-tab-active={activeMethod === m.id}
        on:click={() => setMethod(m.id)}
      >
        <span class="sp-tab-label">{m.label}</span>
        <span class="sp-tab-desc">{m.desc}</span>
      </button>
    {/each}
  </div>

  <!-- Content -->
  <div class="sp-content">
    {#if activeMethod === 'webrtc' || activeMethod === 'local'}
      <DirectShare />
    {:else if activeMethod === 'drive'}
      <DriveShare />
    {/if}
  </div>

  <!-- Receive divider -->
  <div class="sp-receive">
    <span class="sp-receive-label">Receiving files?</span>
    <a href="/receive" class="btn-secondary sp-receive-btn">
      Enter room code
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>
  </div>
</div>

<style>
  .sp-root {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  .sp-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .sp-sub {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 2px;
  }

  /* Tabs */
  .sp-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 4px;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .sp-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 7px 4px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .sp-tab:hover:not(.sp-tab-active) {
    background: var(--surface);
  }

  .sp-tab-active {
    background: var(--surface);
    border-color: var(--border);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  :global(.dark) .sp-tab-active {
    box-shadow: 0 1px 6px rgba(0,0,0,0.3);
  }

  .sp-tab-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    transition: color 0.15s;
  }

  .sp-tab-active .sp-tab-label { color: var(--text-1); }

  .sp-tab-desc {
    font-size: 9px;
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
  }

  .sp-content::-webkit-scrollbar { width: 4px; }
  .sp-content::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

  /* Receive footer */
  .sp-receive {
    padding-top: 12px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sp-receive-label {
    font-size: 11px;
    color: var(--text-3);
    text-align: center;
  }

  .sp-receive-btn {
    width: 100%;
    justify-content: center;
    font-size: 12px;
    gap: 6px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    text-decoration: none;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    color: var(--text-2);
    transition: background 0.15s, color 0.15s;
    background: transparent;
  }

  .sp-receive-btn:hover {
    background: var(--raised);
    color: var(--text-1);
  }
</style>
