<script lang="ts">
  import { onMount } from 'svelte'
  import QRCode from '$components/sharing/QRCode.svelte'
  import { formatBytes } from '$stores/vault'
  import { formatGroupedCode } from '$lib/vault/handoff'
  import {
    disconnectGoogleDrive,
    getDriveApiBaseUrl,
    getDriveSession,
    getStoredToken,
    initiateGoogleAuth,
    persistPendingVaultDriveFiles,
    pickupToken,
    restorePendingVaultDriveFiles,
    uploadDriveBatch,
  } from '$transfer/gdrive'

  interface VaultDriveSessionFileRecord {
    id: string
    name: string
    sizeBytes: number
    mimeType: string
    webViewLink: string
    directLink: string
    shareId: string
    code: string
  }

  interface VaultDriveSessionFolderRecord {
    id: string
    name: string
    webViewLink: string
    directLink: string
    shareId: string
    code: string
  }

  interface VaultDriveSessionRecord {
    id: string
    ownerSub: string
    email: string | null
    displayName: string | null
    createdAt: number
    deleteAt: number
    totalBytes: number
    rootFolderName: string
    folder: VaultDriveSessionFolderRecord | null
    files: VaultDriveSessionFileRecord[]
  }

  interface DriveSessionUser {
    sub: string
    email: string | null
    displayName: string | null
    picture: string | null
  }

  interface VaultDriveFinalizeResponse {
    ok: boolean
    session: VaultDriveSessionRecord
  }

  const MAX_FILE_BYTES = 1024 * 1024 * 1024
  const DAILY_QUOTA_BYTES = 10 * 1024 * 1024 * 1024

  let fileInput: HTMLInputElement | null = null
  let driveUser: DriveSessionUser | null = null
  let tokenPresent = false
  let connectBusy = false
  let filesLoading = false
  let uploading = false
  let selectedFiles: File[] = []
  let sessions: VaultDriveSessionRecord[] = []
  let activeSessionId = ''
  let uploadProgress = 0
  let uploadStepLabel = ''
  let error = ''
  let linkCopied = ''
  let codeCopied = ''
  let deleteBusyId = ''

  $: if (sessions.length > 0 && !sessions.some(session => session.id === activeSessionId)) {
    activeSessionId = sessions[0].id
  }
  $: activeSession = sessions.find(session => session.id === activeSessionId) ?? sessions[0] ?? null
  $: totalSelectedBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0)

  onMount(() => {
    void bootCloudShare()
  })

  function mergeSelectedFiles(incoming: File[]): string[] {
    const next = [...selectedFiles]
    const rejected: string[] = []

    for (const file of incoming) {
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} exceeds the 1 GB file limit`)
        continue
      }

      const exists = next.some(item =>
        item.name === file.name
        && item.size === file.size
        && item.lastModified === file.lastModified,
      )
      if (!exists) next.push(file)
    }

    selectedFiles = next
    return rejected
  }

  function getActiveSessionShares(session: VaultDriveSessionRecord) {
    const folderShare = session.folder && session.files.length > 1
      ? [{
          id: session.folder.shareId,
          kind: 'folder' as const,
          title: `${session.files.length} files`,
          subtitle: session.folder.name,
          code: session.folder.code,
          url: buildVaultShareUrl(session.folder.shareId),
          directLink: session.folder.directLink,
          webViewLink: session.folder.webViewLink,
          sizeBytes: session.totalBytes,
        }]
      : []

    const fileShares = session.files.map(file => ({
      id: file.shareId,
      kind: 'file' as const,
      title: file.name,
      subtitle: `${formatBytes(file.sizeBytes)} · ${file.mimeType || 'Drive file'}`,
      code: file.code,
      url: buildVaultShareUrl(file.shareId),
      directLink: file.directLink,
      webViewLink: file.webViewLink,
      sizeBytes: file.sizeBytes,
    }))

    return [...folderShare, ...fileShares]
  }

  function buildVaultShareUrl(token: string): string {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/vault/share?id=${encodeURIComponent(token)}`
  }

  async function bootCloudShare() {
    filesLoading = true
    try {
      const restoredFiles = await restorePendingVaultDriveFiles()
      const restoreWarnings = mergeSelectedFiles(restoredFiles)
      if (restoreWarnings.length > 0) {
        error = restoreWarnings.join('. ')
      }

      await syncDriveConnection()
      if (tokenPresent) {
        await loadSessions()
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Google Drive connection could not be restored'
    } finally {
      filesLoading = false
    }
  }

  async function syncDriveConnection(): Promise<string | null> {
    error = ''

    const storedToken = getStoredToken()
    try {
      const token = await pickupToken()
      const session = await getDriveSession()
      tokenPresent = Boolean(token || storedToken || session.connected)
      driveUser = session.user as DriveSessionUser | null
      return token ?? storedToken
    } catch (err) {
      const session = await getDriveSession()
      if (storedToken || session.connected) {
        tokenPresent = true
        driveUser = session.user as DriveSessionUser | null
        return storedToken
      }
      throw err
    }
  }

  async function connectDrive() {
    connectBusy = true
    error = ''

    try {
      const token = await syncDriveConnection()
      if (tokenPresent || token) {
        await loadSessions()
        return
      }
      await persistPendingVaultDriveFiles(selectedFiles)
      await initiateGoogleAuth()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Google Drive connection could not be started'
    } finally {
      connectBusy = false
    }
  }

  async function disconnectDrive() {
    await disconnectGoogleDrive()
    tokenPresent = false
    driveUser = null
    sessions = []
    activeSessionId = ''
  }

  function promptFilePicker() {
    fileInput?.click()
  }

  function handleFileSelection(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    const incoming = Array.from(target.files ?? [])
    const rejected = mergeSelectedFiles(incoming)
    error = rejected.join('. ')
    target.value = ''
  }

  function removeSelected(index: number) {
    selectedFiles = selectedFiles.filter((_, itemIndex) => itemIndex !== index)
  }

  async function preflightSelection() {
    const response = await fetch(`${getDriveApiBaseUrl()}/api/drive/vault/preflight`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: selectedFiles.map(file => ({
          name: file.name,
          sizeBytes: file.size,
        })),
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string; remainingBytes?: number } | null
      if (response.status === 429) {
        const remaining = payload?.remainingBytes ?? 0
        throw new Error(`Vault Drive daily quota reached. ${formatBytes(remaining)} remaining today out of ${formatBytes(DAILY_QUOTA_BYTES)}.`)
      }
      throw new Error(payload?.error ?? `Preflight failed (${response.status})`)
    }
  }

  async function loadSessions() {
    if (!tokenPresent) return

    filesLoading = true
    error = ''
    try {
      const response = await fetch(`${getDriveApiBaseUrl()}/api/drive/vault/sessions`, {
        credentials: 'include',
      })
      const payload = await response.json().catch(() => null) as { sessions?: VaultDriveSessionRecord[]; error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? `Could not load Vault Drive sessions (${response.status})`)
      }

      sessions = payload?.sessions ?? []
      if (!activeSessionId && sessions[0]) {
        activeSessionId = sessions[0].id
      }
      if (activeSessionId && !sessions.some(session => session.id === activeSessionId)) {
        activeSessionId = sessions[0]?.id ?? ''
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load Vault Drive sessions'
    } finally {
      filesLoading = false
    }
  }

  async function uploadSelected() {
    if (selectedFiles.length === 0 || uploading) return

    uploading = true
    uploadProgress = 0
    uploadStepLabel = 'Checking Drive session'
    error = ''

    try {
      let token = getStoredToken()
      if (!token) {
        token = await syncDriveConnection()
      }
      if (!token) {
        if (tokenPresent) {
          throw new Error('Google Drive is connected, but Clex is still restoring the upload token. Refresh once and try again.')
        }
        throw new Error('Connect Google Drive before uploading Vault shares.')
      }

      uploadStepLabel = 'Checking file limits'
      await preflightSelection()

      uploadStepLabel = 'Creating Drive folder'
      const batch = await uploadDriveBatch(
        selectedFiles.map(file => ({
          blob: file,
          name: file.name,
          type: file.type,
        })),
        token,
        pct => {
          uploadProgress = pct
          uploadStepLabel = pct < 20
            ? 'Creating Drive folder'
            : pct < 88
              ? 'Uploading to your Google Drive'
              : 'Publishing Vault links'
        },
      )

      const response = await fetch(`${getDriveApiBaseUrl()}/api/drive/vault/finalize`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootFolderName: 'Clex Share',
          folder: {
            id: batch.folderId,
            name: batch.folderName,
            webViewLink: batch.webViewLink,
            directLink: batch.directLink,
          },
          files: batch.files,
        }),
      })

      const payload = await response.json().catch(() => null) as VaultDriveFinalizeResponse | { error?: string } | null
      if (!response.ok || !payload || !('session' in payload)) {
        throw new Error((payload && 'error' in payload ? payload.error : null) ?? `Could not publish Vault links (${response.status})`)
      }

      sessions = [payload.session, ...sessions.filter(session => session.id !== payload.session.id)]
      activeSessionId = payload.session.id
      selectedFiles = []
      await persistPendingVaultDriveFiles([])
      uploadStepLabel = 'Vault links ready'
      uploadProgress = 100
    } catch (err) {
      error = err instanceof Error ? err.message : 'Vault Drive upload failed'
    } finally {
      uploading = false
      setTimeout(() => {
        uploadProgress = 0
        uploadStepLabel = ''
      }, 1200)
    }
  }

  async function deleteSession(sessionId: string) {
    deleteBusyId = sessionId
    error = ''

    try {
      const response = await fetch(`${getDriveApiBaseUrl()}/api/drive/vault/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        throw new Error(payload?.error ?? `Could not delete Vault Drive session (${response.status})`)
      }

      sessions = sessions.filter(session => session.id !== sessionId)
      if (activeSessionId === sessionId) {
        activeSessionId = sessions[0]?.id ?? ''
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not delete Vault Drive session'
    } finally {
      deleteBusyId = ''
    }
  }

  async function copyLink(value: string, key: string) {
    await navigator.clipboard.writeText(value)
    linkCopied = key
    setTimeout(() => {
      if (linkCopied === key) linkCopied = ''
    }, 1600)
  }

  async function copyCode(value: string, key: string) {
    await navigator.clipboard.writeText(value)
    codeCopied = key
    setTimeout(() => {
      if (codeCopied === key) codeCopied = ''
    }, 1600)
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatSessionTitle(session: VaultDriveSessionRecord): string {
    if (session.files.length === 1) {
      return session.files[0].name
    }
    return `${session.files.length} Drive files`
  }
</script>

<div class="vcs-root">
  <div class="vcs-shell">
    <section class="vcs-main">
      <div class="vcs-header">
        <p class="vcs-kicker">Cloud Share</p>
        <h2 class="vcs-title">Google Drive handoff inside Vault</h2>
        <p class="vcs-subtitle">
          Files stay in your own Google Drive under <strong>Clex Share</strong>, each file gets its own Vault link and code, and every upload session auto-deletes after 24 hours.
        </p>
      </div>

      <div class="vcs-limit-row">
        <span class="vcs-limit-chip">1 GB per file</span>
        <span class="vcs-limit-chip">10 GB per day</span>
        <span class="vcs-limit-chip">24h auto-delete</span>
        <span class="vcs-limit-chip">Stored in your Drive</span>
      </div>

      {#if !tokenPresent}
        <div class="vcs-connect">
          <div class="vcs-panel-copy">
            <p class="vcs-connect-title">Connect Google Drive</p>
            <p class="vcs-connect-copy">
              Vault publishes links from your Google Drive account, not from a Clex relay bucket. Clex keeps the encrypted refresh token only so expired sessions can be deleted automatically after 24 hours.
            </p>
          </div>
          <button class="vcs-primary-btn" disabled={connectBusy} on:click={connectDrive}>
            {connectBusy ? 'Connecting…' : 'Connect Google Drive'}
          </button>
        </div>
      {:else}
        <div class="vcs-account-bar">
          <div class="vcs-panel-copy">
            <p class="vcs-account-title">{driveUser?.displayName ?? driveUser?.email ?? 'Google Drive connected'}</p>
            <p class="vcs-account-copy">Uploads are written to your Drive and cleaned up on the 24-hour window.</p>
          </div>
          <button class="vcs-secondary-btn" type="button" on:click={disconnectDrive}>
            Disconnect
          </button>
        </div>

        <div class="vcs-uploader">
          <div class="vcs-dropzone">
            <div class="vcs-panel-copy">
              <p class="vcs-dropzone-title">Queue files for Vault Drive</p>
              <p class="vcs-dropzone-copy">
                Every file receives its own direct link, QR, and code. If you upload more than one file, Vault also creates a folder handoff for the whole session.
              </p>
            </div>

            <div class="vcs-dropzone-actions">
              <button class="vcs-secondary-btn" type="button" on:click={promptFilePicker}>
                Select files
              </button>
              <button
                class="vcs-primary-btn"
                type="button"
                disabled={selectedFiles.length === 0 || uploading}
                on:click={uploadSelected}
              >
                {#if uploading}
                  Uploading…
                {:else}
                  Upload {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'}
                {/if}
              </button>
            </div>

            <input
              bind:this={fileInput}
              class="vcs-hidden-input"
              type="file"
              multiple
              on:change={handleFileSelection}
            />

            {#if uploadStepLabel}
              <div class="vcs-progress">
                <div class="vcs-progress-top">
                  <span>{uploadStepLabel}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div class="vcs-progress-bar">
                  <div class="vcs-progress-fill" style={`width:${uploadProgress}%`}></div>
                </div>
              </div>
            {/if}
          </div>

          {#if selectedFiles.length > 0}
            <div class="vcs-queue">
              <div class="vcs-section-head">
                <p class="vcs-section-title">Ready to publish</p>
                <span class="vcs-section-meta">{formatBytes(totalSelectedBytes)}</span>
              </div>
              <div class="vcs-list">
                {#each selectedFiles as file, index}
                  <div class="vcs-row">
                    <div class="vcs-row-copy">
                      <p class="vcs-row-title">{file.name}</p>
                      <p class="vcs-row-meta">{formatBytes(file.size)} · {file.type || 'Unknown type'}</p>
                    </div>
                    <button class="vcs-row-action" type="button" on:click={() => removeSelected(index)}>
                      Remove
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <div class="vcs-library">
        <div class="vcs-section-head">
          <p class="vcs-section-title">Active Drive sessions</p>
          <button class="vcs-inline-btn" type="button" disabled={filesLoading || !tokenPresent} on:click={loadSessions}>
            {filesLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {#if sessions.length > 0}
          <div class="vcs-list">
            {#each sessions as session}
              <button
                class="vcs-file-card"
                class:vcs-file-card--active={activeSession?.id === session.id}
                type="button"
                on:click={() => (activeSessionId = session.id)}
              >
                <div class="vcs-row-copy">
                  <p class="vcs-row-title">{formatSessionTitle(session)}</p>
                  <p class="vcs-row-meta">
                    {session.files.length} file{session.files.length === 1 ? '' : 's'} · {formatBytes(session.totalBytes)} · expires {formatDate(session.deleteAt)}
                  </p>
                </div>
                <span class="vcs-file-status">{session.folder ? 'Folder + files' : 'Direct file'}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="vcs-empty">
            {#if tokenPresent}
              No Vault Drive shares yet. Publish a file or folder session to start.
            {:else}
              Connect Google Drive to publish Vault Drive shares.
            {/if}
          </div>
        {/if}

        {#if error}
          <p class="vcs-error">{error}</p>
        {/if}
      </div>
    </section>

    <aside class="vcs-side">
      {#if activeSession}
        <div class="vcs-share-card">
          <p class="vcs-side-kicker">Selected session</p>
          <h3 class="vcs-side-title">{formatSessionTitle(activeSession)}</h3>
          <p class="vcs-side-copy">
            Every share below has its own Vault page, QR handoff, grouped code, and direct Drive target. The full session deletes automatically after 24 hours.
          </p>

          <div class="vcs-meta-grid">
            <div class="vcs-meta-card">
              <span class="vcs-meta-label">Files</span>
              <strong>{activeSession.files.length}</strong>
            </div>
            <div class="vcs-meta-card">
              <span class="vcs-meta-label">Total size</span>
              <strong>{formatBytes(activeSession.totalBytes)}</strong>
            </div>
            <div class="vcs-meta-card">
              <span class="vcs-meta-label">Expires</span>
              <strong>{formatDate(activeSession.deleteAt)}</strong>
            </div>
          </div>

          <div class="vcs-share-stack">
            {#each getActiveSessionShares(activeSession) as share}
              <div class="vcs-handoff-card">
                <div class="vcs-handoff-head">
                  <div class="vcs-panel-copy">
                    <p class="vcs-handoff-title">{share.kind === 'folder' ? 'Folder share' : share.title}</p>
                    <p class="vcs-handoff-subtitle">{share.kind === 'folder' ? share.subtitle : share.subtitle}</p>
                  </div>
                  <span class="vcs-handoff-chip">{share.kind === 'folder' ? 'All files' : 'Single file'}</span>
                </div>

                <div class="vcs-handoff-grid">
                  <div class="vcs-qr-wrap">
                    <QRCode value={share.url} size={132} />
                  </div>

                  <div class="vcs-handoff-copy">
                    <div class="vcs-handoff-row">
                      <span class="vcs-meta-label">Vault link</span>
                      <button class="vcs-inline-btn" type="button" on:click={() => copyLink(share.url, share.id)}>
                        {linkCopied === share.id ? 'Copied' : 'Copy link'}
                      </button>
                    </div>
                    <div class="vcs-link-box">{share.url}</div>

                    <div class="vcs-handoff-row">
                      <span class="vcs-meta-label">Access code</span>
                      <button class="vcs-inline-btn" type="button" on:click={() => copyCode(share.code, share.id)}>
                        {codeCopied === share.id ? 'Copied' : 'Copy code'}
                      </button>
                    </div>
                    <div class="vcs-code-box">{formatGroupedCode(share.code)}</div>
                  </div>
                </div>

                <div class="vcs-side-actions">
                  <a class="vcs-secondary-link" href={share.url} target="_blank" rel="noopener noreferrer">
                    Open Vault page
                  </a>
                  <a class="vcs-secondary-link" href={share.kind === 'folder' ? share.webViewLink : share.directLink} target="_blank" rel="noopener noreferrer">
                    {share.kind === 'folder' ? 'Open Drive folder' : 'Open direct file'}
                  </a>
                </div>
              </div>
            {/each}
          </div>

          <button
            class="vcs-danger-btn"
            type="button"
            disabled={deleteBusyId === activeSession.id}
            on:click={() => deleteSession(activeSession.id)}
          >
            {deleteBusyId === activeSession.id ? 'Deleting session…' : 'Delete this session'}
          </button>
        </div>
      {:else}
        <div class="vcs-placeholder">
          <p class="vcs-side-kicker">Drive handoff</p>
          <h3 class="vcs-side-title">Per-file links, QR, code, and folder share</h3>
          <p class="vcs-side-copy">
            Publish a Vault Drive session to generate direct links for each file, plus a folder share when you upload multiple files together.
          </p>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .vcs-root { width: 100%; }

  .vcs-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 390px);
    gap: 20px;
    align-items: start;
  }

  .vcs-main,
  .vcs-side {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 22px;
  }

  .vcs-header,
  .vcs-connect,
  .vcs-account-bar,
  .vcs-dropzone,
  .vcs-library,
  .vcs-queue,
  .vcs-share-card,
  .vcs-placeholder {
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    border-radius: 16px;
    box-shadow: 4px 4px 0 var(--border-hard);
    padding: 18px;
  }

  .vcs-header { display: flex; flex-direction: column; gap: 8px; }

  .vcs-kicker,
  .vcs-side-kicker,
  .vcs-meta-label,
  .vcs-section-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
    margin: 0;
  }

  .vcs-title,
  .vcs-side-title {
    font-family: var(--font-display);
    font-size: clamp(1.7rem, 2.5vw, 2.25rem);
    line-height: 1.02;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin: 0;
    text-wrap: balance;
  }

  .vcs-side-title { font-size: clamp(1.3rem, 2vw, 1.7rem); }

  .vcs-subtitle,
  .vcs-side-copy,
  .vcs-connect-copy,
  .vcs-account-copy,
  .vcs-dropzone-copy {
    margin: 0;
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-2);
  }

  .vcs-limit-row,
  .vcs-uploader,
  .vcs-share-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 18px;
  }

  .vcs-limit-row {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }

  .vcs-limit-chip {
    padding: 6px 10px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 999px;
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vcs-connect,
  .vcs-dropzone,
  .vcs-account-bar {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }

  .vcs-account-bar {
    margin-top: 18px;
    align-items: flex-start;
  }

  .vcs-panel-copy {
    flex: 1 1 18rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vcs-connect-title,
  .vcs-account-title,
  .vcs-dropzone-title,
  .vcs-row-title,
  .vcs-handoff-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }

  .vcs-account-title,
  .vcs-handoff-title { font-family: var(--font-display); letter-spacing: -0.02em; }

  .vcs-dropzone-actions,
  .vcs-section-head,
  .vcs-handoff-row,
  .vcs-side-actions,
  .vcs-handoff-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .vcs-dropzone-actions { width: 100%; justify-content: flex-end; }
  .vcs-section-head {
    margin-bottom: 10px;
    align-items: flex-start;
  }
  .vcs-handoff-head { align-items: flex-start; }
  .vcs-handoff-row,
  .vcs-side-actions { align-items: flex-start; }

  .vcs-primary-btn,
  .vcs-secondary-btn,
  .vcs-danger-btn,
  .vcs-inline-btn,
  .vcs-secondary-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 9px 15px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    flex-shrink: 0;
    max-width: 100%;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .vcs-primary-btn {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .vcs-secondary-btn,
  .vcs-secondary-link,
  .vcs-inline-btn {
    background: var(--surface);
    color: var(--text-1);
  }

  .vcs-danger-btn {
    width: 100%;
    background: color-mix(in srgb, var(--red) 10%, var(--surface));
    color: var(--red);
    margin-top: 18px;
  }

  .vcs-inline-btn {
    min-height: 28px;
    padding: 5px 10px;
    font-size: 12px;
    box-shadow: none;
  }

  .vcs-primary-btn:hover,
  .vcs-secondary-btn:hover,
  .vcs-danger-btn:hover,
  .vcs-secondary-link:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vcs-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .vcs-row,
  .vcs-file-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 15px;
    border-radius: 14px;
    border: 1.5px solid var(--border);
    background: color-mix(in srgb, var(--surface-2) 74%, var(--surface));
  }

  .vcs-file-card {
    cursor: pointer;
    text-align: left;
    transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
  }

  .vcs-file-card:hover {
    transform: translate(-1px, -1px);
    border-color: var(--border-hard);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vcs-file-card--active {
    border-color: color-mix(in srgb, var(--accent) 70%, var(--border-hard));
    box-shadow: 4px 4px 0 var(--border-hard);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }

  .vcs-row-copy { min-width: 0; }
  .vcs-row-title,
  .vcs-row-meta,
  .vcs-handoff-subtitle { margin: 0; }

  .vcs-row-meta,
  .vcs-handoff-subtitle,
  .vcs-section-meta {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.5;
  }

  .vcs-file-status,
  .vcs-handoff-chip {
    flex-shrink: 0;
    padding: 6px 10px;
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

  .vcs-progress {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vcs-progress-top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-2);
  }

  .vcs-progress-bar {
    width: 100%;
    height: 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--border) 70%, transparent);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .vcs-progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, white));
  }

  .vcs-hidden-input { display: none; }

  .vcs-queue,
  .vcs-library,
  .vcs-share-card,
  .vcs-placeholder {
    margin-top: 18px;
  }

  .vcs-empty,
  .vcs-error {
    padding: 14px;
    border-radius: 14px;
    border: 1.5px solid var(--border);
    background: color-mix(in srgb, var(--surface) 80%, var(--surface-2));
    color: var(--text-2);
    line-height: 1.6;
  }

  .vcs-error {
    border-color: color-mix(in srgb, var(--red) 40%, var(--border));
    color: var(--red);
    margin-top: 14px;
  }

  .vcs-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 18px;
  }

  .vcs-meta-card {
    padding: 12px;
    border-radius: 14px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .vcs-meta-card strong {
    display: block;
    margin-top: 8px;
    font-family: var(--font-display);
    font-size: 16px;
    color: var(--text-1);
  }

  .vcs-handoff-card {
    padding: 16px;
    border-radius: 16px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 3px 3px 0 var(--border-hard);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .vcs-handoff-grid {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }

  .vcs-qr-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    border-radius: 16px;
    border: 1.5px solid var(--border-hard);
    background: #fff;
    min-height: 156px;
  }

  .vcs-handoff-copy {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .vcs-link-box,
  .vcs-code-box {
    width: 100%;
    padding: 12px 13px;
    border-radius: 14px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
    color: var(--text-1);
    font-size: 12px;
    line-height: 1.55;
    word-break: break-word;
  }

  .vcs-code-box {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .vcs-row-action {
    min-height: 36px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--border-hard);
    font: inherit;
    font-weight: 700;
    color: var(--text-1);
    cursor: pointer;
  }

  .vcs-row-action:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vcs-dropzone-actions > *,
  .vcs-side-actions > * {
    flex: 1 1 11rem;
  }

  @media (max-width: 1040px) {
    .vcs-shell {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .vcs-connect,
    .vcs-account-bar,
    .vcs-dropzone,
    .vcs-section-head,
    .vcs-handoff-row,
    .vcs-side-actions,
    .vcs-handoff-head,
    .vcs-row,
    .vcs-file-card {
      flex-direction: column;
      align-items: stretch;
    }

    .vcs-handoff-grid {
      grid-template-columns: 1fr;
      align-items: stretch;
    }

    .vcs-meta-grid {
      grid-template-columns: 1fr;
    }

    .vcs-primary-btn,
    .vcs-secondary-btn,
    .vcs-secondary-link,
    .vcs-inline-btn,
    .vcs-row-action {
      width: 100%;
    }

    .vcs-dropzone-actions,
    .vcs-side-actions {
      width: 100%;
      justify-content: stretch;
    }

    .vcs-qr-wrap {
      width: min(100%, 180px);
      margin: 0 auto;
    }
  }
</style>
