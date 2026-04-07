<script lang="ts">
  import { onMount } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { formatGroupedCode, normalizeRelayCode } from '$lib/vault/handoff'

  export let vaultApiUrl = '/vault/api'

  type Phase = 'entry' | 'loading' | 'ready' | 'downloading' | 'done' | 'expired' | 'error'
  let phase: Phase = 'loading'
  let errorMsg = ''
  let shareToken = ''
  let accessInput = ''

  interface FileMeta {
    filename: string
    sizeBytes: number
    mimeType: string
    expiresAt: number
  }

  let meta: FileMeta | null = null
  let downloadProgress = 0
  let downloadUrl = ''

  function extractPathToken(pathname: string): string {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length >= 3 && parts[0] === 'vault' && parts[1] === 'share') {
      return normalizeRelayCode(parts[2] ?? '')
    }
    return ''
  }

  function parseShareLocation(): string {
    const url = new URL(window.location.href)
    return normalizeRelayCode(
      url.searchParams.get('id') ??
      url.searchParams.get('code') ??
      extractPathToken(url.pathname),
    )
  }

  function parseShareInput(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
      try {
        const url = new URL(trimmed, window.location.origin)
        return normalizeRelayCode(
          url.searchParams.get('id') ??
          url.searchParams.get('code') ??
          extractPathToken(url.pathname),
        )
      } catch {
        return ''
      }
    }

    return normalizeRelayCode(trimmed)
  }

  function applyShareLocation(token: string) {
    shareToken = token
    const url = new URL(window.location.href)
    url.searchParams.set('id', token)
    history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function timeUntil(timestamp: number): string {
    const diff = timestamp - Date.now()
    if (diff <= 0) return 'expired'
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
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
    const key = shareToken || parseShareLocation()
    if (!key) {
      errorMsg = 'Paste the file link or relay code from Vault.'
      phase = 'entry'
      return
    }

    shareToken = key

    try {
      const res = await fetch(`${vaultApiUrl}/files/${encodeURIComponent(key)}`)
      if (res.status === 404 || res.status === 410) {
        phase = 'expired'
        return
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null
        errorMsg = payload?.error ?? `Server error (${res.status})`
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
    } catch (eventualError: unknown) {
      errorMsg = eventualError instanceof Error ? eventualError.message : 'Failed to load file info'
      phase = 'error'
    }
  }

  async function acceptAccessInput() {
    const token = parseShareInput(accessInput)

    if (!token) {
      errorMsg = 'Paste the direct file link or the relay code from Vault.'
      phase = 'entry'
      return
    }

    errorMsg = ''
    applyShareLocation(token)
    phase = 'loading'
    await loadMeta()
  }

  async function downloadFile() {
    if (!meta || !downloadUrl) return
    phase = 'downloading'
    downloadProgress = 0

    try {
      const res = await fetch(downloadUrl)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)

      const total = parseInt(res.headers.get('content-length') ?? '0', 10)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Download stream unavailable')

      const chunks: BlobPart[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total > 0) {
          downloadProgress = Math.round((received / total) * 100)
        }
      }

      downloadProgress = 100

      const blob = new Blob(chunks, { type: meta.mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = meta.filename
      document.body.appendChild(anchor)
      anchor.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        document.body.removeChild(anchor)
      }, 1000)

      phase = 'done'
    } catch (eventualError: unknown) {
      errorMsg = eventualError instanceof Error ? eventualError.message : 'Download failed'
      phase = 'error'
    }
  }

  onMount(() => {
    const token = parseShareLocation()
    if (!token) {
      phase = 'entry'
      return
    }

    shareToken = token
    void loadMeta()
  })

  $: formattedShareToken = formatGroupedCode(shareToken)
</script>

<div class="vsh-page">
  {#if phase === 'loading'}
    <div class="vsh-center" in:fade={{ duration: 160 }}>
      <div class="vsh-spinner"></div>
    </div>

  {:else if phase === 'entry'}
    <div class="vsh-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">⇄</div>
        <h1 class="vsh-title">Open a Vault file</h1>
        <p class="vsh-desc">Paste the direct file link or the relay code from Cloud Share.</p>

        <div class="vsh-entry-stack">
          <textarea
            class="input vsh-entry-input"
            rows="3"
            placeholder="Paste the file link or relay code"
            bind:value={accessInput}
            on:keydown={(event) => event.key === 'Enter' && !event.shiftKey && (event.preventDefault(), acceptAccessInput())}
          ></textarea>

          {#if errorMsg}
            <p class="vsh-desc vsh-desc--error">{errorMsg}</p>
          {/if}

          <button class="btn-accent vsh-dl-btn" on:click={acceptAccessInput}>
            Continue
          </button>
        </div>

        <p class="vsh-entry-note">
          QR scans from Vault open this page automatically. Use the relay code when a direct link is not practical to send.
        </p>
      </div>
    </div>

  {:else if phase === 'ready' && meta}
    <div class="vsh-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">{mimeIcon(meta.mimeType)}</div>
        <div class="vsh-file-info">
          <div class="vsh-filename">{meta.filename}</div>
          <div class="vsh-meta-row">
            <span class="vsh-meta-chip">{formatBytes(meta.sizeBytes)}</span>
            <span class="vsh-meta-chip">{meta.mimeType}</span>
            <span class="vsh-meta-chip">Code {formattedShareToken}</span>
            <span class="vsh-meta-chip vsh-meta-chip--expires">
              Expires in {timeUntil(meta.expiresAt)}
            </span>
          </div>
        </div>

        <div class="vsh-notice">
          <span class="vsh-notice-icon">🔒</span>
          <span>This file was shared privately via Vault. It auto-deletes after 24 hours and only the holder of the link or relay code can open this page.</span>
        </div>

        <button class="btn-accent vsh-dl-btn" on:click={downloadFile}>
          Download file
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 2v8M5 7l3 3 3-3M2 12h12"/>
          </svg>
        </button>
      </div>
    </div>

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

  {:else if phase === 'expired'}
    <div class="vsh-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsh-card">
        <div class="vsh-file-icon">🗑</div>
        <h2 class="vsh-title">File expired</h2>
        <p class="vsh-desc">This file link is no longer available. Vault relay files auto-delete after 24 hours.</p>
        <a href="/vault" class="btn-ghost vsh-back-btn">← Back to Vault</a>
      </div>
    </div>

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
    max-width: 560px;
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

  .vsh-entry-stack {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .vsh-entry-input {
    min-height: 104px;
    resize: vertical;
    font-size: 14px;
    line-height: 1.6;
  }

  .vsh-entry-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-3);
  }

  .vsh-file-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .vsh-filename,
  .vsh-title {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    line-height: 1.02;
    margin: 0;
    text-wrap: balance;
  }

  .vsh-filename {
    font-size: clamp(1.45rem, 2.2vw, 1.9rem);
    word-break: break-word;
  }

  .vsh-title {
    font-size: clamp(1.9rem, 3vw, 2.35rem);
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
    border-radius: 999px;
    padding: 4px 10px;
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
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.6;
    text-align: left;
    width: 100%;
  }

  .vsh-notice-icon {
    flex-shrink: 0;
  }

  .vsh-dl-btn {
    width: 100%;
    justify-content: center;
    gap: 8px;
    font-size: 15px;
    padding: 12px 20px;
  }

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

  .vsh-desc {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0;
  }

  .vsh-desc--error {
    color: var(--red, #ff4444);
  }

  .vsh-back-btn {
    font-size: 13px;
  }

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
