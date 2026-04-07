<script lang="ts">
  import { onMount } from 'svelte'
  import { masterKey, googleUser, devices, ui, syncState, vaultActions, formatBytes } from '$stores/vault'
  import { getAllDevices, deleteDevice as dbDeleteDevice, clearAllData, detectDeviceName, getDeviceFingerprint } from '$lib/vault/db'
  import { exportKeyAsJson, importKeyFromJson, rotateMasterKey, deriveGoogleKey } from '$lib/vault/crypto'
  import { signInWithGoogle, signOutGoogle } from '$lib/vault/auth'
  import { fade, slide } from 'svelte/transition'

  export let storageUsed = 0
  const STORAGE_QUOTA = 1_073_741_824 // 1 GB

  let confirmClear = false
  let confirmRotate = false
  let importKeyJson = ''
  let importError = ''
  let importSuccess = false
  let copySuccess = false
  let currentDeviceName = 'This browser'
  let currentDeviceFingerprint = ''

  type SettingsTab = 'devices' | 'storage' | 'encryption' | 'account' | 'data'
  const SETTINGS_TABS: SettingsTab[] = ['devices', 'storage', 'encryption', 'account', 'data']

  $: tab = $ui.settingsTab
  $: key = $masterKey

  async function handleExportKey() {
    if (!key) return
    const json = await exportKeyAsJson(key)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vault-key-${key.fingerprint}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportKey() {
    importError = ''
    try {
      const mk = await importKeyFromJson(importKeyJson)
      vaultActions.setMasterKey(mk)
      importSuccess = true
      importKeyJson = ''
    } catch (e: unknown) {
      importError = e instanceof Error ? e.message : 'Invalid key file'
    }
  }

  async function handleRotateKey() {
    if (!confirmRotate) { confirmRotate = true; return }
    const newKey = await rotateMasterKey()
    vaultActions.setMasterKey(newKey)
    confirmRotate = false
    // Unpairs all devices by incrementing room version
    const all = await getAllDevices()
    for (const d of all) {
      await dbDeleteDevice(d.id)
      vaultActions.removeDevice(d.id)
    }
  }

  async function handleClearData() {
    if (!confirmClear) { confirmClear = true; return }
    await clearAllData()
    window.location.reload()
  }

  async function handleUnpairDevice(id: string) {
    await dbDeleteDevice(id)
    vaultActions.removeDevice(id)
  }

  async function copyFingerprint() {
    if (!key) return
    await navigator.clipboard.writeText(key.fingerprint)
    copySuccess = true
    setTimeout(() => (copySuccess = false), 1500)
  }

  // ── Google Auth ──────────────────────────────────────────────────────────────

  let authBusy = false
  let authError = ''
  $: user = $googleUser
  $: sync = $syncState
  $: storagePercent = Math.min(100, (storageUsed / STORAGE_QUOTA) * 100)
  $: syncSummary = sync.peerCount > 0
    ? `${sync.peerCount} live peer${sync.peerCount === 1 ? '' : 's'}`
    : sync.connected
      ? 'Ready for peer sync'
      : sync.syncing
        ? 'Syncing local journal'
        : 'Local only'
  $: relaySummary = user ? 'Google connected' : 'Local key only'
  $: lastSyncLabel = sync.lastSync
    ? new Date(sync.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not yet'
  $: totalDevices = $devices.length + 1
  $: currentDeviceSuffix = currentDeviceFingerprint ? `···${currentDeviceFingerprint.slice(-4)}` : 'local'
  $: deviceSummary = $devices.length > 0
    ? `${$devices.length} paired device${$devices.length === 1 ? '' : 's'}`
    : 'Only this device right now'

  onMount(() => {
    currentDeviceName = detectDeviceName()
    void (async () => {
      currentDeviceFingerprint = await getDeviceFingerprint()
    })()
  })

  async function handleGoogleSignIn() {
    authBusy = true
    authError = ''
    try {
      const u = await signInWithGoogle()
      if (!u) return  // popup dismissed
      vaultActions.setGoogleUser(u)
      // Derive deterministic master key from Google UID.
      // New vault = gets Google key automatically.
      // Existing vault = key replaces the random one; notes save with new key on next edit.
      const gk = await deriveGoogleKey(u.uid)
      vaultActions.setMasterKey(gk)
    } catch (e: unknown) {
      authError = e instanceof Error ? e.message : 'Sign-in failed'
    } finally {
      authBusy = false
    }
  }

  async function handleGoogleSignOut() {
    authBusy = true
    authError = ''
    try {
      await signOutGoogle()
      vaultActions.setGoogleUser(null)
    } catch (e: unknown) {
      authError = e instanceof Error ? e.message : 'Sign-out failed'
    } finally {
      authBusy = false
    }
  }

  async function exportAllNotes() {
    const { getAllNotes } = await import('$lib/vault/db')
    const { decryptText } = await import('$lib/vault/crypto')
    const mk = $masterKey
    if (!mk) return
    const stored = await getAllNotes()
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    for (const note of stored) {
      try {
        const title = await decryptText(note.titleBlob, mk.key)
        const body = await decryptText(note.bodyBlob, mk.key)
        const filename = (title || 'untitled').replace(/[^a-z0-9\s-]/gi, '') + '.md'
        zip.file(filename, `# ${title}\n\n${body}`)
      } catch { /* skip corrupted note */ }
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vault-export-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="vst-root">
  <!-- Header -->
  <div class="vst-header">
    <button class="btn-icon" on:click={() => vaultActions.setPanel('notes')} aria-label="Back to notes">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M10 3L6 8l4 5"/>
      </svg>
    </button>
    <div class="vst-header-copy">
      <h2 class="vst-title">Settings</h2>
      <p class="vst-subtitle">Devices, relay access, encryption, and local Vault controls.</p>
    </div>
  </div>

  <!-- Tab nav -->
  <div class="vst-tabs">
    {#each SETTINGS_TABS as t}
      <button
        class="vst-tab"
        class:vst-tab--active={tab === t}
        on:click={() => vaultActions.setSettingsTab(t)}
      >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
    {/each}
  </div>

  <div class="vst-summary-grid">
    <div class="vst-summary-card">
      <span class="vst-summary-label">Sync</span>
      <strong class="vst-summary-value">{syncSummary}</strong>
      <p class="vst-summary-copy">Last sync {lastSyncLabel}</p>
    </div>
    <div class="vst-summary-card">
      <span class="vst-summary-label">Devices</span>
      <strong class="vst-summary-value">{totalDevices} known</strong>
      <p class="vst-summary-copy">{deviceSummary}</p>
    </div>
    <div class="vst-summary-card">
      <span class="vst-summary-label">Relay</span>
      <strong class="vst-summary-value">{relaySummary}</strong>
      <p class="vst-summary-copy">Cloud Share requires Google sign-in</p>
    </div>
    <div class="vst-summary-card">
      <span class="vst-summary-label">Storage</span>
      <strong class="vst-summary-value">{formatBytes(storageUsed)}</strong>
      <p class="vst-summary-copy">{storagePercent.toFixed(1)}% of local Vault allocation</p>
    </div>
  </div>

  <div class="vst-body scroll-thin">
    <!-- ── Devices ──────────────────────────────────────────────────────── -->
    {#if tab === 'devices'}
      <div class="vst-pane" in:fade={{ duration: 160 }}>
        <div class="vst-section-label">Vault Devices</div>

        <div class="vst-notice">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 6v3.5M7 4.5v.2"/></svg>
          Notes sync over the shared Vault room when both devices are online. Use Quick Connect once, then Sync now in Notes whenever you want to force a fresh merge.
        </div>

        <div class="vst-device-overview">
          <div>
            <p class="vst-device-count">{totalDevices} device{totalDevices === 1 ? '' : 's'} in this vault</p>
            <p class="vst-hint">This browser is always listed first. Other rows are direct-paired Vault devices saved on this browser.</p>
          </div>
          <button class="btn-accent vst-action-btn" on:click={vaultActions.openPairingModal}>
            + Add Device
          </button>
        </div>

        <div class="vst-device-list">
          <div class="vst-device-row vst-device-row--self">
            <div class="vst-device-icon">⬢</div>
            <div class="vst-device-info">
              <div class="vst-device-head">
                <span class="vst-device-name">{currentDeviceName}</span>
                <span class="vst-device-chip">This device</span>
              </div>
              <span class="vst-device-meta">
                Local key ready · {currentDeviceSuffix}
              </span>
            </div>
            {#if user}
              <button class="btn-secondary vst-unpair-btn" on:click={handleGoogleSignOut} disabled={authBusy}>
                {authBusy ? 'Signing out…' : 'Sign out'}
              </button>
            {:else}
              <span class="vst-device-inline-note">Ready</span>
            {/if}
          </div>

          {#each $devices as device (device.id)}
            <div class="vst-device-row">
              <div class="vst-device-icon">⬡</div>
              <div class="vst-device-info">
                <div class="vst-device-head">
                  <span class="vst-device-name">{device.name}</span>
                  <span class="vst-device-chip">Paired</span>
                </div>
                <span class="vst-device-meta">
                  Last seen {new Date(device.lastSeen).toLocaleString()} · ···{device.id.slice(-4)}
                </span>
              </div>
              <button class="btn-secondary vst-unpair-btn" on:click={() => handleUnpairDevice(device.id)}>
                Disconnect
              </button>
            </div>
          {:else}
            <p class="vst-empty">No other devices paired yet.</p>
          {/each}
        </div>
      </div>

    <!-- ── Storage ─────────────────────────────────────────────────────── -->
    {:else if tab === 'storage'}
      <div class="vst-pane" in:fade={{ duration: 160 }}>
        <div class="vst-section-label">R2 Storage</div>

        <div class="vst-storage-bar">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {storagePercent.toFixed(1)}%"></div>
          </div>
          <div class="vst-storage-meta">
            <span>{formatBytes(storageUsed)} used</span>
            <span>{formatBytes(STORAGE_QUOTA)} quota</span>
          </div>
        </div>

        <p class="vst-hint">Files are auto-deleted after 24 hours. Uploads are capped at 10 MB per file and 100 MB per day for each signed-in Vault user.</p>
      </div>

    <!-- ── Encryption ─────────────────────────────────────────────────── -->
    {:else if tab === 'encryption'}
      <div class="vst-pane" in:fade={{ duration: 160 }}>
        <div class="vst-section-label">Key Fingerprint</div>
        {#if key}
          <div class="vst-fingerprint-row">
            <code class="vst-fingerprint">{key.fingerprint}</code>
            <button class="btn-ghost vst-copy-btn" on:click={copyFingerprint}>
              {copySuccess ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p class="vst-hint">Compare this fingerprint across devices to verify key identity.</p>
        {/if}

        <div class="vst-divider" />
        <div class="vst-section-label">Export Key Backup</div>
        <p class="vst-hint">Download your key as JSON. Store it securely — anyone with this file can decrypt your notes.</p>
        <button class="btn-secondary vst-action-btn" on:click={handleExportKey}>
          Download Key Backup (.json)
        </button>

        <div class="vst-divider" />
        <div class="vst-section-label">Import Key</div>
        <textarea
          class="input vst-import-textarea"
          placeholder='Paste key backup JSON…'
          bind:value={importKeyJson}
          rows="4"
        ></textarea>
        {#if importError}<p class="vst-err">{importError}</p>{/if}
        {#if importSuccess}<p class="vst-ok">✓ Key imported successfully.</p>{/if}
        <button class="btn-secondary vst-action-btn" disabled={!importKeyJson.trim()} on:click={handleImportKey}>
          Import Key
        </button>

        <div class="vst-divider" />
        <div class="vst-section-label" style="color: var(--red);">Danger Zone</div>
        <p class="vst-hint">Rotating your key generates a new one. All existing notes become unreadable and all devices are unpaired.</p>
        {#if confirmRotate}
          <div class="vst-confirm-row" in:slide={{ duration: 160 }}>
            <p class="vst-confirm-text">This will permanently rotate your key and unpair all devices. Are you sure?</p>
            <div class="vst-confirm-btns">
              <button class="btn-ghost" on:click={() => (confirmRotate = false)}>Cancel</button>
              <button class="btn-secondary vst-danger-btn" on:click={handleRotateKey}>Yes, rotate key</button>
            </div>
          </div>
        {:else}
          <button class="btn-secondary vst-danger-btn" on:click={handleRotateKey}>
            Rotate Master Key
          </button>
        {/if}
      </div>

    <!-- ── Account ────────────────────────────────────────────────────── -->
    {:else if tab === 'account'}
      <div class="vst-pane" in:fade={{ duration: 160 }}>
        <div class="vst-section-label">Google Account</div>

        {#if user}
          <div class="vst-user-card">
            {#if user.photoURL}
              <img class="vst-avatar" src={user.photoURL} alt="avatar" referrerpolicy="no-referrer" />
            {:else}
              <div class="vst-avatar vst-avatar--placeholder">
                {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
              </div>
            {/if}
            <div class="vst-user-info">
              {#if user.displayName}<span class="vst-user-name">{user.displayName}</span>{/if}
              {#if user.email}<span class="vst-user-email">{user.email}</span>{/if}
            </div>
          </div>

          <div class="vst-notice vst-notice--green">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 7l3 3 6-6"/></svg>
            Auto-pair active — any device signed into this Google account derives the same vault key automatically. No pairing codes needed.
          </div>

          {#if authError}<p class="vst-err">{authError}</p>{/if}
          <button class="btn-secondary vst-action-btn" disabled={authBusy} on:click={handleGoogleSignOut}>
            {authBusy ? 'Signing out…' : 'Sign out'}
          </button>
        {:else}
          <p class="vst-hint">
            Sign in to enable file storage and Google auto-pair. Any device signed into the same Google account derives the same vault key — no codes required.
          </p>
          <p class="vst-hint">
            Your encryption key is derived locally via <code>HKDF(googleUID, "clex-vault-v1")</code>. It is <strong>never</strong> sent to or stored by Google or Clex.
          </p>

          {#if authError}<p class="vst-err">{authError}</p>{/if}
          <button class="btn-accent vst-action-btn" disabled={authBusy} on:click={handleGoogleSignIn}>
            {authBusy ? 'Signing in…' : 'Sign in with Google'}
          </button>
        {/if}
      </div>

    <!-- ── Data ───────────────────────────────────────────────────────── -->
    {:else if tab === 'data'}
      <div class="vst-pane" in:fade={{ duration: 160 }}>
        <div class="vst-section-label">Export</div>
        <p class="vst-hint">Download all your notes as a ZIP of Markdown files.</p>
        <button class="btn-secondary vst-action-btn" on:click={exportAllNotes}>
          Export All Notes (.zip)
        </button>

        <div class="vst-divider" />
        <div class="vst-section-label" style="color: var(--red);">Danger Zone</div>
        <p class="vst-hint">
          Clearing all data removes your notes, folders, and encryption key from this browser. This device will be unpaired.
          <strong>This cannot be undone.</strong>
        </p>

        {#if confirmClear}
          <div class="vst-confirm-row" in:slide={{ duration: 160 }}>
            <p class="vst-confirm-text">All local vault data will be permanently erased from this browser. Continue?</p>
            <div class="vst-confirm-btns">
              <button class="btn-ghost" on:click={() => (confirmClear = false)}>Cancel</button>
              <button class="btn-secondary vst-danger-btn" on:click={handleClearData}>Yes, clear everything</button>
            </div>
          </div>
        {:else}
          <button class="btn-secondary vst-danger-btn" on:click={handleClearData}>
            Clear All Local Data
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .vst-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: 16px;
  }

  .vst-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .vst-header-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vst-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 2vw, 1.95rem);
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin: 0;
    line-height: 0.96;
  }

  .vst-subtitle {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
  }

  .vst-tabs {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    flex-shrink: 0;
    padding-bottom: 2px;
  }

  .vst-tab {
    min-height: 42px;
    padding: 10px 14px;
    border: 1.5px solid var(--border-hard);
    border-radius: 12px;
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-3);
    transition: color 150ms, border-color 150ms, background 150ms, box-shadow 150ms, transform 150ms;
    white-space: nowrap;
  }

  .vst-tab:hover {
    color: var(--text-1);
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vst-tab--active {
    color: var(--text-1);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--accent) 68%, var(--border-hard));
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vst-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .vst-summary-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 124px;
    padding: 14px;
    border-radius: 16px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vst-summary-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vst-summary-value {
    font-family: var(--font-display);
    font-size: 1.05rem;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .vst-summary-copy {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--text-2);
  }

  .vst-body {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 4px 2px 0 0;
    min-height: 0;
  }

  .vst-pane {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100%;
    padding: 18px;
    border-radius: 18px;
    border: 1.5px solid var(--border-hard);
    background: color-mix(in srgb, var(--surface-2) 88%, var(--surface));
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vst-section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
    margin-bottom: 12px;
  }

  .vst-hint {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0 0 12px;
    max-width: none;
  }

  .vst-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .vst-notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    color: var(--amber);
    background: rgba(255, 170, 0, 0.06);
    border: 1px solid rgba(255, 170, 0, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }

  .vst-device-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .vst-device-overview {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
    border-radius: 16px;
    border: 1.5px solid var(--border-hard);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vst-device-count {
    margin: 0 0 8px;
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .vst-device-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--surface-2);
    border: 1.5px solid var(--border-hard);
    border-radius: 14px;
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vst-device-row--self {
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }

  .vst-device-icon {
    font-size: 20px;
    flex-shrink: 0;
    color: var(--text-3);
  }

  .vst-device-info {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .vst-device-head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .vst-device-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .vst-device-chip,
  .vst-device-inline-note {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vst-device-inline-note {
    color: var(--accent-text);
  }

  .vst-device-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .vst-unpair-btn {
    font-size: 12px;
    padding: 5px 12px;
    flex-shrink: 0;
  }

  .vst-empty {
    font-size: 13px;
    color: var(--text-3);
    margin: 0;
  }

  .vst-action-btn {
    display: inline-flex;
    margin-top: 8px;
  }

  .vst-device-overview .vst-action-btn {
    margin-top: 0;
  }

  .vst-storage-bar {
    margin-bottom: 12px;
  }

  .vst-storage-meta {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }

  .vst-fingerprint-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .vst-fingerprint {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: 0.2em;
    background: var(--surface-2);
    border: 1.5px solid var(--border-hard);
    border-radius: 8px;
    padding: 8px 16px;
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .vst-copy-btn {
    font-size: 12px;
    padding: 6px 12px;
  }

  .vst-import-textarea {
    resize: vertical;
    font-family: var(--font-mono);
    font-size: 12px;
    margin-bottom: 8px;
    display: block;
  }

  .vst-err { color: var(--red); font-size: 13px; margin: 4px 0 8px; }
  .vst-ok { color: var(--green); font-size: 13px; margin: 4px 0 8px; }

  .vst-danger-btn {
    color: var(--red);
    border-color: var(--red);
    box-shadow: 2px 2px 0 var(--red);
  }

  .vst-danger-btn:hover {
    background: rgba(255, 68, 102, 0.08);
    box-shadow: 4px 4px 0 var(--red);
  }

  .vst-confirm-row {
    padding: 14px;
    background: rgba(255, 68, 102, 0.06);
    border: 1.5px solid rgba(255, 68, 102, 0.2);
    border-radius: 10px;
    margin-top: 8px;
  }

  .vst-confirm-text {
    font-size: 13px;
    color: var(--text-1);
    margin: 0 0 12px;
  }

  .vst-confirm-btns {
    display: flex;
    gap: 8px;
  }

  /* Account tab */
  .vst-user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    margin-bottom: 16px;
  }

  .vst-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }

  .vst-avatar--placeholder {
    background: var(--accent);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
  }

  .vst-user-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .vst-user-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vst-user-email {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vst-notice--green {
    color: var(--green);
    background: rgba(0, 200, 120, 0.06);
    border-color: rgba(0, 200, 120, 0.2);
  }

  @media (max-width: 1080px) {
    .vst-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .vst-summary-grid {
      grid-template-columns: 1fr;
    }

    .vst-pane {
      padding: 16px;
    }

    .vst-device-overview,
    .vst-device-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .vst-fingerprint-row {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
