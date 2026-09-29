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
  import VaultWelcome from '$components/vault/VaultWelcome.svelte'
  import Toast from '$components/ui/Toast.svelte'
  import { uiStore } from '$stores/ui'
  import {
    accountSync as accountSyncStore,
    googleUser as googleUserStore,
    masterKey as masterKeyStore,
    notes,
    syncState as syncStateStore,
    ui,
    vaultActions,
    storageUsed,
  } from '$stores/vault'
  import type { DecryptedNote } from '$stores/vault'
  import { deriveGoogleKey, encryptText, getOrCreateMasterKey, persistMasterKey, type MasterKey } from '$lib/vault/crypto'
  import type { StoredFolder, StoredNote } from '$lib/vault/db'
  import {
    getAllNotes,
    getAllFolders,
    getAllDeletionTombstones,
    getDeletionTombstone,
    getAllDevices,
    getNote,
    getNotesByFolder,
    asRemoteChange,
    openVaultDb,
    detectDeviceName,
    getDeviceFingerprint,
    saveDeletionTombstone,
    saveNote,
    saveFolder,
    deleteNote as dbDeleteNote,
    deleteFolder as dbDeleteFolder,
  } from '$lib/vault/db'
  import { decryptText } from '$lib/vault/crypto'
  import { buildSearchIndex, removeFromIndex, updateInIndex } from '$lib/vault/search'
  import { initSync, onSyncState, destroySync, runManualSync, setSyncHandlers, syncDeleteFolder, syncDeleteNote, syncFolderRecord, syncNoteRecord } from '$lib/vault/sync'
  import { onVaultAuthChanged, type VaultUser } from '$lib/vault/auth'
  import { fetchVaultBackup, pushVaultBackup, upsertAccountDevice, type BackupSnapshot } from '$lib/vault/backup'
  import { AccountSync, fetchAccountKey } from '$lib/vault/accountSync'
  import { signInWithGoogle } from '$lib/vault/auth'

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
  let backupSyncPromise: Promise<void> | null = null
  let backupSyncRoomId = ''
  let authBindingPromise: Promise<void> | null = null
  let account: AccountSync | null = null
  let accountUid = ''
  let signingIn = false
  const VAULT_SHARE_RESUME_KEY = 'clex_vault_resume_share'

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

  function consumeVaultShareResumeIntent() {
    try {
      if (sessionStorage.getItem(VAULT_SHARE_RESUME_KEY) === '1') {
        sessionStorage.removeItem(VAULT_SHARE_RESUME_KEY)
        vaultActions.setPanel('secrets')
      }
    } catch {
      // ignore storage failures
    }
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
    const noteTombstone = await getDeletionTombstone('note', note.id)
    if (noteTombstone) {
      syncDeleteNote(note.id)
      return
    }

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
    await saveDeletionTombstone('note', id)
    await dbDeleteNote(id)
    vaultActions.removeNote(id)
    removeFromIndex(id)
  }

  async function applySyncedFolder(folder: StoredFolder) {
    const folderTombstone = await getDeletionTombstone('folder', folder.id)
    if (folderTombstone) {
      syncDeleteFolder(folder.id)
      return
    }

    await saveFolder(folder)
    vaultActions.upsertFolder(folder)
  }

  async function removeSyncedFolder(id: string) {
    await saveDeletionTombstone('folder', id)
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
    if (authBindingPromise) {
      await authBindingPromise.catch(() => undefined)
    }

    const mk = get(masterKeyStore)
    if (!mk) {
      uiStore.toast({ type: 'error', message: 'Vault key is not ready yet. Reload Vault and try again.' })
      return
    }

    vaultActions.setSyncState({
      ...get(syncStateStore),
      syncing: true,
      error: null,
    })
    uiStore.toast({
      type: 'info',
      message: 'Syncing Vault notes and refreshing the encrypted backup…',
      duration: 2200,
    })

    try {
      await ensureSyncForRoom(mk.roomId)
      if (account) await account.syncNow()
      else await syncEncryptedBackup({ silent: false })

      const [mergedNotes, mergedFolders] = await Promise.all([
        getAllNotes(),
        getAllFolders(),
      ])

      await runManualSync({
        notes: mergedNotes,
        folders: mergedFolders,
      }, { authoritative: true })

      const googleUser = get(googleUserStore)
      if (googleUser?.uid) {
        await syncSignedInDevice(googleUser.uid)
      }

      vaultActions.setSyncState({
        ...get(syncStateStore),
        syncing: false,
        connected: true,
        lastSync: Date.now(),
        error: null,
      })
      uiStore.toast({
        type: 'success',
        message: googleUser?.uid
          ? 'Vault sync complete. This account backup is now refreshed.'
          : 'Vault sync complete. Local notes and the encrypted backup are up to date.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vault sync failed'
      vaultActions.setSyncState({
        ...get(syncStateStore),
        syncing: false,
        error: message,
      })
      uiStore.toast({ type: 'error', message })
      console.error('[vault] manual sync failed:', error)
    }
  }

  async function mergeBackupSnapshot(snapshot: BackupSnapshot) {
    const [localNotes, localFolders] = await Promise.all([
      getAllNotes(),
      getAllFolders(),
    ])

    const localNoteMap = new Map(localNotes.map((note) => [note.id, note]))
    const localFolderIds = new Set(localFolders.map((folder) => folder.id))

    for (const deletedNote of snapshot.deletedNotes) {
      await saveDeletionTombstone('note', deletedNote.targetId, deletedNote.deletedAt)
      if (localNoteMap.has(deletedNote.targetId)) {
        await removeSyncedNote(deletedNote.targetId)
        localNoteMap.delete(deletedNote.targetId)
      }
    }

    for (const deletedFolder of snapshot.deletedFolders) {
      await saveDeletionTombstone('folder', deletedFolder.targetId, deletedFolder.deletedAt)
      if (localFolderIds.has(deletedFolder.targetId)) {
        await removeSyncedFolder(deletedFolder.targetId)
        localFolderIds.delete(deletedFolder.targetId)
      }
    }

    for (const remoteNote of snapshot.notes) {
      const noteTombstone = await getDeletionTombstone('note', remoteNote.id)
      if (noteTombstone) continue
      const localNote = localNoteMap.get(remoteNote.id)
      if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
        await applySyncedNote(remoteNote)
      }
    }

    for (const remoteFolder of snapshot.folders) {
      const folderTombstone = await getDeletionTombstone('folder', remoteFolder.id)
      if (folderTombstone) continue
      if (!localFolderIds.has(remoteFolder.id)) {
        await applySyncedFolder(remoteFolder)
      }
    }
  }

  async function syncEncryptedBackup(options: { silent?: boolean; pushOnly?: boolean } = {}) {
    const { silent = true, pushOnly = false } = options
    const mk = get(masterKeyStore)
    if (!mk) return
    // Signed in, the account sync carries everything; this keyed backup is
    // for a Vault that lives on one device (and the devices paired to it).
    if (account || get(googleUserStore)) return
    if (backupSyncPromise) {
      if (backupSyncRoomId === mk.roomId) return backupSyncPromise
      await backupSyncPromise.catch(() => undefined)
    }

    backupSyncRoomId = mk.roomId

    backupSyncPromise = (async () => {
      try {
        if (!pushOnly) {
          const remote = await fetchVaultBackup(vaultApiUrl, mk).catch((error) => {
            if (error instanceof Error && /404/.test(error.message)) return null
            throw error
          })

          if (remote) {
            await mergeBackupSnapshot(remote)
          }
        }

        const [latestNotes, latestFolders, tombstones] = await Promise.all([
          getAllNotes(),
          getAllFolders(),
          getAllDeletionTombstones(),
        ])

        await pushVaultBackup(vaultApiUrl, mk, latestNotes, latestFolders, tombstones)
      } catch (error) {
        if (silent) {
          console.warn('[vault] encrypted backup sync failed:', error)
          return
        }
        throw error
      } finally {
        backupSyncPromise = null
        backupSyncRoomId = ''
      }
    })()

    return backupSyncPromise
  }

  async function syncSignedInDevice(userId: string) {
    const mk = get(masterKeyStore)
    if (!mk) return

    try {
      const deviceId = await getDeviceFingerprint()
      await upsertAccountDevice(vaultApiUrl, userId, {
        id: deviceId,
        name: detectDeviceName(),
        lastSeen: Date.now(),
        pairedAt: Date.now(),
        roomId: mk.roomId,
        fingerprint: mk.fingerprint,
      })
    } catch (error) {
      console.warn('[vault] device registry sync failed:', error)
    }
  }

  async function migrateNotesToMasterKey(currentKey: MasterKey, nextKey: MasterKey) {
    if (currentKey.fingerprint === nextKey.fingerprint) return

    const [storedNotes, storedFolders] = await Promise.all([
      getAllNotes(),
      getAllFolders(),
    ])

    const migratedNotes = await Promise.all(storedNotes.map(async (note) => {
      // A note this key cannot open (already on the next key, or damaged)
      // is carried over untouched rather than failing the whole move.
      try {
        return await reencryptNote(note, currentKey, nextKey)
      } catch {
        return note
      }
    }))

    await Promise.all(migratedNotes.map(note => saveNote(note)))
    const decryptedNotes = await Promise.all(migratedNotes.map(note => decryptStoredNoteRecord(note, nextKey.key)))

    vaultActions.setNotes(decryptedNotes)
    vaultActions.setFolders(storedFolders)
    buildSearchIndex(decryptedNotes.map(note => ({
      id: note.id,
      title: note.title,
      body: note.body,
      tags: note.tags,
      updatedAt: note.updatedAt,
    })))
  }

  async function reencryptNote(note: StoredNote, fromKey: MasterKey, toKey: MasterKey): Promise<StoredNote> {
    const [title, body] = await Promise.all([
      decryptText(note.titleBlob, fromKey.key),
      decryptText(note.bodyBlob, fromKey.key),
    ])
    const [titleBlob, bodyBlob] = await Promise.all([
      encryptText(title, toKey.key),
      encryptText(body, toKey.key),
    ])
    return { ...note, titleBlob, bodyBlob }
  }

  // ── Account sync ──────────────────────────────────────────────────────────
  //
  // Signed in with Google, the Vault moves onto the account's key (kept by
  // the vault worker for that account only) and syncs through the worker, so
  // every device signed in to the account has the same notes. The notes on
  // this device are re-encrypted under that key and uploaded; anything a
  // previous version of Clex backed up for this account is brought in too.

  async function applyAccountNote(remote: StoredNote) {
    await asRemoteChange(async () => {
      const tomb = await getDeletionTombstone('note', remote.id)
      if (tomb && tomb.deletedAt >= remote.updatedAt) return
      const local = await getNote(remote.id)
      if (local && local.updatedAt >= remote.updatedAt) return
      await applySyncedNote(remote)
      syncNoteRecord(remote)
    })
  }

  async function applyAccountFolder(remote: StoredFolder) {
    await asRemoteChange(async () => {
      const tomb = await getDeletionTombstone('folder', remote.id)
      if (tomb && tomb.deletedAt >= (remote.updatedAt ?? remote.createdAt)) return
      const local = (await getAllFolders()).find((f) => f.id === remote.id)
      if (local && (local.updatedAt ?? local.createdAt) >= (remote.updatedAt ?? remote.createdAt)) return
      await applySyncedFolder(remote)
      syncFolderRecord(remote)
    })
  }

  async function removeAccountNote(id: string, deletedAt: number) {
    await asRemoteChange(async () => {
      const local = await getNote(id)
      if (local && local.updatedAt > deletedAt) return
      await saveDeletionTombstone('note', id, deletedAt)
      if (local) {
        await dbDeleteNote(id)
        vaultActions.removeNote(id)
        removeFromIndex(id)
        syncDeleteNote(id)
      }
    })
  }

  async function removeAccountFolder(id: string, deletedAt: number) {
    await asRemoteChange(async () => {
      const local = (await getAllFolders()).find((f) => f.id === id)
      if (local && (local.updatedAt ?? local.createdAt) > deletedAt) return
      await saveDeletionTombstone('folder', id, deletedAt)
      if (local) {
        await removeSyncedFolder(id)
        syncDeleteFolder(id)
      }
    })
  }

  /** Brings in the backup an earlier Clex kept for this account, once. */
  async function importLegacyAccountBackup(uid: string, accountKey: MasterKey) {
    const marker = `clex-vault-legacy-import:${uid}`
    try { if (localStorage.getItem(marker)) return } catch { /* storage blocked: just try */ }
    try {
      const legacyKey = await deriveGoogleKey(uid)
      const snapshot = await fetchVaultBackup(vaultApiUrl, legacyKey).catch(() => null)
      if (snapshot) {
        for (const note of snapshot.notes) {
          try {
            await applyAccountNote(await reencryptNote(note, legacyKey, accountKey))
          } catch { /* unreadable: skip */ }
        }
        for (const folder of snapshot.folders) await applyAccountFolder(folder)
        for (const t of snapshot.deletedNotes) await removeAccountNote(t.targetId, t.deletedAt)
        for (const t of snapshot.deletedFolders) await removeAccountFolder(t.targetId, t.deletedAt)
      }
      try { localStorage.setItem(marker, String(Date.now())) } catch { /* ignore */ }
    } catch (error) {
      console.warn('[vault] earlier backup could not be imported:', error)
    }
  }

  function stopAccountSync() {
    account?.stop()
    account = null
    accountUid = ''
    accountSyncStore.set({ state: 'off', lastSync: null, error: null })
  }

  async function bindGoogleVault(user: VaultUser | null) {
    vaultActions.setGoogleUser(user)
    if (!user?.uid) {
      stopAccountSync()
      return
    }
    if (account && accountUid === user.uid) return

    const currentKey = get(masterKeyStore)
    if (!currentKey) return

    accountSyncStore.set({ state: 'syncing', lastSync: null, error: null })
    let accountKey: MasterKey
    try {
      accountKey = await fetchAccountKey(vaultApiUrl)
    } catch (error) {
      accountSyncStore.set({ state: 'error', lastSync: null, error: error instanceof Error ? error.message : 'Could not reach your account' })
      return
    }

    if (currentKey.fingerprint !== accountKey.fingerprint) {
      await migrateNotesToMasterKey(currentKey, accountKey)
    }
    const nextKey = await persistMasterKey(accountKey)
    vaultActions.setMasterKey(nextKey)
    await ensureSyncForRoom(nextKey.roomId)
    await importLegacyAccountBackup(user.uid, nextKey)

    account?.stop()
    accountUid = user.uid
    account = new AccountSync(vaultApiUrl, user.uid, nextKey, {
      applyNote: applyAccountNote,
      applyFolder: applyAccountFolder,
      removeNote: removeAccountNote,
      removeFolder: removeAccountFolder,
    }, (status) => accountSyncStore.set(status))
    account.start()
    await syncSignedInDevice(user.uid)
  }

  async function startAccountSync() {
    signingIn = true
    try {
      await signInWithGoogle()
    } catch (error) {
      uiStore.toast({ type: 'error', message: error instanceof Error ? error.message : 'Sign-in failed' })
    } finally {
      signingIn = false
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
      void syncEncryptedBackup()

      unsubSync = onSyncState((state) => {
        vaultActions.setSyncState(state)
      })

      // 5. Restore Firebase auth state (non-blocking — just populates UI)
      onVaultAuthChanged((user) => {
        authBindingPromise = (async () => {
          try {
            await bindGoogleVault(user)
          } catch (error) {
            console.warn('[vault] google vault bind failed:', error)
          } finally {
            authBindingPromise = null
          }
        })()
      }).catch(() => {
        // Firebase unavailable — continue without Google auth
      })

    } catch (e: unknown) {
      bootError = e instanceof Error ? e.message : 'Failed to initialize Vault'
      console.error('[vault] boot error:', e)
    } finally {
      consumeVaultShareResumeIntent()
      bootComplete = true
      vaultActions.setLoading(false)
      consumePairingCodeFromUrl()
    }
  })

  onDestroy(() => {
    unsubSync?.()
    account?.stop()
    account = null
    destroySync()
    activeSyncRoomId = ''
    bootComplete = false
  })

  $: if (bootComplete && $masterKeyStore?.roomId && $masterKeyStore.roomId !== activeSyncRoomId) {
    void (async () => {
      await ensureSyncForRoom($masterKeyStore.roomId)
      await syncEncryptedBackup()
    })()
  }

  $: loading = $ui.loading
  $: panel = $ui.activePanel
  $: pairingOpen = $ui.pairingModalOpen
  $: infoPanelCollapsed = $ui.infoPanelCollapsed
  // "share" was a Cloud Share panel that no longer has anything in it;
  // anything that still asks for it gets secret links.
  $: if (panel === 'share') vaultActions.setPanel('secrets')
  $: empty = $notes.length === 0 && !$ui.searchQuery && !$ui.activeFolderId

  const panelTabs: { id: 'notes' | 'secrets' | 'settings'; label: string; icon: string }[] = [
    { id: 'notes', label: 'Notes', icon: 'M5 3.5h7l3 3v10H5z M12 3.5v3h3 M7.5 10h5 M7.5 13h5' },
    { id: 'secrets', label: 'Secret links', icon: 'M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1 M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1' },
    { id: 'settings', label: 'Devices & keys', icon: 'M3 5h14M3 10h14M3 15h14 M7 3.5v3 M13 8.5v3 M9 13.5v3' },
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
      <header class="va-bar">
        <div class="va-lock">
          <span class="va-lock-emblem" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.7" />
              <path class="va-lock-shackle" d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <circle cx="12" cy="15.2" r="1.5" fill="currentColor" />
            </svg>
          </span>
          <div class="va-lock-copy">
            {#if $googleUserStore}
              <b>
                {#if $accountSyncStore.state === 'syncing'}Syncing to your account…
                {:else if $accountSyncStore.state === 'error'}Sync paused
                {:else if $accountSyncStore.state === 'offline'}Offline, will sync when back
                {:else}Synced to your account{/if}
              </b>
              <span>
                {#if $accountSyncStore.state === 'error'}{$accountSyncStore.error}
                {:else}{$googleUserStore.email ?? 'Google account'} · key <code>{$masterKeyStore?.fingerprint ?? '········'}</code>{#if $notes.length} · {$notes.length} note{$notes.length === 1 ? '' : 's'}{/if}{/if}
              </span>
            {:else}
              <b>Locked to this device</b>
              <span>AES-GCM 256 · key <code>{$masterKeyStore?.fingerprint ?? '········'}</code>{#if $notes.length} · {$notes.length} note{$notes.length === 1 ? '' : 's'}{/if}</span>
            {/if}
          </div>
          {#if !$googleUserStore}
            <button class="va-sync-cta" type="button" on:click={startAccountSync} disabled={signingIn}>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 6.5A5 5 0 0 0 4 4.2L2.8 5.5M3 9.5a5 5 0 0 0 9 2.3l1.2-1.3M2.8 2.8v2.7h2.7M13.2 13.2v-2.7h-2.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {signingIn ? 'Opening Google…' : 'Sync across my devices'}
            </button>
          {:else if $accountSyncStore.state === 'error'}
            <button class="va-sync-cta" type="button" on:click={() => account?.syncNow()}>Retry</button>
          {/if}
        </div>

        <nav class="va-nav" role="tablist" aria-label="Vault sections">
          {#each panelTabs as item}
            <button
              class="va-nav-tab"
              class:va-nav-tab--active={panel === item.id}
              role="tab"
              aria-selected={panel === item.id}
              type="button"
              on:click={() => vaultActions.setPanel(item.id)}
            >
              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d={item.icon} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>{item.label}</span>
            </button>
          {/each}
        </nav>
      </header>

      {#if panel === 'settings'}
        <div class="va-settings-wrap" in:fade={{ duration: 180 }}>
          <VaultSettings storageUsed={$storageUsed} {vaultApiUrl} />
        </div>

      {:else if panel === 'secrets' || panel === 'share'}
        <div class="va-secrets-wrap" in:fade={{ duration: 180 }}>
          <VaultSecretCreate {vaultApiUrl} />
        </div>

      {:else if empty}
        <VaultWelcome />

      {:else}
        <div class="va-grid" class:va-grid--no-info={infoPanelCollapsed} in:fade={{ duration: 180 }}>
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

<style>
  /* ── Page (standalone) ── embedded, WorkspaceApp strips the padding. */
  .va-page {
    padding:
      calc(88px + env(safe-area-inset-top, 0px))
      calc(16px + env(safe-area-inset-right, 0px))
      calc(64px + env(safe-area-inset-bottom, 0px))
      calc(16px + env(safe-area-inset-left, 0px));
    min-height: 100vh;
  }

  .va-inner {
    position: relative;
    display: grid;
    gap: 14px;
    max-width: 1420px;
    margin: 0 auto;
  }

  /* ── The bar: what state the vault is in, and where you are in it ── */

  .va-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 20px;
    padding: 10px 10px 10px 14px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background:
      linear-gradient(90deg, var(--accent-dim), transparent 45%),
      var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .va-lock {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .va-lock-emblem {
    position: relative;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--accent);
    color: var(--accent-fg);
    box-shadow: 0 8px 20px -10px var(--accent);
    flex-shrink: 0;
  }

  .va-lock-emblem::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 15px;
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    animation: va-breathe 3.2s var(--ease-out) infinite;
  }

  @keyframes va-breathe {
    0%, 100% { opacity: 0.2; transform: scale(0.96); }
    50% { opacity: 1; transform: scale(1); }
  }

  .va-lock-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .va-lock-copy b {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  .va-lock-copy span {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Signing in is the one step between a Vault on this device and the same
     Vault on every device, so it sits right in the bar. */
  .va-sync-cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: 0 0 auto;
    height: 32px;
    padding: 0 13px;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    color: var(--accent-text, var(--accent));
    font-family: var(--font-sans);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  }

  .va-sync-cta:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    transform: translateY(-1px);
  }

  .va-sync-cta:disabled {
    opacity: 0.6;
    cursor: progress;
  }

  .va-lock-copy code {
    color: var(--accent-text);
  }

  .va-nav {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: var(--surface-2);
    box-shadow: inset 0 0 0 1px var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .va-nav-tab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-3);
    white-space: nowrap;
    cursor: pointer;
    transition: color 180ms var(--ease-out), background 180ms var(--ease-out), box-shadow 180ms var(--ease-out);
  }

  .va-nav-tab:hover {
    color: var(--text-1);
  }

  .va-nav-tab--active {
    background: var(--surface);
    color: var(--text-1);
    box-shadow: var(--shadow-sm), 0 0 0 1px var(--border);
  }

  .va-nav-tab--active svg {
    color: var(--accent-text);
  }

  /* ── Notes: the desk ── */

  .va-grid {
    display: grid;
    grid-template-columns: 290px minmax(0, 1fr) 250px;
    gap: 12px;
    align-items: stretch;
    height: calc(100vh - 152px);
  }

  .va-grid--no-info {
    grid-template-columns: 290px minmax(0, 1fr);
  }

  .va-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .va-col-sidebar {
    padding: 14px;
    background: color-mix(in srgb, var(--surface-2) 55%, var(--surface));
  }

  /* The editor is the sheet of paper on the desk. */
  .va-col-editor {
    padding: 0;
    background:
      linear-gradient(var(--surface), var(--surface)) padding-box;
    box-shadow: var(--shadow-md);
  }

  .va-col-info {
    padding: 18px;
    overflow-y: auto;
    scrollbar-width: thin;
    background: color-mix(in srgb, var(--surface-2) 55%, var(--surface));
  }

  .va-settings-wrap {
    display: flex;
    align-items: stretch;
    width: 100%;
    min-height: 640px;
    padding: 22px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .va-settings-wrap :global(.vst-root) {
    width: 100%;
    height: auto;
    flex: 1 1 auto;
    min-height: 0;
  }

  /* Settings grow with their content instead of scrolling inside a box. */
  .va-settings-wrap :global(.vst-body) {
    flex: none;
    overflow: visible;
  }

  .va-secrets-wrap {
    overflow: visible;
  }

  /* ── Boot ── */

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

  @media (max-width: 1100px) {
    .va-grid {
      grid-template-columns: 250px minmax(0, 1fr);
    }

    .va-col-info {
      display: none;
    }
  }

  @media (max-width: 767px) {
    .va-page {
      padding:
        calc(80px + env(safe-area-inset-top, 0px))
        12px
        calc(24px + env(safe-area-inset-bottom, 0px));
    }

    .va-bar {
      padding: 10px;
    }

    .va-nav {
      width: 100%;
    }

    .va-nav-tab {
      flex: 1;
      justify-content: center;
      padding: 0 10px;
    }

    .va-grid {
      display: flex;
      flex-direction: column;
      height: auto;
    }

    .va-col-sidebar {
      max-height: 340px;
    }

    .va-col-editor {
      min-height: 480px;
    }

    .va-settings-wrap {
      min-height: auto;
      padding: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .va-lock-emblem::after {
      animation: none;
    }
  }
</style>
