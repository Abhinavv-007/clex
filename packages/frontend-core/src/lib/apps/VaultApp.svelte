<script lang="ts">
  /**
   * VaultApp — main three-panel vault application
   *
   * Boot sequence:
   * 1. Load/generate master key (IndexedDB)
   * 2. Load all notes + folders from IndexedDB, decrypt
   * 3. Build in-memory search index
   * 4. Initialize yjs sync (non-blocking — works offline without it)
   * 5. Mount three-panel UI
   */
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import VaultSidebar from '$components/vault/VaultSidebar.svelte'
  import VaultEditor from '$components/vault/VaultEditor.svelte'
  import VaultInfoPanel from '$components/vault/VaultInfoPanel.svelte'
  import VaultHeader from '$components/vault/VaultHeader.svelte'
  import VaultSettings from '$components/vault/VaultSettings.svelte'
  import VaultPairingModal from '$components/vault/VaultPairingModal.svelte'
  import VaultSecretCreate from '$components/vault/VaultSecretCreate.svelte'
  import VaultCloudShare from '$components/vault/VaultCloudShare.svelte'
  import Toast from '$components/ui/Toast.svelte'
  import {
    masterKey as masterKeyStore,
    notes,
    folders,
    devices,
    ui,
    syncState,
    vaultActions,
    storageUsed,
  } from '$stores/vault'
  import { getOrCreateMasterKey } from '$lib/vault/crypto'
  import { getAllNotes, getAllFolders, getAllDevices, openVaultDb } from '$lib/vault/db'
  import { decryptText } from '$lib/vault/crypto'
  import { buildSearchIndex } from '$lib/vault/search'
  import { initSync, onSyncState, destroySync } from '$lib/vault/sync'
  import { onVaultAuthChanged } from '$lib/vault/auth'

  export let signalingUrl = 'wss://signal.clex.in'
  export let vaultApiUrl = '/vault/api'

  let offline = !navigator.onLine
  let unsubSync: (() => void) | undefined
  let bootError = ''

  onMount(async () => {
    vaultActions.setLoading(true)

    // Online/offline listener
    window.addEventListener('online', () => (offline = false))
    window.addEventListener('offline', () => (offline = true))

    try {
      await openVaultDb()

      // 1. Load/generate master key
      const mk = await getOrCreateMasterKey()
      vaultActions.setMasterKey(mk)

      // 2. Load all notes + folders from IndexedDB
      const [storedNotes, storedFolders, storedDevices] = await Promise.all([
        getAllNotes(),
        getAllFolders(),
        getAllDevices(),
      ])

      // Decrypt all notes
      const decryptedNotes = await Promise.all(
        storedNotes.map(async (n) => {
          try {
            const [title, body] = await Promise.all([
              decryptText(n.titleBlob, mk.key),
              decryptText(n.bodyBlob, mk.key),
            ])
            return { id: n.id, title, body, createdAt: n.createdAt, updatedAt: n.updatedAt, tags: n.tags, folderId: n.folderId, isPinned: n.isPinned, attachmentIds: n.attachmentIds }
          } catch {
            return { id: n.id, title: '[Encrypted]', body: '', createdAt: n.createdAt, updatedAt: n.updatedAt, tags: n.tags, folderId: n.folderId, isPinned: n.isPinned, attachmentIds: n.attachmentIds }
          }
        })
      )

      vaultActions.setNotes(decryptedNotes)
      vaultActions.setFolders(storedFolders)
      vaultActions.setDevices(storedDevices.filter(d => d.id !== '__self__'))

      // 3. Build search index
      buildSearchIndex(decryptedNotes.map(n => ({ id: n.id, title: n.title, body: n.body, tags: n.tags, updatedAt: n.updatedAt })))

      // 4. Initialize P2P sync (non-blocking)
      initSync(mk.roomId, signalingUrl).catch(() => {
        // Sync unavailable — local-only mode (yjs packages may not be installed)
      })

      unsubSync = onSyncState((state) => {
        vaultActions.setSyncState(state)
      })

      // 5. Restore Firebase auth state (non-blocking — just populates UI)
      onVaultAuthChanged((user) => {
        vaultActions.setGoogleUser(user)
      }).catch(() => {
        // Firebase unavailable — continue without Google auth
      })

    } catch (e: unknown) {
      bootError = e instanceof Error ? e.message : 'Failed to initialize Vault'
      console.error('[vault] boot error:', e)
    } finally {
      vaultActions.setLoading(false)
    }
  })

  onDestroy(() => {
    unsubSync?.()
    destroySync()
  })

  $: loading = $ui.loading
  $: panel = $ui.activePanel
  $: pairingOpen = $ui.pairingModalOpen
  $: infoPanelCollapsed = $ui.infoPanelCollapsed
  $: panelTitle = panel === 'notes'
    ? 'Encrypted notes, secrets, and file handoffs.'
    : panel === 'secrets'
      ? 'Create a one-time link without leaving Vault.'
      : panel === 'share'
        ? 'Publish a short-lived file link with QR access.'
        : 'Manage devices, storage, and recovery controls.'
  $: panelSubtitle = panel === 'notes'
    ? 'Vault should feel like Workspace: direct, dense, and easy to move through.'
    : panel === 'secrets'
      ? 'Short TTL links, QR handoff, and a wider layout for real use instead of a cramped modal.'
      : panel === 'share'
        ? 'The Supabase relay already exists on the backend. This surface puts the 10 MB and 100 MB/day rules into the product.'
        : 'Pair devices, check storage, and control the key lifecycle from the same shell.'

  const panelTabs: { id: 'notes' | 'secrets' | 'share' | 'settings'; label: string }[] = [
    { id: 'notes', label: 'Notes' },
    { id: 'secrets', label: 'Secret Share' },
    { id: 'share', label: 'Cloud Share' },
    { id: 'settings', label: 'Settings' },
  ]
</script>

<Toast />

{#if loading}
  <div class="va-boot" in:fade={{ duration: 200 }}>
    <div class="va-boot-inner">
      <div class="va-boot-logo">⬡</div>
      <div class="va-boot-bar">
        <div class="va-boot-fill"></div>
      </div>
      <p class="va-boot-label">Loading Vault…</p>
    </div>
  </div>

{:else if bootError}
  <div class="va-boot va-boot--error" in:fade={{ duration: 200 }}>
    <div class="va-boot-inner">
      <div class="va-boot-logo">⚠</div>
      <p class="va-boot-label">{bootError}</p>
      <button class="btn-primary" on:click={() => window.location.reload()}>Reload</button>
    </div>
  </div>

{:else}
  <div class="va-page" in:fade={{ duration: 220 }}>
    <div class="va-inner">
      <div class="va-shell-header">
        <div class="va-title-block">
          <p class="va-kicker">Vault</p>
          <h1 class="va-title">{panelTitle}</h1>
          <p class="va-sub">{panelSubtitle}</p>
        </div>

        <div class="va-panel-switch" role="tablist" aria-label="Vault sections">
          {#each panelTabs as item}
            <button
              class="va-panel-tab"
              class:va-panel-tab--active={panel === item.id}
              on:click={() => vaultActions.setPanel(item.id)}
            >
              {item.label}
            </button>
          {/each}
        </div>
      </div>

      {#if panel === 'settings'}
        <div class="va-settings-wrap">
          <VaultSettings storageUsed={$storageUsed} />
        </div>

      {:else if panel === 'secrets'}
        <div class="va-secrets-wrap">
          <VaultSecretCreate {vaultApiUrl} />
        </div>

      {:else if panel === 'share'}
        <div class="va-share-wrap">
          <VaultCloudShare {vaultApiUrl} />
        </div>

      {:else}
        <div class="va-grid" class:va-grid--no-info={infoPanelCollapsed}>
          <aside class="va-col va-col-sidebar">
            <VaultSidebar />
          </aside>

          <main class="va-col va-col-editor">
            <VaultHeader {offline} />
            <VaultEditor />
          </main>

          {#if !infoPanelCollapsed}
            <aside class="va-col va-col-info">
              <VaultInfoPanel />
            </aside>
          {/if}
        </div>

        {#if infoPanelCollapsed}
          <button
            class="va-info-expand btn-icon"
            on:click={vaultActions.toggleInfoPanel}
            title="Show info panel"
            aria-label="Show info panel"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <circle cx="7.5" cy="7.5" r="6"/>
              <path d="M7.5 7v4M7.5 4.5v.2"/>
            </svg>
          </button>
        {/if}
      {/if}
    </div>
  </div>

  {#if pairingOpen}
    <VaultPairingModal {vaultApiUrl} />
  {/if}
{/if}

{#if !loading}
  <div class="va-mobile-tabs">
    <button
      class="va-mtab"
      class:va-mtab--active={panel === 'notes'}
      on:click={() => vaultActions.setPanel('notes')}
    >Notes</button>
    <button
      class="va-mtab"
      class:va-mtab--active={panel === 'secrets'}
      on:click={() => vaultActions.setPanel('secrets')}
    >Secrets</button>
    <button
      class="va-mtab"
      class:va-mtab--active={panel === 'share'}
      on:click={() => vaultActions.setPanel('share')}
    >Cloud</button>
    <button
      class="va-mtab"
      class:va-mtab--active={panel === 'settings'}
      on:click={() => vaultActions.setPanel('settings')}
    >Settings</button>
  </div>
{/if}

<style>
  .va-page {
    padding:
      calc(88px + env(safe-area-inset-top, 0px))
      calc(16px + env(safe-area-inset-right, 0px))
      calc(64px + env(safe-area-inset-bottom, 0px))
      calc(16px + env(safe-area-inset-left, 0px));
    min-height: 100vh;
  }

  .va-inner {
    max-width: 1420px;
    margin: 0 auto;
    position: relative;
  }

  .va-shell-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 20px;
  }

  .va-title-block {
    min-width: 0;
  }

  .va-kicker {
    margin: 0 0 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .va-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2rem, 3.5vw, 3.1rem);
    line-height: 0.9;
    letter-spacing: -0.05em;
    text-transform: uppercase;
    color: var(--text-1);
  }

  .va-sub {
    margin: 10px 0 0;
    max-width: 64ch;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-2);
  }

  .va-panel-switch {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .va-panel-tab {
    min-height: 42px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 3px 3px 0 var(--border-hard);
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-2);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .va-panel-tab:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--border-hard);
  }

  .va-panel-tab--active {
    background: var(--accent);
    color: #111;
    border-color: #111;
    box-shadow: 4px 4px 0 #111;
  }

  .va-grid {
    display: grid;
    grid-template-columns: 280px minmax(360px, 1fr) 248px;
    gap: 12px;
    align-items: start;
    height: calc(100vh - 152px);
  }

  .va-grid--no-info {
    grid-template-columns: 280px minmax(360px, 1fr);
  }

  .va-col {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 20px;
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .va-col-sidebar {
    padding: 16px;
  }

  .va-col-editor {
    overflow: hidden;
  }

  .va-col-info {
    overflow-y: auto;
    scrollbar-width: thin;
  }

  /* Collapsed info panel expand button */
  .va-info-expand {
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: 3px 3px 0 var(--border-hard);
    border-radius: 10px;
    z-index: 10;
  }

  .va-settings-wrap,
  .va-secrets-wrap,
  .va-share-wrap {
    background: transparent;
    min-height: calc(100vh - 210px);
  }

  .va-settings-wrap {
    display: block;
  }

  .va-secrets-wrap,
  .va-share-wrap {
    overflow: visible;
  }

  /* Boot screen */
  .va-boot {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--canvas);
  }

  .va-boot--error .va-boot-logo {
    color: var(--red);
    font-size: 40px;
  }

  .va-boot-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .va-boot-logo {
    font-size: 40px;
    color: var(--accent-text);
    animation: float 3s ease-in-out infinite;
  }

  .va-boot-bar {
    width: 180px;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
  }

  .va-boot-fill {
    height: 100%;
    width: 40%;
    background: var(--accent);
    border-radius: 2px;
    animation: shimmer 1.4s linear infinite;
    background-size: 200% 100%;
  }

  .va-boot-label {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    letter-spacing: 0.08em;
    margin: 0;
  }

  /* Mobile tabs */
  .va-mobile-tabs {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: var(--surface);
    border-top: 2px solid var(--border-hard);
    padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0px));
    justify-content: space-around;
    gap: 0;
  }

  .va-mtab {
    flex: 1;
    padding: 8px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    transition: color 150ms;
    text-align: center;
  }

  .va-mtab--active { color: var(--text-1); }

  @media (max-width: 1023px) {
    .va-shell-header {
      flex-direction: column;
      align-items: stretch;
    }

    .va-panel-switch {
      justify-content: flex-start;
    }

    .va-grid {
      grid-template-columns: 220px minmax(320px, 1fr) 180px;
    }
  }

  @media (max-width: 767px) {
    .va-page {
      padding:
        calc(80px + env(safe-area-inset-top, 0px))
        12px
        calc(72px + env(safe-area-inset-bottom, 0px));
    }
    .va-grid {
      display: flex;
      flex-direction: column;
      height: auto;
    }
    .va-title {
      font-size: 1.9rem;
    }
    .va-col-sidebar {
      display: none;
    }
    .va-col-info { display: none; }
    .va-mobile-tabs { display: flex; }
  }
</style>
