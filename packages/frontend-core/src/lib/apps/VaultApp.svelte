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
  import { get } from 'svelte/store'
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
    ui,
    vaultActions,
    storageUsed,
  } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import { getOrCreateMasterKey } from '$lib/vault/crypto'
  import type { StoredFolder, StoredNote } from '$lib/vault/db'
  import {
    getAllNotes,
    getAllFolders,
    getAllDevices,
    getNotesByFolder,
    openVaultDb,
    saveNote,
    saveFolder,
    deleteNote as dbDeleteNote,
    deleteFolder as dbDeleteFolder,
  } from '$lib/vault/db'
  import { decryptText } from '$lib/vault/crypto'
  import { buildSearchIndex, removeFromIndex, updateInIndex } from '$lib/vault/search'
  import { initSync, onSyncState, destroySync, runManualSync, setSyncHandlers } from '$lib/vault/sync'
  import { onVaultAuthChanged } from '$lib/vault/auth'

  export let signalingUrl = 'wss://signal.clex.in'
  export let vaultApiUrl = '/vault/api'

  let offline = !navigator.onLine
  let unsubSync: (() => void) | undefined
  let bootError = ''
  let pairingInitialTab: 'sender' | 'receiver' = 'sender'
  let pairingPrefillCode = ''
  let pairingAutoConnect = false
  let activeSyncRoomId = ''
  let syncInitVersion = 0
  let bootComplete = false

  function consumePairingCodeFromUrl() {
    const url = new URL(window.location.href)
    const raw = url.searchParams.get('pair') ?? url.searchParams.get('pairCode') ?? ''
    const digits = raw.replace(/\D/g, '').slice(0, 8)

    if (!digits) return

    pairingInitialTab = 'receiver'
    pairingPrefillCode = digits
    pairingAutoConnect = true
    vaultActions.setPanel('settings')
    vaultActions.setSettingsTab('devices')
    vaultActions.openPairingModal()
    url.searchParams.delete('pair')
    url.searchParams.delete('pairCode')
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function resetPairingHandoffState() {
    pairingInitialTab = 'sender'
    pairingPrefillCode = ''
    pairingAutoConnect = false
  }

  async function decryptStoredNoteRecord(note: StoredNote, key: CryptoKey): Promise<DecryptedNote> {
    try {
      const [title, body] = await Promise.all([
        decryptText(note.titleBlob, key),
        decryptText(note.bodyBlob, key),
      ])

      return {
        id: note.id,
        title,
        body,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        tags: note.tags,
        folderId: note.folderId,
        isPinned: note.isPinned,
        attachmentIds: note.attachmentIds,
      }
    } catch {
      return {
        id: note.id,
        title: '[Encrypted]',
        body: '',
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        tags: note.tags,
        folderId: note.folderId,
        isPinned: note.isPinned,
        attachmentIds: note.attachmentIds,
      }
    }
  }

  async function applySyncedNote(note: StoredNote) {
    await saveNote(note)

    const mk = get(masterKeyStore)
    if (!mk) return

    const decrypted = await decryptStoredNoteRecord(note, mk.key)
    vaultActions.upsertNote(decrypted)
    updateInIndex({
      id: decrypted.id,
      title: decrypted.title,
      body: decrypted.body,
      tags: decrypted.tags,
      updatedAt: decrypted.updatedAt,
    })
  }

  async function removeSyncedNote(id: string) {
    await dbDeleteNote(id)
    vaultActions.removeNote(id)
    removeFromIndex(id)
  }

  async function applySyncedFolder(folder: StoredFolder) {
    await saveFolder(folder)
    vaultActions.upsertFolder(folder)
  }

  async function removeSyncedFolder(id: string) {
    const storedNotes = await getNotesByFolder(id)
    const localNotes = get(notes).filter((note) => note.folderId === id)

    for (const note of storedNotes) {
      await saveNote({ ...note, folderId: null })
    }

    for (const note of localNotes) {
      vaultActions.upsertNote({ ...note, folderId: null })
    }

    await dbDeleteFolder(id)
    vaultActions.removeFolder(id)
  }

  async function ensureSyncForRoom(roomId: string) {
    if (!roomId || activeSyncRoomId === roomId) return

    const version = ++syncInitVersion
    activeSyncRoomId = roomId
    destroySync()

    const [storedNotes, storedFolders] = await Promise.all([
      getAllNotes(),
      getAllFolders(),
    ])

    await initSync(roomId, signalingUrl, {
      notes: storedNotes,
      folders: storedFolders,
    })

    if (version !== syncInitVersion) return
  }

  async function handleManualSync() {
    const mk = get(masterKeyStore)
    if (!mk) return

    try {
      await ensureSyncForRoom(mk.roomId)
      const [storedNotes, storedFolders] = await Promise.all([
        getAllNotes(),
        getAllFolders(),
      ])
      await runManualSync({
        notes: storedNotes,
        folders: storedFolders,
      })
    } catch (error) {
      console.error('[vault] manual sync failed:', error)
    }
  }

  onMount(async () => {
    vaultActions.setLoading(true)

    // Online/offline listener
    window.addEventListener('online', () => (offline = false))
    window.addEventListener('offline', () => (offline = true))

    try {
      await openVaultDb()

      setSyncHandlers({
        upsertNote: (note) => applySyncedNote(note),
        deleteNote: (id) => removeSyncedNote(id),
        upsertFolder: (folder) => applySyncedFolder(folder),
        deleteFolder: (id) => removeSyncedFolder(id),
      })

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
      const decryptedNotes = await Promise.all(storedNotes.map((note) => decryptStoredNoteRecord(note, mk.key)))

      vaultActions.setNotes(decryptedNotes)
      vaultActions.setFolders(storedFolders)
      vaultActions.setDevices(storedDevices.filter(d => d.id !== '__self__'))

      // 3. Build search index
      buildSearchIndex(decryptedNotes.map(n => ({ id: n.id, title: n.title, body: n.body, tags: n.tags, updatedAt: n.updatedAt })))

      // 4. Initialize P2P sync (non-blocking)
      await ensureSyncForRoom(mk.roomId)

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
      bootComplete = true
      vaultActions.setLoading(false)
      consumePairingCodeFromUrl()
    }
  })

  onDestroy(() => {
    unsubSync?.()
    destroySync()
    activeSyncRoomId = ''
    bootComplete = false
  })

  $: if (bootComplete && $masterKeyStore?.roomId && $masterKeyStore.roomId !== activeSyncRoomId) {
    void ensureSyncForRoom($masterKeyStore.roomId)
  }

  $: loading = $ui.loading
  $: panel = $ui.activePanel
  $: pairingOpen = $ui.pairingModalOpen
  $: infoPanelCollapsed = $ui.infoPanelCollapsed
  $: panelTitle = panel === 'notes'
    ? 'Encrypted notes, private links, and timed handoffs'
    : panel === 'secrets'
      ? 'Private links with controls you choose'
      : panel === 'share'
        ? 'Timed file relay with QR handoff'
        : 'Devices, storage, encryption, and account controls'
  $: panelSubtitle = panel === 'notes'
    ? 'Keep notes local, move between folders quickly, and switch into secret or file sharing without leaving the same workspace shell.'
    : panel === 'secrets'
      ? 'Set expiry, choose the protections that actually matter, then hand off the full link or QR code.'
      : panel === 'share'
        ? 'Signed-in uploads stay capped at 10 MB per file, 100 MB per day, and disappear automatically after 24 hours.'
        : 'Pair devices, check storage, manage your relay access, and control the local key lifecycle from one place.'

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
            <VaultHeader {offline} on:syncNow={handleManualSync} />
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
    <VaultPairingModal
      {vaultApiUrl}
      initialTab={pairingInitialTab}
      prefillCode={pairingPrefillCode}
      autoConnect={pairingAutoConnect}
      on:close={resetPairingHandoffState}
    />
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 24px;
  }

  .va-title-block {
    min-width: 0;
    max-width: 760px;
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
    font-size: clamp(1.9rem, 2.8vw, 2.55rem);
    line-height: 1.02;
    letter-spacing: -0.03em;
    color: var(--text-1);
    text-wrap: balance;
  }

  .va-sub {
    margin: 12px 0 0;
    max-width: 64ch;
    font-size: 15px;
    line-height: 1.65;
    color: var(--text-2);
  }

  .va-panel-switch {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    width: min(100%, 560px);
    padding: 6px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
    border-radius: 14px;
    flex: 0 0 min(100%, 560px);
  }

  .va-panel-tab {
    min-height: 46px;
    min-width: 0;
    padding: 10px 16px;
    border-radius: 10px;
    border: 2px solid transparent;
    background: transparent;
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-2);
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
    text-align: center;
  }

  .va-panel-tab:hover {
    color: var(--text-1);
  }

  .va-panel-tab--active {
    background: var(--surface);
    color: var(--text-1);
    border-color: var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
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
    display: flex;
    align-items: stretch;
    width: 100%;
    height: calc(100vh - 210px);
    min-height: 680px;
    padding: 22px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .va-settings-wrap :global(.vst-root) {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
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
      width: 100%;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      flex-basis: auto;
    }

    .va-grid {
      grid-template-columns: 220px minmax(320px, 1fr) 180px;
    }

    .va-settings-wrap {
      min-height: 620px;
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
      font-size: 2rem;
    }
    .va-panel-switch {
      display: none;
    }
    .va-col-sidebar {
      display: none;
    }
    .va-col-info { display: none; }
    .va-mobile-tabs { display: flex; }
    .va-settings-wrap,
    .va-secrets-wrap,
    .va-share-wrap {
      min-height: auto;
      height: auto;
    }
    .va-settings-wrap {
      padding: 16px;
    }
  }
</style>
