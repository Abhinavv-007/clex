<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { uiStore } from '$stores/ui'
  import { transferStore } from '$stores/transfer'
  import { siteRoutes } from '$utils'
  import FileList from '$components/workspace/FileList.svelte'
  import ToolChain from '$components/workspace/ToolChain.svelte'
  import SharePanel from '$components/workspace/SharePanel.svelte'
  import ReceiveAccessCard from '$components/sharing/ReceiveAccessCard.svelte'
  import TransferQueue from '$components/sharing/TransferQueue.svelte'
  import { initChainInstrumentation, createChainClient } from '$chain/instrument'

  /**
   * True while bytes are moving, and while the result is still on screen.
   * The verified receipt is shown after completion and is worth reading, so
   * the column keeps its width rather than snapping back and squeezing the
   * receipt's values into ellipses.
   */
  $: transferActive =
    $transferStore.state === 'transferring' ||
    $transferStore.state === 'connecting' ||
    $transferStore.state === 'complete' ||
    $transferStore.state === 'failed' ||
    $transferStore.paused

  export let receiveBasePath = siteRoutes.receive
  export let receivePathFormat: 'segment' | 'query' = 'segment'
  export let receiveEntryHref = siteRoutes.receive
  /** Chain API base URL — pass from the mounting script. Empty string = same origin (production). */
  export let chainApiUrl = ''

  $: activePanel = $uiStore.activePanel

  let unsubChain: (() => void) | undefined

  onMount(() => {
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
  /** Start in vault mode — set by ?mode=vault (and /vault, which redirects there). */
  export let initialMode: Mode = 'transfer'
  /**
   * Mounted inside the landing page rather than as a page of its own: the
   * page around it supplies the frame and the nav clearance, so the app
   * drops its own page padding and big title for a compact toolbar.
   */
  export let embedded = false

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

    // Anything on the page can ask the workspace to switch — the landing
    // page's "Open Vault" buttons do.
    const onModeRequest = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: Mode }>).detail?.mode
      if (next === 'vault' || next === 'transfer') void setMode(next)
    }
    window.addEventListener('clex:workspace-mode', onModeRequest)
    return () => window.removeEventListener('clex:workspace-mode', onModeRequest)
  })
</script>

<div class="ws-page" class:ws-page--embedded={embedded}>
  <div class="ws-inner">
    <div class="ws-header">
      <div class="ws-title-block">
        {#if mode === 'vault'}
          <h1 class="ws-title"><span>Your</span> <em>vault</em></h1>
          <p class="ws-sub">Encrypted notes, secret links and timed hand-offs — kept on this device.</p>
        {:else}
          <h1 class="ws-title"><span>File</span> <em>workspace</em></h1>
          <p class="ws-sub">Drop, prepare and send files from one private workspace.</p>
        {/if}
      </div>

      <div class="ws-modes" class:ws-modes--vault={mode === 'vault'} role="tablist" aria-label="Workspace mode">
        <span class="ws-modes__pill" aria-hidden="true"></span>
        <button
          class="ws-mode"
          class:ws-mode--active={mode === 'transfer'}
          role="tab"
          aria-selected={mode === 'transfer'}
          type="button"
          on:click={() => setMode('transfer')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 5.5h9M9 3l2.5 2.5L9 8M13.5 10.5h-9M7 8l-2.5 2.5L7 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Transfer
        </button>
        <button
          class="ws-mode"
          class:ws-mode--active={mode === 'vault'}
          role="tab"
          aria-selected={mode === 'vault'}
          type="button"
          on:click={() => setMode('vault')}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
          Vault
        </button>
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
    <div class="ws-grid" class:ws-grid--live={transferActive}>
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
       nav and the sections around it. */
    padding:
      calc(96px + env(safe-area-inset-top, 0px))
      calc(clamp(1rem, 3vw, 2rem) + env(safe-area-inset-right, 0px))
      calc(48px + env(safe-area-inset-bottom, 0px))
      calc(clamp(1rem, 3vw, 2rem) + env(safe-area-inset-left, 0px));
    min-height: 100vh;
  }

  /* Inside the landing page's frame: the frame is the page. */
  .ws-page--embedded {
    min-height: 0;
    padding: clamp(14px, 2vw, 22px);
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
    font-family: var(--font-sans);
    font-size: clamp(2.6rem, 6vw, 5rem);
    line-height: 0.95;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .ws-title em {
    display: inline-block;
    font-family: var(--font-script, var(--font-italic));
    font-style: normal;
    font-weight: 400;
    font-size: 1.45em;
    line-height: 0.8;
    letter-spacing: 0;
    padding: 0 0.08em;
    /* The site's handwriting ink. Sacramento is a hairline, so a touch of
       stroke gives it the weight of the drawn words on the page. */
    color: var(--script-a, var(--accent-text));
    -webkit-text-stroke: 0.02em currentColor;
  }

  .ws-sub {
    max-width: 44rem;
    font-size: clamp(1rem, 1.5vw, 1.2rem);
    color: var(--text-2);
    margin: 10px 0 0;
    line-height: 1.45;
  }

  /* Embedded, the landing page has already said all of that: the header is
     a toolbar — what mode you're in, and the switch. */
  .ws-page--embedded .ws-header {
    margin-bottom: 14px;
  }

  .ws-page--embedded .ws-title {
    font-size: 1.05rem;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .ws-page--embedded .ws-title em {
    font-size: 1.9em;
    line-height: 0.6;
    -webkit-text-stroke: 0.028em currentColor;
  }

  .ws-page--embedded .ws-sub {
    margin-top: 2px;
    font-size: 13px;
    color: var(--text-3);
  }

  /* ── Mode switch ──────────────────────────────────────────────────────
     Transfer and Vault are two modes of one workspace. One pill slides
     between them. */
  .ws-modes {
    position: relative;
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    margin-left: auto;
    flex-shrink: 0;
  }

  .ws-modes__pill {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc(50% - 4px);
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow-sm), 0 0 0 1px var(--border);
    transition: transform 420ms var(--spring);
  }

  .ws-modes--vault .ws-modes__pill {
    transform: translateX(100%);
  }

  .ws-mode {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 108px;
    height: 34px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-3);
    cursor: pointer;
    transition: color 200ms var(--ease-out);
  }

  .ws-mode:hover { color: var(--text-1); }

  .ws-mode--active {
    color: var(--text-1);
  }

  .ws-mode--active svg {
    color: var(--accent-text);
  }

  .ws-vault-slot {
    min-height: 420px;
    animation: fadeUp 420ms var(--ease-out) both;
  }

  /* ── How the boxes read ───────────────────────────────────────────────
     The column is the card; the panel inside it only groups. Dashed means
     droppable and nothing else; empty states get a quiet tint. */
  .ws-page :global(.fl-panel) {
    border: 0;
    border-radius: 12px;
    box-shadow: none;
    background: color-mix(in srgb, var(--surface-2) 60%, transparent);
    padding: 12px;
  }

  .ws-page :global(.fl-empty),
  .ws-page :global(.tc-empty),
  .ws-page :global(.sp-empty-state) {
    border: 0;
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface-2) 72%, transparent);
  }

  .ws-page :global(.dropzone) {
    transition:
      border-color 200ms var(--ease-out),
      background 200ms var(--ease-out),
      transform 300ms var(--spring);
  }

  .ws-page :global(.dropzone:hover) {
    border-color: var(--accent);
    background: var(--accent-dim);
  }

  @media (prefers-reduced-motion: reduce) {
    .ws-page :global(.dropzone),
    .ws-modes__pill,
    .ws-vault-slot { transition: none; animation: none; }
  }

  /* Vault was built as a standalone page, so it clears the nav and sizes
     itself to the viewport. Embedded here the workspace already does both.
     These carry !important because both sides are Svelte-scoped rules of
     equal specificity, so without it which one wins depends on the order the
     bundler happens to emit the two component stylesheets in. */
  .ws-vault-slot :global(.va-page) {
    min-height: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }

  .ws-vault-slot :global(.va-inner) {
    max-width: none !important;
  }

  .ws-vault-slot :global(.va-grid) {
    height: min(72vh, 700px) !important;
    min-height: 520px;
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
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    font: inherit;
    color: var(--text-1);
    cursor: pointer;
  }

  .ws-mobile-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 999px;
  }

  @media (min-width: 768px) {
    .ws-mobile-tabs { display: none; }
  }

  .wmt-btn {
    height: 34px;
    padding: 0 14px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-3);
    cursor: pointer;
    transition: background 200ms ease, color 200ms ease, box-shadow 200ms ease;
    min-width: 0;
    flex: 1 1 0;
  }

  .wmt-active {
    background: var(--surface);
    color: var(--text-1);
    box-shadow: var(--shadow-sm), 0 0 0 1px var(--border);
  }

  .ws-grid {
    display: none;
    align-items: stretch;
  }

  @media (min-width: 1200px) {
    .ws-grid {
      display: grid;
      /* Every track has a floor it can shrink to, and the middle one can
         give all the way to zero, so the row never overflows its frame. */
      grid-template-columns:
        minmax(232px, 280px)
        minmax(0, 1fr)
        minmax(212px, 248px)
        minmax(196px, 236px);
      gap: 12px;
    }

    /* While bytes are moving, progress is the thing the person is watching:
       hand the flexible track to the share column for the duration. */
    .ws-grid--live {
      grid-template-columns:
        minmax(200px, 232px)
        minmax(232px, 288px)
        minmax(0, 1fr)
        minmax(196px, 236px);
    }
  }

  @media (min-width: 768px) and (max-width: 1199px) {
    .ws-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
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
    border: 1px solid var(--border);
    box-shadow: var(--shadow-sm);
    border-radius: 16px;
    padding: 22px;
    min-height: 420px;
    min-width: 0;
    transition: border-color 240ms ease, box-shadow 300ms var(--ease-out);
  }

  .ws-col:focus-within,
  .ws-col:hover {
    border-color: var(--border-strong);
  }

  .ws-page--embedded .ws-col {
    background: color-mix(in srgb, var(--surface-2) 45%, var(--surface));
  }

  .ws-col-sticky {
    position: sticky;
    top: 84px;
    min-height: auto;
    max-height: calc(100vh - 100px);
  }

  .ws-col-share {
    min-height: auto;
  }

  .ws-col-files {
    position: sticky;
    top: 84px;
    min-height: auto;
    max-height: calc(100vh - 100px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ws-qr-slot {
    position: sticky;
    top: 84px;
    align-self: start;
    min-width: 0;
  }

  .ws-queue-row {
    margin-top: 12px;
  }

  .ws-mobile-panel { display: block; }

  @media (min-width: 768px) {
    .ws-mobile-panel { display: none; }
  }

  @media (max-width: 767px) {
    .ws-page {
      padding:
        calc(84px + env(safe-area-inset-top, 0px))
        calc(12px + env(safe-area-inset-right, 0px))
        calc(32px + env(safe-area-inset-bottom, 0px))
        calc(12px + env(safe-area-inset-left, 0px));
    }

    .ws-page--embedded {
      padding: 12px;
    }

    .ws-header {
      flex-direction: column;
      align-items: stretch;
    }

    .ws-page--embedded .ws-header {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .ws-page--embedded .ws-sub {
      display: none;
    }

    .ws-modes {
      width: 100%;
      margin-left: 0;
    }

    .ws-mode {
      min-width: 0;
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
