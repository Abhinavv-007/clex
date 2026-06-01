<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { uiStore } from '$stores/ui'
  import { siteRoutes } from '$utils'
  import { pickupToken } from '$transfer/gdrive'
  import FileList from '$components/workspace/FileList.svelte'
  import ToolChain from '$components/workspace/ToolChain.svelte'
  import SharePanel from '$components/workspace/SharePanel.svelte'
  import ReceiveAccessCard from '$components/sharing/ReceiveAccessCard.svelte'
  import TransferQueue from '$components/sharing/TransferQueue.svelte'
  import { initChainInstrumentation, createChainClient } from '$chain/instrument'

  export let receiveBasePath = siteRoutes.receive
  export let receivePathFormat: 'segment' | 'query' = 'segment'
  export let receiveEntryHref = siteRoutes.receive
  /** Chain API base URL — pass from the mounting script. Empty string = same origin (production). */
  export let chainApiUrl = ''

  $: activePanel = $uiStore.activePanel

  let unsubChain: (() => void) | undefined

  onMount(() => {
    void pickupToken().catch((error) => {
      const message = error instanceof Error ? error.message : 'Google Drive connection could not be restored'
      uiStore.toast({ type: 'error', message })
    })

    const client = createChainClient(chainApiUrl)
    unsubChain = initChainInstrumentation(client)
  })

  onDestroy(() => {
    unsubChain?.()
  })

  const panels: { id: 'files' | 'tools' | 'share'; label: string }[] = [
    { id: 'files', label: 'Files' },
    { id: 'tools', label: 'Prepare' },
    { id: 'share', label: 'Share' },
  ]
</script>

<div class="ws-page">
  <div class="ws-inner">
    <div class="ws-header">
      <div class="ws-title-block">
        <h1 class="ws-title"><span>File</span> <em>workspace</em></h1>
        <p class="ws-sub">Drop, prepare, and send files from one fluid private workspace.</p>
      </div>

      <div class="ws-mobile-tabs">
        {#each panels as panel}
          <button
            class="wmt-btn"
            class:wmt-active={activePanel === panel.id}
            on:click={() => uiStore.setPanel(panel.id)}
          >
            {panel.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="ws-grid">
      <aside class="ws-col ws-col-files">
        <FileList {receiveEntryHref} />
      </aside>

      <section class="ws-col">
        <ToolChain />
      </section>

      <aside class="ws-col ws-col-sticky ws-col-share">
        <SharePanel {receiveBasePath} {receivePathFormat} />
      </aside>

      <aside class="ws-qr-slot ws-col-sticky">
        <ReceiveAccessCard {receiveBasePath} {receivePathFormat} size={168} />
      </aside>
    </div>

    <div class="ws-mobile-panel">
      <div class="ws-col">
        {#if activePanel === 'files'}
          <FileList {receiveEntryHref} />
        {:else if activePanel === 'tools'}
          <ToolChain />
        {:else}
          <SharePanel {receiveBasePath} {receivePathFormat} />
        {/if}
      </div>
    </div>

    <div class="ws-queue-row">
      <TransferQueue />
    </div>
  </div>
</div>

<style>
  .ws-page {
    padding:
      calc(88px + env(safe-area-inset-top, 0px))
      calc(16px + env(safe-area-inset-right, 0px))
      calc(48px + env(safe-area-inset-bottom, 0px))
      calc(16px + env(safe-area-inset-left, 0px));
    min-height: 100vh;
  }

  .ws-inner {
    max-width: 1420px;
    margin: 0 auto;
  }

  .ws-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    gap: 16px;
    min-width: 0;
  }

  .ws-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2.8rem, 7vw, 6.2rem);
    line-height: 0.92;
    font-weight: 900;
    color: var(--text-1);
    letter-spacing: -0.055em;
    text-wrap: balance;
  }

  .ws-title em {
    display: inline-block;
    font-family: var(--font-italic);
    font-style: normal;
    font-weight: 400;
    letter-spacing: 0;
    color: transparent;
    background: linear-gradient(135deg, #6b4dff 0%, #ff7a3d 54%, #ffb800 100%);
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 10px 24px rgba(255,122,61,0.16));
  }

  .ws-sub {
    max-width: 44rem;
    font-size: clamp(1rem, 1.7vw, 1.35rem);
    color: var(--text-2);
    margin: 10px 0 0;
    line-height: 1.45;
  }

  .ws-mobile-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--surface-2);
    border: 2px solid var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
    border-radius: 12px;
  }

  @media (min-width: 768px) {
    .ws-mobile-tabs { display: none; }
  }

  .wmt-btn {
    padding: 5px 14px;
    border-radius: 8px;
    border: 2px solid transparent;
    background: transparent;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    transition: all 0.15s;
    min-width: 0;
    flex: 1 1 0;
  }

  .wmt-active {
    background: var(--surface);
    border-color: var(--border-hard);
    color: var(--text-1);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .ws-grid {
    display: none;
    grid-template-columns: 280px minmax(360px, 1fr) 248px 236px;
    gap: 12px;
    align-items: start;
  }

  @media (min-width: 768px) {
    .ws-grid { display: grid; }
  }

  .ws-col {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 24px;
    min-height: calc(100vh - 160px);
    min-width: 0;
  }

  .ws-col-sticky {
    position: sticky;
    top: 80px;
    min-height: auto;
    max-height: calc(100vh - 100px);
  }

  .ws-col-share {
    min-height: auto;
  }

  .ws-col-files {
    position: sticky;
    top: 80px;
    min-height: auto;
    max-height: calc(100vh - 100px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ws-qr-slot {
    position: sticky;
    top: 80px;
    align-self: start;
    min-width: 0;
  }

  .ws-queue-row {
    margin-top: 16px;
  }

  .ws-mobile-panel { display: block; }

  @media (min-width: 768px) {
    .ws-mobile-panel { display: none; }
  }

  @media (max-width: 767px) {
    .ws-page {
      padding:
        calc(82px + env(safe-area-inset-top, 0px))
        calc(12px + env(safe-area-inset-right, 0px))
        calc(32px + env(safe-area-inset-bottom, 0px))
        calc(12px + env(safe-area-inset-left, 0px));
    }

    .ws-header {
      flex-direction: column;
      align-items: stretch;
    }

    .ws-mobile-tabs {
      width: 100%;
    }

    .ws-col {
      padding: 16px;
      min-height: auto;
      overflow-x: clip;
    }
  }
</style>
