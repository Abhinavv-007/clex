<script lang="ts">
  import { masterKey, devices, ui, vaultActions, formatBytes, generateId } from '$stores/vault'
  import { getAllDevices, saveDevice, deleteDevice as dbDeleteDevice, clearAllData, detectDeviceName, getDeviceFingerprint } from '$lib/vault/db'
  import { exportKeyAsJson, importKeyFromJson, rotateMasterKey } from '$lib/vault/crypto'
  import { fly, fade, slide } from 'svelte/transition'

  export let storageUsed = 0
  const STORAGE_QUOTA = 1_073_741_824 // 1 GB

  let confirmClear = false
  let confirmRotate = false
  let importKeyJson = ''
  let importError = ''
  let importSuccess = false
  let copySuccess = false

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

  async function exportAllNotes() {
    const { notes: $notes } = await import('$stores/vault')
    // Export as markdown zip (simplified: newline-delimited text blob)
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
    <h2 class="vst-title">Settings</h2>
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

  <div class="vst-body scroll-thin">
    <!-- ── Devices ──────────────────────────────────────────────────────── -->
    {#if tab === 'devices'}
      <div in:fade={{ duration: 160 }}>
        <div class="vst-section-label">Paired Devices</div>

        <div class="vst-notice">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="7" cy="7" r="5.5"/><path d="M7 6v3.5M7 4.5v.2"/></svg>
          Clearing browser data will unpair this device.
        </div>

        <div class="vst-device-list">
          {#each $devices as device (device.id)}
            <div class="vst-device-row">
              <div class="vst-device-icon">⬡</div>
              <div class="vst-device-info">
                <span class="vst-device-name">{device.name}</span>
                <span class="vst-device-meta">
                  Last seen {new Date(device.lastSeen).toLocaleString()} · ···{device.id.slice(-4)}
                </span>
              </div>
              <button class="btn-secondary vst-unpair-btn" on:click={() => handleUnpairDevice(device.id)}>
                Unpair
              </button>
            </div>
          {:else}
            <p class="vst-empty">No other devices paired yet.</p>
          {/each}
        </div>

        <button class="btn-accent vst-action-btn" on:click={vaultActions.openPairingModal}>
          + Add Device
        </button>
      </div>

    <!-- ── Storage ─────────────────────────────────────────────────────── -->
    {:else if tab === 'storage'}
      <div in:fade={{ duration: 160 }}>
        <div class="vst-section-label">R2 Storage</div>

        <div class="vst-storage-bar">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {Math.min(100, (storageUsed / STORAGE_QUOTA) * 100).toFixed(1)}%"></div>
          </div>
          <div class="vst-storage-meta">
            <span>{formatBytes(storageUsed)} used</span>
            <span>{formatBytes(STORAGE_QUOTA)} quota</span>
          </div>
        </div>

        <p class="vst-hint">Files are auto-deleted after 24 hours. Only authenticated users can upload files.</p>
      </div>

    <!-- ── Encryption ─────────────────────────────────────────────────── -->
    {:else if tab === 'encryption'}
      <div in:fade={{ duration: 160 }}>
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
      <div in:fade={{ duration: 160 }}>
        <div class="vst-section-label">Google Account</div>
        <p class="vst-hint">
          Sign in to enable R2 file storage, Google auto-pair, and up to 3 paired devices.
          Your encryption key is <strong>never</strong> shared with or stored by Google or Clex.
        </p>
        <p class="vst-hint">
          When auto-pair is enabled, your key is derived from: <code>HKDF(googleUID + deviceSalt)</code>. Both devices independently compute the same room ID. No codes required.
        </p>
        <!-- Auth button — wired to existing clex Firebase auth if available -->
        <button class="btn-accent vst-action-btn" on:click={() => window.location.href = '/api/auth/google?return_to=' + encodeURIComponent(window.location.href)}>
          Sign in with Google
        </button>
      </div>

    <!-- ── Data ───────────────────────────────────────────────────────── -->
    {:else if tab === 'data'}
      <div in:fade={{ duration: 160 }}>
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
  }

  .vst-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0;
    flex-shrink: 0;
  }

  .vst-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .vst-tabs {
    display: flex;
    gap: 0;
    overflow-x: auto;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }

  .vst-tab {
    padding: 10px 14px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-3);
    transition: color 150ms, border-color 150ms;
    white-space: nowrap;
  }

  .vst-tab:hover { color: var(--text-2); }

  .vst-tab--active {
    color: var(--text-1);
    border-bottom-color: var(--accent);
  }

  .vst-body {
    flex: 1 1 0;
    overflow-y: auto;
    padding: 20px 0 0;
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
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0 0 12px;
    max-width: none;
  }

  .vst-divider {
    height: 1px;
    background: var(--border);
    margin: 20px 0;
  }

  .vst-notice {
    display: flex;
    align-items: center;
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

  .vst-device-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 10px;
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

  .vst-device-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
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
</style>
