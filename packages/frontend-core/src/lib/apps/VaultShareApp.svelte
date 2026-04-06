<script lang="ts">
  /**
   * VaultShareApp — encrypted temp file share recipient page
   *
   * URL format: /vault/share/[key]
   * The [key] segment is the R2 object key / share token.
   *
   * Flow:
   * 1. Parse key from URL path
   * 2. GET /vault/api/files/<key> — returns signed R2 download URL + metadata
   * 3. Download file, show progress
   * 4. Trigger browser download
   */
  import { onMount } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  export let vaultApiUrl = '/vault/api'

  type Phase = 'loading' | 'ready' | 'downloading' | 'done' | 'expired' | 'error'
  let phase: Phase = 'loading'
  let errorMsg = ''

  interface FileMeta {
    filename: string
    sizeBytes: number
    mimeType: string
    expiresAt: number
  }
  let meta: FileMeta | null = null
  let downloadProgress = 0
  let downloadUrl = ''

  function extractKey(): string {
    const parts = window.location.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? ''
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function timeUntil(ts: number): string {
    const diff = ts - Date.now()
    if (diff <= 0) return 'expired'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  function mimeIcon(mime: string): string {
    if (mime.startsWith('image/')) return '🖼'
    if (mime.startsWith('video/')) return '🎬'
    if (mime.startsWith('audio/')) return '🎵'
    if (mime.includes('pdf')) return '📄'
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return '🗜'
    if (mime.includes('text/')) return '📝'
    if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊'
    return '📁'
  }

  async function loadMeta() {
    const key = extractKey()
    if (!key) {
      errorMsg = 'Invalid share link'
      phase = 'error'
      return
    }

    try {
      const res = await fetch(`${vaultApiUrl}/files/${key}`)
      if (res.status === 404 || res.status === 410) {
        phase = 'expired'
        return
      }
      if (!res.ok) {
        errorMsg = `Server error (${res.status})`
        phase = 'error'
        return
      }

      const data = await res.json() as {
        filename: string
        sizeBytes?: number
        mimeType: string
        expiresAt?: number
        expiresIn?: number
        downloadUrl?: string
        signedUrl?: string
      }

      meta = {
        filename: data.filename,
        sizeBytes: data.sizeBytes ?? 0,
        mimeType: data.mimeType,
        expiresAt: data.expiresAt ?? Date.now() + (data.expiresIn ?? 3600) * 1000,
      }
      downloadUrl = data.downloadUrl ?? data.signedUrl ?? ''

      if (meta.expiresAt < Date.now()) {
        phase = 'expired'
        return
      }

      phase = 'ready'
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : 'Failed to load file info'
      phase = 'error'
    }
  }

  async function downloadFile() {
    if (!meta || !downloadUrl) return
    phase = 'downloading'
    downloadProgress = 0

    try {
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)

      const total = parseInt(res.headers.get('content-length') ?? '0', 10)
      const reader = res.body!.getReader()
      const chunks: ArrayBuffer[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
        received += value.length
        if (total > 0) {
          downloadProgress = Math.round((received / total) * 100)
        }
      }

      downloadProgress = 100

      // Assemble + trigger browser download
      const blob = new Blob(chunks, { type: meta.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = meta.filename
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 1000)

      phase = 'done'
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : 'Download failed'
      phase = 'error'
    }
  }

  onMount(loadMeta)
</script>

<div class="vsh-page">

  <!-- ── Loading ─────────────────────────────────────────────────── -->
  {#if phase === 'loading'}
    <div class="vsh-center" in:fade={{ duration: 160 }}>
      <div class="vsh-spinner"></div>
    </div>

  <!-- ── Ready — show file card ─────────────────────────────────── -->
  {:else if phase === 'ready' && meta}
    <div class="vsh-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">{mimeIcon(meta.mimeType)}</div>
        <div class="vsh-file-info">
          <div class="vsh-filename">{meta.filename}</div>
          <div class="vsh-meta-row">
            <span class="vsh-meta-chip">{formatBytes(meta.sizeBytes)}</span>
            <span class="vsh-meta-chip">{meta.mimeType}</span>
            <span class="vsh-meta-chip vsh-meta-chip--expires">
              Expires in {timeUntil(meta.expiresAt)}
            </span>
          </div>
        </div>

        <div class="vsh-notice">
          <span class="vsh-notice-icon">🔒</span>
          <span>This file was shared privately via Vault. It will auto-delete after 24 hours.</span>
        </div>

        <button class="btn-accent vsh-dl-btn" on:click={downloadFile}>
          Download File
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v8M5 7l3 3 3-3M2 12h12"/>
          </svg>
        </button>
      </div>
    </div>

  <!-- ── Downloading ─────────────────────────────────────────────── -->
  {:else if phase === 'downloading' && meta}
    <div class="vsh-center" in:fade={{ duration: 160 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">{mimeIcon(meta.mimeType)}</div>
        <div class="vsh-dl-label">Downloading {meta.filename}…</div>
        <div class="vsh-progress-wrap">
          <div class="vsh-progress-bar">
            <div class="vsh-progress-fill" style="width: {downloadProgress}%"></div>
          </div>
          <span class="vsh-progress-pct">{downloadProgress}%</span>
        </div>
      </div>
    </div>

  <!-- ── Done ────────────────────────────────────────────────────── -->
  {:else if phase === 'done' && meta}
    <div class="vsh-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsh-card vsh-card--done">
        <div class="vsh-done-circle">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h2 class="vsh-title">Download complete</h2>
        <p class="vsh-desc">{meta.filename} has been saved to your device.</p>
        <a href="/vault" class="btn-ghost vsh-back-btn">← Back to Vault</a>
      </div>
    </div>

  <!-- ── Expired ─────────────────────────────────────────────────── -->
  {:else if phase === 'expired'}
    <div class="vsh-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">🗑</div>
        <h2 class="vsh-title">File Expired</h2>
        <p class="vsh-desc">This shared file has expired or was already downloaded. Vault files auto-delete after 24 hours.</p>
        <a href="/vault" class="btn-ghost vsh-back-btn">← Back to Vault</a>
      </div>
    </div>

  <!-- ── Error ───────────────────────────────────────────────────── -->
  {:else if phase === 'error'}
    <div class="vsh-center" in:fade={{ duration: 200 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">⚠</div>
        <h2 class="vsh-title">Something went wrong</h2>
        <p class="vsh-desc">{errorMsg}</p>
        <a href="/vault" class="btn-ghost vsh-back-btn">← Back to Vault</a>
      </div>
    </div>
  {/if}

</div>

<style>
  .vsh-page {
    min-height: 100vh;
    background: var(--canvas);
    padding: calc(80px + env(safe-area-inset-top, 0px)) 16px 40px;
  }

  .vsh-center {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 120px);
  }

  .vsh-card {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 20px;
    padding: 40px 36px;
    max-width: 420px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
  }

  .vsh-card--done {
    border-color: var(--green, #00e570);
    box-shadow: 6px 6px 0 var(--green, #00e570);
  }

  .vsh-file-icon {
    font-size: 52px;
    line-height: 1;
  }

  .vsh-file-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .vsh-filename {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.04em;
    line-height: 0.95;
    text-transform: uppercase;
    word-break: break-word;
  }

  .vsh-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .vsh-meta-chip {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .vsh-meta-chip--expires {
    color: var(--amber, #ffaa00);
    background: rgba(255, 170, 0, 0.08);
    border-color: rgba(255, 170, 0, 0.2);
  }

  .vsh-notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.6;
    text-align: left;
    width: 100%;
  }

  .vsh-notice-icon { flex-shrink: 0; }

  .vsh-dl-btn {
    width: 100%;
    justify-content: center;
    gap: 8px;
    font-size: 15px;
    padding: 12px 20px;
  }

  /* Progress */
  .vsh-dl-label {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-2);
  }

  .vsh-progress-wrap {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .vsh-progress-bar {
    flex: 1;
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
    border: 1.5px solid var(--border-hard);
  }

  .vsh-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
    transition: width 0.2s ease;
  }

  .vsh-progress-pct {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--text-2);
    min-width: 3ch;
    text-align: right;
  }

  /* Done circle */
  .vsh-done-circle {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--green, #00e570);
    border: 2px solid #000;
    box-shadow: 3px 3px 0 #000;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000;
  }

  .vsh-title {
    font-family: var(--font-display);
    font-size: clamp(1.9rem, 4vw, 2.35rem);
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.04em;
    line-height: 0.92;
    text-transform: uppercase;
    margin: 0;
  }

  .vsh-desc {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0;
  }

  .vsh-back-btn { font-size: 13px; }

  .vsh-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin-slow 0.8s linear infinite;
  }

  @media (max-width: 640px) {
    .vsh-card {
      padding: 28px 20px;
      border-radius: 16px;
    }
  }
</style>
