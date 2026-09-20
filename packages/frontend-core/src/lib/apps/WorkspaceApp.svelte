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

  // ── Modes ────────────────────────────────────────────────────────────────
  //
  // Vault used to live at /vault as a separate page. It is one workspace now,
  // with two modes: moving files, and the encrypted notes/secrets store.
  //
  // Vault is loaded on first switch rather than up front. It carries yjs,
  // y-webrtc and the crypto/IndexedDB layer — around 250 kB — and the common
  // case is a visitor who came to send a file and never opens it.
  type Mode = 'transfer' | 'vault'

  export let vaultSignalingUrl = 'wss://signal.clex.in'
  export let vaultApiUrl = '/vault/api'
  /** Start in vault mode — set by /vault, which redirects here. */
  export let initialMode: Mode = 'transfer'

  let mode: Mode = initialMode
  let VaultAppComponent: typeof import('./VaultApp.svelte').default | null = null
  let vaultLoading = false
  let vaultError = ''

  async function loadVault(): Promise<void> {
    if (VaultAppComponent || vaultLoading) return
    vaultLoading = true
    vaultError = ''
    try {
      VaultAppComponent = (await import('./VaultApp.svelte')).default
    } catch (err) {
      vaultError = err instanceof Error ? err.message : 'Vault could not be loaded.'
    } finally {
      vaultLoading = false
    }
  }

  async function setMode(next: Mode): Promise<void> {
    mode = next
    if (next === 'vault') await loadVault()
    if (typeof window === 'undefined') return
    // Reflect the mode in the URL so it survives a reload and can be linked to.
    const url = new URL(window.location.href)
    if (next === 'vault') url.searchParams.set('mode', 'vault')
    else url.searchParams.delete('mode')
    window.history.replaceState({}, '', url)
  }

  onMount(() => {
    if (initialMode === 'vault') void loadVault()
  })
</script>

<div class="ws-page" class:ws-page--vault={mode === 'vault'}>
  <div class="ws-inner">
    <div class="ws-header" class:ws-header--compact={mode === 'vault'}>
      {#if mode === 'transfer'}
        <div class="ws-title-block">
          <h1 class="ws-title"><span>File</span> <em>workspace</em></h1>
          <p class="ws-sub">Drop, prepare, and send files from one fluid private workspace.</p>
        </div>
      {:else}
        <!-- Vault renders its own heading, and it changes with the active
             panel, so the workspace title would only duplicate it. -->
        <div class="ws-title-block ws-title-block--empty" aria-hidden="true"></div>
      {/if}

      <div class="ws-modes" role="tablist" aria-label="Workspace mode">
        <button
          class="ws-mode"
          class:ws-mode--active={mode === 'transfer'}
          role="tab"
          aria-selected={mode === 'transfer'}
          type="button"
          on:click={() => setMode('transfer')}
        >Transfer</button>
        <button
          class="ws-mode"
          class:ws-mode--active={mode === 'vault'}
          role="tab"
          aria-selected={mode === 'vault'}
          type="button"
          on:click={() => setMode('vault')}
        >Vault</button>
      </div>

      {#if mode === 'transfer'}
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
      {/if}
    </div>

    {#if mode === 'vault'}
      <div class="ws-vault-slot">
        {#if VaultAppComponent}
          <svelte:component
            this={VaultAppComponent}
            signalingUrl={vaultSignalingUrl}
            {vaultApiUrl}
          />
        {:else if vaultError}
          <p class="ws-vault-msg ws-vault-msg--error">
            {vaultError}
            <button class="ws-vault-retry" type="button" on:click={loadVault}>Retry</button>
          </p>
        {:else}
          <p class="ws-vault-msg">Opening your vault…</p>
        {/if}
      </div>
    {:else}
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
    {/if}
  </div>
</div>

<style>
  .ws-page {
    /* Gutter + width track the site container so the app lines up with the
       nav and the sections around it; at 16px/1420px the grid ran edge to
       edge and the last column was clipped by the viewport. */
    padding:
      calc(88px + env(safe-area-inset-top, 0px))
      calc(clamp(1rem, 3vw, 2rem) + env(safe-area-inset-right, 0px))
      calc(48px + env(safe-area-inset-bottom, 0px))
      calc(clamp(1rem, 3vw, 2rem) + env(safe-area-inset-left, 0px));
    min-height: 100vh;
  }

  .ws-inner {
    max-width: var(--container-max, 1280px);
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

  /* ── Mode switch ──────────────────────────────────────────────────────
     Transfer and Vault are two modes of one workspace; Vault used to be a
     separate page at /vault, which now redirects here. */
  .ws-modes {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    border: 2px solid var(--border-hard);
    border-radius: 999px;
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .ws-mode {
    padding: 6px 18px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
    cursor: pointer;
    transition: background 150ms var(--ease-out), color 150ms var(--ease-out);
  }

  .ws-mode:hover { color: var(--text-1); }

  .ws-mode--active {
    background: var(--surface);
    color: var(--text-1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  }

  .ws-vault-slot {
    min-height: 420px;
    margin-top: -0.5rem;
  }

  /* Vault was a standalone page, so it sizes itself to the viewport and
     clears the fixed nav on its own. Embedded here both of those are already
     handled by the workspace around it. */
  .ws-vault-slot :global(.va-page) {
    min-height: 0;
    padding: 0;
    background: transparent;
  }

  .ws-vault-slot :global(.va-inner) {
    max-width: none;
  }

  /* In vault mode the title block is empty (Vault renders its own heading),
     so the header collapses to just the mode switch instead of reserving a
     title's worth of height above it. */
  .ws-title-block--empty {
    flex: 1;
    min-height: 0;
  }

  .ws-header--compact {
    margin-bottom: 4px;
  }

  /* Vault brings its own heading straight away, so it does not need the
     title-sized run-up that the transfer layout leaves under the nav. */
  .ws-page--vault {
    padding-top: calc(var(--nav-clearance, 6.4rem) + 0.5rem) !important;
  }

  .ws-header--compact .ws-modes {
    margin-left: auto;
  }

  .ws-vault-msg {
    padding: 4rem 1rem;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-2);
  }

  .ws-vault-msg--error { color: var(--red-text, var(--red)); }

  .ws-vault-retry {
    margin-left: 0.6rem;
    padding: 4px 12px;
    border: 2px solid var(--border-hard);
    border-radius: 999px;
    background: var(--surface);
    font: inherit;
    color: var(--text-1);
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .ws-mode { transition: none; }
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
    /* Stretch, not start: the columns are panels in one surface and should
       share a bottom edge. The sticky columns opt out individually. */
    align-items: stretch;
  }

  @media (min-width: 1200px) {
    .ws-grid {
      display: grid;
      grid-template-columns: 280px minmax(360px, 1fr) 248px 236px;
      gap: 12px;
    }
  }

  @media (min-width: 768px) and (max-width: 1199px) {
    .ws-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .ws-col-files {
      grid-column: 1 / 2;
      position: relative;
      top: 0;
      max-height: none;
      min-height: auto;
    }

    .ws-col-share {
      grid-column: 2 / 3;
      position: relative;
      top: 0;
      max-height: none;
      min-height: auto;
    }

    .ws-col:not(.ws-col-files):not(.ws-col-share) {
      grid-column: 1 / 3;
      min-height: auto;
    }

    .ws-qr-slot {
      grid-column: 1 / 3;
      justify-self: center;
      position: relative;
      top: 0;
    }
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
    /* Sized to content, floored for visual balance. This was
       `calc(100vh - 160px)`, which forced every column to roughly full
       viewport height — the Prepare column carried hundreds of pixels of
       empty space, and because the sticky columns overrode it with
       `min-height: auto` the four columns ended at four different heights. */
    min-height: 420px;
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
