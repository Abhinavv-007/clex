<script lang="ts">
  import { filesStore } from '$stores/files'
  import { transferStore } from '$stores/transfer'
  import { uiStore } from '$stores/ui'
  import { uploadToDrive, getStoredToken, hasToken, initiateGoogleAuth, clearToken } from '$transfer/gdrive'
  import { formatBytes } from '$utils/format'
  import { onMount } from 'svelte'

  let uploadProgress = 0
  let uploading = false
  let uploadedLink = ''
  let error = ''
  let tokenPresent = false

  onMount(() => { tokenPresent = hasToken() })

  async function connectDrive() {
    error = ''

    try {
      await initiateGoogleAuth()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Drive connection could not be started'
      error = msg
      uiStore.toast({ type: 'error', message: msg })
    }
  }

  async function upload() {
    const files = $filesStore
    if (!files.length) {
      uiStore.toast({ type: 'error', message: 'Add files first' })
      return
    }

    const token = getStoredToken()
    if (!token) {
      await connectDrive()
      return
    }

    uploading = true
    uploadProgress = 0
    error = ''

    try {
      let blob: Blob
      let name: string

      if (files.length === 1) {
        const f = files[0]
        blob = f.processed?.blob ?? f.file
        name = f.processed?.name ?? f.name
      } else {
        const { zipFiles } = await import('$tools/zip')
        blob = await zipFiles(
          files.map(f => ({ blob: f.processed?.blob ?? f.file, name: f.processed?.name ?? f.name })),
          'clex-upload.zip'
        )
        name = 'clex-upload.zip'
      }

      const result = await uploadToDrive(blob, name, token, p => { uploadProgress = p })
      uploadedLink = result.webViewLink
      transferStore.setDriveLink(result.webViewLink)
      uiStore.toast({ type: 'success', message: 'Uploaded to Google Drive' })

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      error = msg
      if (msg.includes('401') || msg.includes('unauthorized')) {
        clearToken()
        tokenPresent = false
      }
    } finally {
      uploading = false
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(uploadedLink)
    uiStore.toast({ type: 'success', message: 'Link copied!' })
  }

  function reset() {
    uploadedLink = ''
    uploadProgress = 0
    error = ''
    transferStore.reset()
  }

  $: totalSize = $filesStore.reduce((sum, f) => sum + (f.processed?.blob?.size ?? f.size), 0)
</script>

<div class="dv-root">
  {#if uploadedLink}
    <!-- Success -->
    <div class="dv-card dv-card-center">
      <div class="dv-success-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 10.5l4.5 4.5 7.5-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="dv-state-title">Uploaded to Drive</p>
      <p class="dv-state-sub">Your file is ready to share</p>

      <div class="dv-link-box">{uploadedLink}</div>

      <div class="dv-action-row">
        <button class="dv-copy-btn" on:click={copyLink}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.1"/>
            <path d="M8.5 4.5v-2A1.2 1.2 0 007.3 1.3H2.8A1.2 1.2 0 001.5 2.5v4.5a1.2 1.2 0 001.3 1.2h2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
          Copy link
        </button>
        <a href={uploadedLink} target="_blank" rel="noopener noreferrer" class="dv-open-btn">
          Open ↗
        </a>
      </div>

      <button class="dv-reset-btn" on:click={reset}>Upload another</button>
    </div>

  {:else if uploading}
    <!-- Uploading -->
    <div class="dv-card">
      <div class="dv-upload-header">
        <div class="dv-upload-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <p class="dv-upload-title">Uploading to Drive…</p>
          <p class="dv-upload-sub">{formatBytes(totalSize)}</p>
        </div>
      </div>
      <div class="dv-prog-bar">
        <div class="dv-prog-fill" style="width: {uploadProgress}%" />
      </div>
      <span class="dv-prog-pct">{uploadProgress}%</span>
    </div>

  {:else if error}
    <!-- Error -->
    <div class="dv-card dv-card-error">
      <div class="dv-err-header">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/>
          <path d="M7 4.5V7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <circle cx="7" cy="9.5" r=".6" fill="currentColor"/>
        </svg>
        Upload failed
      </div>
      <p class="dv-err-msg">{error}</p>
      <button class="dv-reset-btn" on:click={() => (error = '')}>Try again</button>
    </div>

  {:else}
    <!-- Ready -->
    <div class="dv-card">
      <div class="dv-ready-header">
        <div class="dv-drive-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 13h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <p class="dv-ready-title">Google Drive</p>
          <p class="dv-ready-sub">Upload & get a shareable link</p>
        </div>
      </div>

      {#if !tokenPresent}
        <div class="dv-notice">
          Connect your Google account once. Clex only gets
          <strong>drive.file</strong> access — only files it creates.
        </div>
      {/if}

      <button
        class="dv-main-btn"
        disabled={!$filesStore.length}
        on:click={tokenPresent ? upload : connectDrive}
      >
        {#if tokenPresent}
          Upload {$filesStore.length} file{$filesStore.length !== 1 ? 's' : ''}
          {#if totalSize}
            <span class="dv-size">{formatBytes(totalSize)}</span>
          {/if}
        {:else}
          Connect Google Drive
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </button>

      {#if tokenPresent}
        <button class="dv-disconnect-btn" on:click={() => { clearToken(); tokenPresent = false; }}>
          Disconnect Drive
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dv-root { display: flex; flex-direction: column; }

  .dv-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .dv-card-center {
    align-items: center;
    text-align: center;
  }

  .dv-card-error { border-color: rgba(239,68,68,0.2); }

  /* Success */
  .dv-success-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
  }

  .dv-state-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .dv-state-sub { font-size: 12px; color: var(--text-3); }

  .dv-link-box {
    width: 100%;
    padding: 8px 12px;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 11px;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }

  .dv-action-row {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .dv-copy-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .dv-copy-btn:hover { opacity: 0.85; }

  .dv-open-btn {
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    text-decoration: none;
    transition: background 0.15s;
  }

  .dv-open-btn:hover { background: var(--raised); }

  .dv-reset-btn {
    font-size: 12px;
    color: var(--text-3);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    transition: color 0.15s;
  }

  .dv-reset-btn:hover { color: var(--text-1); }

  /* Upload state */
  .dv-upload-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dv-upload-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    animation: bounce 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes bounce {
    0%,100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .dv-upload-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .dv-upload-sub { font-size: 11px; color: var(--text-3); }

  .dv-prog-bar {
    height: 3px;
    background: var(--raised);
    border-radius: 100px;
    overflow: hidden;
  }

  .dv-prog-fill {
    height: 100%;
    background: var(--text-1);
    border-radius: 100px;
    transition: width 0.3s ease;
  }

  .dv-prog-pct { font-size: 11px; color: var(--text-3); }

  /* Error */
  .dv-err-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: #ef4444;
  }

  .dv-err-msg { font-size: 12px; color: var(--text-2); }

  /* Ready */
  .dv-ready-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .dv-drive-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    flex-shrink: 0;
  }

  .dv-ready-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .dv-ready-sub { font-size: 11px; color: var(--text-3); }

  .dv-notice {
    font-size: 12px;
    color: var(--text-2);
    padding: 10px 12px;
    background: rgba(245,158,11,0.06);
    border: 1px solid rgba(245,158,11,0.15);
    border-radius: 8px;
    line-height: 1.55;
  }

  .dv-notice strong { color: var(--text-1); }

  .dv-main-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 11px 16px;
    font-size: 13px;
    font-weight: 500;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .dv-main-btn:hover { opacity: 0.85; }
  .dv-main-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .dv-size { font-size: 11px; opacity: 0.6; font-weight: 400; }

  .dv-disconnect-btn {
    font-size: 11px;
    color: var(--text-3);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    text-align: center;
    transition: color 0.15s;
  }

  .dv-disconnect-btn:hover { color: #ef4444; }
</style>
