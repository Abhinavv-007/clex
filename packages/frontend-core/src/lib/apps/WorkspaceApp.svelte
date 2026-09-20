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

<div class="ws-page">
  <div class="ws-inner">
    <div class="ws-header">
      <div class="ws-title-block">
        {#if mode === 'vault'}
          <h1 class="ws-title"><span>Your</span> <em>vault</em></h1>
          <p class="ws-sub">Encrypted notes, secret links and timed handoffs — kept on this device.</p>
        {:else}
          <h1 class="ws-title"><span>File</span> <em>workspace</em></h1>
          <p class="ws-sub">Drop, prepare, and send files from one fluid private workspace.</p>
        {/if}
      </div>

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
  }

  /* Vault was a standalone page, so it sizes itself to the viewport and
     clears the fixed nav on its own. Embedded here both of those are already
     handled by the workspace around it. */
  /* ── How the boxes read ───────────────────────────────────────────────
     Two things were making the panels feel busier than they are, and both
     are layout decisions, which is why they are settled here rather than in
     each component.

     1. A card inside a card. Each .ws-col is already a bordered, shadowed
        surface; .fl-panel drew a second 1.5px frame just inside it, so the
        Files column read as two nested boxes. The column is the card — the
        panel inside it only needs to group.

     2. A dashed border meant two different things. It marked the drop zone
        (where dashed is the convention and says "you can drop here") and it
        also marked every empty state (where it says nothing, and just looks
        unfinished). Dashed now means droppable; empty states get a quiet
        tint instead. */
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

  /* The drop zone keeps its dashed edge — that is the one place it earns
     its meaning — and now responds when you approach it. */
  .ws-page :global(.dropzone) {
    transition:
      border-color 180ms var(--ease-out),
      background 180ms var(--ease-out);
  }

  .ws-page :global(.dropzone:hover) {
    border-color: var(--border-hard);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .ws-page :global(.dropzone) { transition: none; }
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

  /* The workspace header above already names the mode. Vault's own kicker and
     headline would be a second title in the same view; its panel tabs stay,
     because they are the navigation. */
  .ws-vault-slot :global(.va-title-block) {
    display: none !important;
  }

  .ws-vault-slot :global(.va-shell-header) {
    margin-bottom: 16px !important;
  }

  /* With the title hidden the tabs are the whole row, so they take the width
     rather than sitting at 560px against empty space. */
  .ws-vault-slot :global(.va-panel-switch) {
    width: 100% !important;
    max-width: none !important;
    flex: 1 1 100% !important;
  }

  /* `height: calc(100vh - 152px)` assumed a page sitting directly under the
     nav. Here it clipped the panels and locked them to the viewport
     regardless of content. */
  .ws-vault-slot :global(.va-grid) {
    height: auto !important;
    min-height: min(66vh, 660px);
  }

  .ws-modes { margin-left: auto; }

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
      /* Every track has a floor it can shrink to.
         This was `280px minmax(360px, 1fr) 248px 236px`, which needs
         1160px before gaps. The fixed tracks cannot give, and the flexible
         one refuses to go below its 360px minimum, so in any container
         narrower than that the row simply overflowed — on the landing page
         the frame is 1120px wide, and the last column and its offset shadow
         were clipped off the right edge.
         `minmax(0, 1fr)` lets the middle track absorb the difference, and
         the side tracks have real minima so they compress a little before
         the layout gives up and falls back to the stacked breakpoint. */
      grid-template-columns:
        minmax(232px, 280px)
        minmax(0, 1fr)
        minmax(212px, 248px)
        minmax(196px, 236px);
      gap: 12px;
    }

    /* While bytes are moving, progress is the thing the person is watching —
       but it lived in the narrowest track (212-248px) with the flexible one
       next to it holding an empty tool list. Hand the flexible track to the
       share column for the duration, so the bar, speed, ETA, chunk map and
       health readout have room instead of wrapping into a sliver. */
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
