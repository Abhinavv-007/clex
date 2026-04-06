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
  import Cursor from '$components/ui/Cursor.svelte'
  import VaultSidebar from '$components/vault/VaultSidebar.svelte'
  import VaultEditor from '$components/vault/VaultEditor.svelte'
  import VaultInfoPanel from '$components/vault/VaultInfoPanel.svelte'
  import VaultHeader from '$components/vault/VaultHeader.svelte'
  import VaultSettings from '$components/vault/VaultSettings.svelte'
  import VaultPairingModal from '$components/vault/VaultPairingModal.svelte'
  import VaultSecretCreate from '$components/vault/VaultSecretCreate.svelte'
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
</script>

<Cursor />
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

      {#if panel === 'settings'}
        <!-- Full-width settings view -->
        <div class="va-settings-wrap">
          <VaultSettings storageUsed={$storageUsed} />
        </div>

      {:else if panel === 'secrets'}
        <!-- Secret share creation -->
        <div class="va-secrets-wrap">
          <div class="va-secrets-header">
            <button class="btn-icon" on:click={() => vaultActions.setPanel('notes')}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                <path d="M10 3L6 8l4 5"/>
              </svg>
            </button>
          </div>
          <VaultSecretCreate {vaultApiUrl} />
        </div>

      {:else}
        <!-- Three-panel notes view -->
        <div class="va-grid" class:va-grid--no-info={infoPanelCollapsed}>

          <!-- Sidebar -->
          <aside class="va-col va-col-sidebar">
            <VaultSidebar />
          </aside>

          <!-- Editor -->
          <main class="va-col va-col-editor">
            <VaultHeader {offline} />
            <VaultEditor />
          </main>

          <!-- Info panel -->
          {#if !infoPanelCollapsed}
            <aside class="va-col va-col-info">
              <VaultInfoPanel />
            </aside>
          {/if}
        </div>

        <!-- Collapsed info panel expand button -->
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

      <!-- Secret Share tab in nav strip -->
      <button
        class="va-secrets-fab"
        class:va-secrets-fab--active={panel === 'secrets'}
        on:click={() => vaultActions.setPanel(panel === 'secrets' ? 'notes' : 'secrets')}
        title="Secret Share"
        aria-label="Secret Share"
      >
        👁
      </button>
    </div>
  </div>

  <!-- Pairing Modal -->
  {#if pairingOpen}
    <VaultPairingModal {vaultApiUrl} />
  {/if}
{/if}

<!-- Mobile tabs -->
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
    max-width: 1440px;
    margin: 0 auto;
    position: relative;
  }

  /* Three-panel grid */
  .va-grid {
    display: grid;
    grid-template-columns: 260px minmax(480px, 1fr) 220px;
    gap: 12px;
    align-items: start;
    height: calc(100vh - 152px);
  }

  .va-grid--no-info {
    grid-template-columns: 260px minmax(480px, 1fr);
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

  /* Secrets FAB */
  .va-secrets-fab {
    position: fixed;
    bottom: 32px;
    right: 24px;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: 4px 4px 0 var(--border-hard);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    z-index: 100;
  }

  .va-secrets-fab:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--border-hard);
  }

  .va-secrets-fab:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--border-hard);
  }

  .va-secrets-fab--active {
    background: var(--accent);
    border-color: #000;
    box-shadow: 4px 4px 0 #000;
  }

  /* Settings / Secrets full-width views */
  .va-settings-wrap {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 24px;
    min-height: calc(100vh - 160px);
    display: flex;
    flex-direction: column;
  }

  .va-secrets-wrap {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 24px;
    min-height: calc(100vh - 160px);
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .va-secrets-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
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
    .va-col-sidebar {
      display: none;
    }
    .va-col-info { display: none; }
    .va-secrets-fab { display: none; }
    .va-mobile-tabs { display: flex; }
  }
</style>
