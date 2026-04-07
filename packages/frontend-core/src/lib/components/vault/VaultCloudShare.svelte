<script lang="ts">
  import { onMount } from 'svelte'
  import QRCode from '$components/sharing/QRCode.svelte'
  import { googleUser, masterKey, vaultActions, formatBytes } from '$stores/vault'
  import { signInWithGoogle } from '$lib/vault/auth'
  import { deriveGoogleKey } from '$lib/vault/crypto'

  export let vaultApiUrl = '/vault/api'

  interface SharedFile {
    id: string
    filename: string
    sizeBytes: number
    mimeType: string
    uploadAt: number
    deleteAt: number
  }

  const MAX_FILE_BYTES = 10 * 1024 * 1024

  let fileInput: HTMLInputElement | null = null
  let selectedFiles: File[] = []
  let sharedFiles: SharedFile[] = []
  let activeFileId = ''
  let filesLoading = false
  let uploading = false
  let uploadIndex = 0
  let uploadTotal = 0
  let deleteBusyId = ''
  let error = ''
  let lastLoadedUid = ''
  let linkCopied = false
  let connectBusy = false

  $: user = $googleUser
  $: key = $masterKey
  $: totalSelectedBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0)
  $: activeFile = sharedFiles.find((item) => item.id === activeFileId) ?? sharedFiles[0] ?? null
  $: shareUrl =
    activeFile && typeof window !== 'undefined'
      ? `${window.location.origin}/vault/share/${activeFile.id}`
      : ''

  $: if (user?.uid && user.uid !== lastLoadedUid) {
    lastLoadedUid = user.uid
    void loadFiles()
  }

  $: if (!user?.uid && lastLoadedUid) {
    lastLoadedUid = ''
    sharedFiles = []
    activeFileId = ''
  }

  onMount(() => {
    if (user?.uid) {
      void loadFiles()
    }
  })

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function mapApiError(
    payload: unknown,
    status: number,
    fallback: string,
    phase: 'load' | 'upload' | 'delete',
    fileName?: string,
  ): string {
    const apiMessage = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : ''

    if (status === 401) {
      return phase === 'load'
        ? 'Sign in with Google to load your Vault relay files.'
        : 'Sign in with Google before publishing Vault file links.'
    }

    if (status === 413) {
      return apiMessage || `${fileName ?? 'This file'} exceeds the 10 MB Vault limit.`
    }

    if (status === 429) {
      return apiMessage || 'Vault relay quota reached for today. Try again tomorrow or trim your upload batch.'
    }

    if (status === 400 || status === 411) {
      return apiMessage || 'Vault rejected this upload request. Refresh and try again.'
    }

    if (status >= 500) {
      if (apiMessage.includes('Supabase')) {
        return 'Vault reached the relay, but Supabase storage rejected the upload. Check the bucket, credentials, and CORS settings.'
      }

      return apiMessage || 'Vault relay is unavailable right now. Try again in a moment.'
    }

    return apiMessage || fallback
  }

  function mapThrownError(err: unknown, fallback: string): string {
    if (err instanceof TypeError) {
      return 'Vault relay could not be reached. Check your connection or deployment and try again.'
    }

    return err instanceof Error ? err.message : fallback
  }

  async function connectGoogle() {
    connectBusy = true
    error = ''

    try {
      const nextUser = await signInWithGoogle()
      if (!nextUser) return
      vaultActions.setGoogleUser(nextUser)
      const nextKey = await deriveGoogleKey(nextUser.uid)
      vaultActions.setMasterKey(nextKey)
    } catch (err) {
      error = mapThrownError(err, 'Google sign-in failed')
    } finally {
      connectBusy = false
    }
  }

  async function loadFiles() {
    if (!user?.uid) return
    filesLoading = true
    error = ''

    try {
      const res = await fetch(`${vaultApiUrl}/files`, {
        headers: { 'X-Vault-UID': user.uid },
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(mapApiError(payload, res.status, `Failed to load files (${res.status})`, 'load'))
      }

      sharedFiles = (payload.files ?? []) as SharedFile[]
      if (sharedFiles.length > 0 && !sharedFiles.some((item) => item.id === activeFileId)) {
        activeFileId = sharedFiles[0].id
      }
      if (sharedFiles.length === 0) {
        activeFileId = ''
      }
    } catch (err) {
      error = mapThrownError(err, 'Failed to load files')
    } finally {
      filesLoading = false
    }
  }

  function promptFilePicker() {
    fileInput?.click()
  }

  function handleFileSelection(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    const incoming = Array.from(target.files ?? [])
    const accepted: File[] = []
    const rejected: string[] = []

    for (const file of incoming) {
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} exceeds 10 MB`)
        continue
      }
      accepted.push(file)
    }

    if (accepted.length > 0) {
      const next = [...selectedFiles]
      for (const file of accepted) {
        const exists = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        )
        if (!exists) next.push(file)
      }
      selectedFiles = next
    }

    error = rejected.length > 0 ? rejected.join('. ') : ''
    target.value = ''
  }

  function removeSelected(index: number) {
    selectedFiles = selectedFiles.filter((_, itemIndex) => itemIndex !== index)
  }

  async function uploadSelected() {
    if (!user?.uid) {
      await connectGoogle()
      return
    }

    if (selectedFiles.length === 0 || uploading) return

    uploading = true
    uploadTotal = selectedFiles.length
    uploadIndex = 0
    error = ''

    try {
      for (const file of selectedFiles) {
        uploadIndex += 1

        const res = await fetch(`${vaultApiUrl}/files`, {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Filename': encodeURIComponent(file.name),
            'X-Subscription-ID': key?.roomId ?? 'vault',
            'X-Vault-UID': user.uid,
          },
          body: file,
        })

        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(
            mapApiError(payload, res.status, `Upload failed for ${file.name}`, 'upload', file.name),
          )
        }

        if (payload.id) {
          activeFileId = payload.id as string
        }
      }

      selectedFiles = []
      await loadFiles()
    } catch (err) {
      error = mapThrownError(err, 'Upload failed')
    } finally {
      uploading = false
      uploadIndex = 0
      uploadTotal = 0
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    linkCopied = true
    setTimeout(() => {
      linkCopied = false
    }, 1800)
  }

  async function deleteFile(id: string) {
    if (!user?.uid || deleteBusyId) return
    deleteBusyId = id
    error = ''

    try {
      const res = await fetch(`${vaultApiUrl}/files/${id}`, {
        method: 'DELETE',
        headers: { 'X-Vault-UID': user.uid },
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(mapApiError(payload, res.status, 'Failed to delete file', 'delete'))
      }

      sharedFiles = sharedFiles.filter((item) => item.id !== id)
      if (activeFileId === id) {
        activeFileId = sharedFiles[0]?.id ?? ''
      }
      await loadFiles()
    } catch (err) {
      error = mapThrownError(err, 'Failed to delete file')
    } finally {
      deleteBusyId = ''
    }
  }
</script>

<div class="vcs-root">
  <div class="vcs-shell">
    <section class="vcs-main">
      <div class="vcs-header">
        <p class="vcs-kicker">Cloud Share</p>
        <h2 class="vcs-title">Timed file relay with QR handoff</h2>
        <p class="vcs-subtitle">
          Upload inside Vault, share the link or QR code, and let the relay remove itself after 24 hours.
        </p>
      </div>

      <div class="vcs-limit-row">
        <span class="vcs-limit-chip">10 MB per file</span>
        <span class="vcs-limit-chip">100 MB per day</span>
        <span class="vcs-limit-chip">Auto-delete after 24 hours</span>
      </div>

      {#if !user}
        <div class="vcs-connect">
          <div>
            <p class="vcs-connect-title">Sign in to publish file links</p>
            <p class="vcs-connect-copy">
              Google sign-in lets Vault own the relay files, track the daily quota, and list active links on this device.
            </p>
          </div>
          <button class="vcs-primary-btn" disabled={connectBusy} on:click={connectGoogle}>
            {connectBusy ? 'Connecting…' : 'Connect Google'}
          </button>
        </div>
      {:else}
        <div class="vcs-uploader">
          <div class="vcs-dropzone">
            <div>
              <p class="vcs-dropzone-title">Queue files</p>
              <p class="vcs-dropzone-copy">
                Each file gets its own temporary link. Files stay capped at 10 MB and expire automatically after 24 hours.
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
                  Uploading {uploadIndex}/{uploadTotal || selectedFiles.length}
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
          </div>

          {#if selectedFiles.length > 0}
            <div class="vcs-queue">
              <div class="vcs-section-head">
                <p class="vcs-section-title">Ready to upload</p>
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
          <p class="vcs-section-title">Live file links</p>
          <button class="vcs-inline-btn" type="button" disabled={filesLoading || !user} on:click={loadFiles}>
            {filesLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {#if sharedFiles.length > 0}
          <div class="vcs-list">
            {#each sharedFiles as file}
              <button
                class="vcs-file-card"
                class:vcs-file-card--active={activeFile?.id === file.id}
                type="button"
                on:click={() => (activeFileId = file.id)}
              >
                <div class="vcs-row-copy">
                  <p class="vcs-row-title">{file.filename}</p>
                  <p class="vcs-row-meta">
                    {formatBytes(file.sizeBytes)} · expires {formatDate(file.deleteAt)}
                  </p>
                </div>
                <span class="vcs-file-status">Ready</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="vcs-empty">
            {#if user}
              No relay files yet. Upload a file to create the first timed link.
            {:else}
              Sign in to load your relay files.
            {/if}
          </div>
        {/if}

        {#if error}
          <p class="vcs-error">{error}</p>
        {/if}
      </div>
    </section>

    <aside class="vcs-side">
      {#if activeFile}
        <div class="vcs-share-card">
          <p class="vcs-side-kicker">Active share</p>
          <h3 class="vcs-side-title">{activeFile.filename}</h3>
          <p class="vcs-side-copy">
            Anyone with the QR code or URL can open the timed download page until the relay record expires.
          </p>

          <div class="vcs-qr-wrap">
            <QRCode value={shareUrl} size={180} />
          </div>

          <div class="vcs-link-box">{shareUrl}</div>

          <div class="vcs-side-actions">
            <button class="vcs-primary-btn" type="button" on:click={copyLink}>
              {linkCopied ? 'Copied' : 'Copy link'}
            </button>
            <a class="vcs-secondary-link" href={shareUrl} target="_blank" rel="noopener noreferrer">
              Open link
            </a>
          </div>

          <div class="vcs-meta-grid">
            <div class="vcs-meta-card">
              <span class="vcs-meta-label">Size</span>
              <strong>{formatBytes(activeFile.sizeBytes)}</strong>
            </div>
            <div class="vcs-meta-card">
              <span class="vcs-meta-label">Uploaded</span>
              <strong>{formatDate(activeFile.uploadAt)}</strong>
            </div>
            <div class="vcs-meta-card">
              <span class="vcs-meta-label">Expires</span>
              <strong>{formatDate(activeFile.deleteAt)}</strong>
            </div>
          </div>

          <button
            class="vcs-danger-btn"
            type="button"
            disabled={deleteBusyId === activeFile.id}
            on:click={() => deleteFile(activeFile.id)}
          >
            {deleteBusyId === activeFile.id ? 'Deleting…' : 'Delete link'}
          </button>
        </div>
      {:else}
        <div class="vcs-placeholder">
          <p class="vcs-side-kicker">Relay flow</p>
          <h3 class="vcs-side-title">Queue, publish, hand off</h3>
          <p class="vcs-side-copy">
            The right rail mirrors the workspace handoff pattern: pick a file, publish the link, then let the recipient scan or open it directly.
          </p>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .vcs-root {
    width: 100%;
  }

  .vcs-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 350px);
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

  .vcs-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

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
    font-size: clamp(2rem, 3vw, 2.75rem);
    line-height: 0.94;
    letter-spacing: -0.035em;
    color: var(--text-1);
    margin: 0;
    text-wrap: balance;
  }

  .vcs-side-title {
    font-size: clamp(1.5rem, 2.4vw, 2rem);
  }

  .vcs-subtitle,
  .vcs-side-copy,
  .vcs-connect-copy,
  .vcs-dropzone-copy {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
    margin: 0;
    max-width: 58ch;
  }

  .vcs-limit-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }

  .vcs-limit-chip {
    padding: 6px 10px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
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
  .vcs-library,
  .vcs-queue,
  .vcs-share-card,
  .vcs-placeholder {
    margin-top: 18px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    border-radius: 16px;
    box-shadow: 4px 4px 0 var(--border-hard);
    padding: 18px;
  }

  .vcs-connect,
  .vcs-dropzone {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .vcs-connect-title,
  .vcs-dropzone-title,
  .vcs-row-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }

  .vcs-row-title {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vcs-dropzone-actions,
  .vcs-side-actions,
  .vcs-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .vcs-section-meta,
  .vcs-row-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    margin: 0;
  }

  .vcs-hidden-input {
    display: none;
  }

  .vcs-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }

  .vcs-row,
  .vcs-file-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: var(--surface);
    border: 1.5px solid var(--border-hard);
    border-radius: 12px;
  }

  .vcs-file-card {
    width: 100%;
    text-align: left;
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--border-hard);
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
  }

  .vcs-file-card:hover,
  .vcs-primary-btn:hover,
  .vcs-secondary-btn:hover,
  .vcs-secondary-link:hover,
  .vcs-danger-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--border-hard);
  }

  .vcs-file-card--active {
    border-color: var(--accent);
    box-shadow: 4px 4px 0 var(--accent);
  }

  .vcs-row-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .vcs-file-status,
  .vcs-inline-btn,
  .vcs-row-action {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vcs-file-status {
    color: var(--accent-text);
  }

  .vcs-inline-btn,
  .vcs-row-action {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .vcs-link-box {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    color: var(--text-2);
    overflow-wrap: anywhere;
    margin-top: 18px;
  }

  .vcs-qr-wrap {
    display: flex;
    justify-content: center;
    margin-top: 18px;
  }

  .vcs-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .vcs-meta-card {
    padding: 12px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vcs-meta-card strong {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-1);
  }

  .vcs-primary-btn,
  .vcs-secondary-btn,
  .vcs-secondary-link,
  .vcs-danger-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 3px 3px 0 var(--border-hard);
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .vcs-primary-btn {
    background: var(--accent);
    color: #111;
  }

  .vcs-secondary-btn,
  .vcs-secondary-link {
    background: var(--surface);
    color: var(--text-1);
  }

  .vcs-danger-btn {
    background: #fff4f4;
    color: #8f1f1f;
    margin-top: 16px;
  }

  .vcs-primary-btn:disabled,
  .vcs-secondary-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vcs-empty,
  .vcs-error {
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-2);
    margin: 14px 0 0;
  }

  .vcs-error {
    color: #b42318;
  }

  @media (max-width: 1080px) {
    .vcs-shell {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .vcs-main,
    .vcs-side,
    .vcs-connect,
    .vcs-dropzone,
    .vcs-library,
    .vcs-queue,
    .vcs-share-card,
    .vcs-placeholder {
      padding: 16px;
    }

    .vcs-title,
    .vcs-side-title {
      font-size: 1.7rem;
    }

    .vcs-dropzone-actions,
    .vcs-side-actions,
    .vcs-section-head {
      flex-direction: column;
      align-items: stretch;
    }

    .vcs-meta-grid {
      grid-template-columns: 1fr;
    }

    .vcs-primary-btn,
    .vcs-secondary-btn,
    .vcs-secondary-link,
    .vcs-danger-btn {
      width: 100%;
    }
  }
</style>
