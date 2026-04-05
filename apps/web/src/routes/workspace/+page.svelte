<script lang="ts">
  import { uiStore } from '$stores/ui'
  import FileList from '$components/workspace/FileList.svelte'
  import ToolChain from '$components/workspace/ToolChain.svelte'
  import SharePanel from '$components/workspace/SharePanel.svelte'

  $: activePanel = $uiStore.activePanel

  const panels: { id: 'files' | 'tools' | 'share'; label: string }[] = [
    { id: 'files', label: 'Files' },
    { id: 'tools', label: 'Prepare' },
    { id: 'share', label: 'Share' },
  ]
</script>

<svelte:head>
  <title>Workspace — Clex</title>
</svelte:head>

<div class="ws-page">
  <div class="ws-inner">

    <!-- Page header -->
    <div class="ws-header">
      <div class="ws-title-block">
        <h1 class="ws-title">Workspace</h1>
        <p class="ws-sub">Prepare and share your files</p>
      </div>

      <!-- Mobile panel tabs -->
      <div class="ws-mobile-tabs">
        {#each panels as p}
          <button
            class="wmt-btn"
            class:wmt-active={activePanel === p.id}
            on:click={() => uiStore.setPanel(p.id)}
          >
            {p.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Desktop: three-column grid -->
    <div class="ws-grid">
      <aside class="ws-col ws-col-sticky">
        <FileList />
      </aside>
      <section class="ws-col">
        <ToolChain />
      </section>
      <aside class="ws-col ws-col-sticky">
        <SharePanel />
      </aside>
    </div>

    <!-- Mobile: single panel view -->
    <div class="ws-mobile-panel">
      <div class="ws-col">
        {#if activePanel === 'files'}
          <FileList />
        {:else if activePanel === 'tools'}
          <ToolChain />
        {:else if activePanel === 'share'}
          <SharePanel />
        {/if}
      </div>
    </div>

  </div>
</div>

<style>
  .ws-page {
    padding: 88px 16px 48px;
    min-height: 100vh;
  }

  .ws-inner {
    max-width: 1280px;
    margin: 0 auto;
  }

  /* Header */
  .ws-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 16px;
  }

  .ws-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }

  .ws-sub {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 2px;
  }

  /* Mobile tabs */
  .ws-mobile-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  @media (min-width: 768px) {
    .ws-mobile-tabs { display: none; }
  }

  .wmt-btn {
    padding: 5px 14px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    cursor: pointer;
    transition: all 0.15s;
  }

  .wmt-active {
    background: var(--surface);
    border-color: var(--border);
    color: var(--text-1);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  /* Desktop grid */
  .ws-grid {
    display: none;
    grid-template-columns: 300px 1fr 280px;
    gap: 12px;
    align-items: start;
  }

  @media (min-width: 768px) {
    .ws-grid { display: grid; }
  }

  /* Panel card - Obsidian Resonance */
  .ws-col {
    background: rgba(18, 18, 24, 0.4);
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    border-radius: 16px;
    padding: 24px;
    min-height: calc(100vh - 160px);
  }

  .ws-col-sticky {
    position: sticky;
    top: 80px;
    min-height: auto;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  .ws-col-sticky::-webkit-scrollbar { width: 4px; }
  .ws-col-sticky::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

  /* Mobile panel */
  .ws-mobile-panel { display: block; }

  @media (min-width: 768px) {
    .ws-mobile-panel { display: none; }
  }
</style>
