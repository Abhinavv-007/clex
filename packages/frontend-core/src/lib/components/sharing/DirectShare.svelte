<script lang="ts">
  import { onDestroy } from 'svelte'
  import { transferStore } from '$stores/transfer'
  import { filesStore } from '$stores/files'
  import { uiStore } from '$stores/ui'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import { getSignalingBaseUrl } from '$transfer/signaling'
  import type { TransferProfile } from '$transfer/types'
  import { siteRoutes } from '$utils'
  import { formatBytes } from '$utils/format'
  import TransferProgress from './TransferProgress.svelte'
  import QRCode from './QRCode.svelte'

  export let receiveBasePath = siteRoutes.receive
  export let receivePathFormat: 'segment' | 'query' = 'segment'

  const signalingUrl = getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL as string | undefined)

  let transfer: WebRTCTransfer | null = null
  let copied = false

  $: state = $transferStore.state
  $: nearby = $transferStore.nearby
  $: transferProfile = (($transferStore.method === 'local' ? 'local' : 'webrtc') as TransferProfile)
  // Room code comes from the store — generated once, persists across method tab switches
  $: roomCode = $transferStore.roomCode ?? ''
  $: receivePageUrl = typeof window !== 'undefined'
    ? buildReceivePageUrl(window.location.origin, roomCode, transferProfile)
    : buildReceivePath(roomCode, transferProfile)

  onDestroy(() => {
    transfer?.destroy()
    transfer = null
  })

  async function startSend() {
    const files = $filesStore
    if (!files.length) {
      uiStore.toast({ type: 'error', message: 'Add files first' })
      return
    }

    transfer?.destroy()

    const transferFiles = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      size: f.size,
      blob: f.processed?.blob ?? f.file,
    }))

    transfer = new WebRTCTransfer(signalingUrl, roomCode, 'sender', transferProfile)
    try {
      await transfer.initSender(transferFiles)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to signaling server'
      transferStore.setError(msg)
    }
  }

  function reset() {
    transfer?.destroy()
    transfer = null
    transferStore.reset() // reset() now generates a fresh room code in the store
  }

  async function copyLink() {
    await navigator.clipboard.writeText(receivePageUrl)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  $: totalSize = $filesStore.reduce((sum, f) => sum + f.size, 0)

  function buildReceivePath(roomCode: string, profile: TransferProfile): string {
    if (receivePathFormat === 'query') {
      const params = new URLSearchParams({ code: roomCode, mode: profile })
      return `${receiveBasePath}?${params.toString()}`
    }

    const params = new URLSearchParams({ mode: profile })
    return `${receiveBasePath}/${roomCode}?${params.toString()}`
  }

  function buildReceivePageUrl(origin: string, roomCode: string, profile: TransferProfile): string {
    return `${origin}${buildReceivePath(roomCode, profile)}`
  }
</script>

<div class="ds-root">
  {#if state === 'idle'}
    <div class="ds-card">
      {#if nearby}
        <div class="nearby-notice">
          <span class="nearby-dot" />
          Same network — fast transfer
        </div>
      {/if}

      <!-- Room code -->
      <div class="ds-section">
        <p class="ds-label">Share this code with the receiver</p>
        <div class="code-display">{roomCode}</div>
      </div>

      <div class="ds-ready-summary">
        <span class="ds-ready-label">Ready to send</span>
        <strong>
          {$filesStore.length} file{$filesStore.length !== 1 ? 's' : ''}
          {#if totalSize}
            <span class="ds-ready-size">· {formatBytes(totalSize)}</span>
          {/if}
        </strong>
      </div>

      <!-- Send -->
      <button
        class="btn-primary ds-send-btn"
        on:click={startSend}
        disabled={!$filesStore.length}
      >
        Send {$filesStore.length} file{$filesStore.length !== 1 ? 's' : ''}
        {#if totalSize}
          <span class="send-size">{formatBytes(totalSize)}</span>
        {/if}
      </button>

      <!-- Copy link -->
      <button class="btn-secondary ds-copy-btn" on:click={copyLink}>
        {#if copied}
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5L5 9 10.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Copied!
        {:else}
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="4.5" y="4.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.1"/>
            <path d="M8.5 4.5v-2A1.2 1.2 0 007.3 1.3H2.8A1.2 1.2 0 001.5 2.5v4.5a1.2 1.2 0 001.3 1.2h2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
          </svg>
          Copy receive link
        {/if}
      </button>

      <!-- QR code -->
      <div class="ds-qr-wrap">
        <QRCode value={receivePageUrl} size={148} />
        <p class="ds-qr-hint">Scan to open receive page</p>
      </div>
    </div>

  {:else if state === 'preparing' || state === 'waiting_peer'}
    <div class="ds-card ds-card-center">
      <div class="waiting-icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"/>
        </svg>
        <div class="waiting-ring" />
      </div>
      <p class="ds-state-title">Waiting for receiver…</p>
      <p class="ds-state-sub">
        Room code: <span class="code-inline">{roomCode}</span>
      </p>
      <button class="btn-secondary ds-cancel-btn" on:click={reset}>Cancel</button>
    </div>

  {:else if state === 'connecting'}
    <div class="ds-card ds-card-center">
      <div class="connecting-icon-wrap">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="ds-state-title">Establishing connection…</p>
      <p class="ds-state-sub">Finding the best route between devices</p>
      <div class="connecting-bar">
        <div class="connecting-fill" />
      </div>
    </div>

  {:else if state === 'transferring'}
    <div class="ds-card">
      <div class="transferring-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 13h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        <span class="transferring-title">Sending files…</span>
        {#if nearby}
          <span class="ds-badge-nearby">Local speed</span>
        {/if}
      </div>
      <TransferProgress />
    </div>

  {:else if state === 'complete'}
    <div class="ds-card ds-card-center">
      <div class="complete-icon">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M5 11l4.5 4.5L17 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <p class="ds-state-title">Transfer complete</p>
      <p class="ds-state-sub">
        {$filesStore.length} file{$filesStore.length !== 1 ? 's' : ''} delivered
      </p>
      <button class="btn-primary ds-cancel-btn" on:click={reset}>Send more files</button>
    </div>

  {:else if state === 'failed'}
    <div class="ds-card ds-card-error">
      <div class="error-header">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.3"/>
          <path d="M7.5 4.5v3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="7.5" cy="10" r=".75" fill="currentColor"/>
        </svg>
        <span>Connection failed</span>
      </div>
      <p class="error-msg">{$transferStore.error}</p>
      <div class="error-tip">
        Try <strong>Google Drive</strong> as a fallback — upload your files and share the link.
      </div>
      <button class="btn-secondary ds-cancel-btn" on:click={reset}>Try again</button>
    </div>
  {/if}
</div>

<style>
  .ds-root { display: flex; flex-direction: column; gap: 0; min-width: 0; }

  .ds-card {
    background: rgba(255, 255, 255, 0.015);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .ds-card-center {
    align-items: center;
    text-align: center;
  }

  .ds-card-error {
    border-color: rgba(239,68,68,0.3);
    background: rgba(239,68,68,0.02);
  }

  /* Nearby */
  .nearby-notice {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 500;
    color: #22c55e;
    padding: 5px 0;
  }

  .nearby-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
    animation: pulseDot 2s ease-in-out infinite;
  }

  @keyframes pulseDot {
    0%,100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
    50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(34,197,94,0); }
  }

  /* Label */
  .ds-label {
    font-size: 11px;
    color: var(--text-3);
    margin-bottom: 6px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ds-section { display: flex; flex-direction: column; }

  .ds-ready-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .ds-ready-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ds-ready-summary strong {
    font-size: 13px;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .ds-ready-size {
    color: var(--text-3);
    font-size: 12px;
    font-weight: 500;
  }

  /* Code display */
  .code-display {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.28em;
    color: var(--text-1);
    text-align: center;
    padding: 12px 16px;
    background: var(--raised);
    border: 1px solid var(--border);
    border-radius: 10px;
    text-transform: uppercase;
    user-select: all;
  }

  /* QR */
  .ds-qr-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .ds-qr-hint {
    font-size: 10px;
    color: var(--text-3);
  }

  /* Buttons */
  .ds-copy-btn {
    width: 100%;
    gap: 7px;
    font-size: 13px;
    padding: 9px 16px;
    justify-content: center;
    white-space: normal;
  }

  .ds-send-btn {
    width: 100%;
    gap: 8px;
    font-size: 13px;
    padding: 11px 16px;
    justify-content: center;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    background: var(--text-1);
    color: var(--text-inv);
    border: 1px solid transparent;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .ds-send-btn:hover { opacity: 0.85; }
  .ds-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .send-size {
    font-size: 11px;
    opacity: 0.6;
    font-weight: 400;
  }

  .ds-cancel-btn {
    font-size: 12px;
    padding: 7px 18px;
    margin-top: 4px;
  }

  /* State icons */
  .waiting-icon-wrap {
    position: relative;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    margin-bottom: 4px;
  }

  .waiting-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    animation: spinRing 3s linear infinite;
  }

  @keyframes spinRing {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .connecting-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    margin-bottom: 4px;
    animation: fadeInOut 1.5s ease-in-out infinite;
  }

  @keyframes fadeInOut {
    0%,100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  .connecting-bar {
    width: 100%;
    height: 3px;
    background: var(--raised);
    border-radius: 100px;
    overflow: hidden;
    margin-top: 8px;
  }

  .connecting-fill {
    height: 100%;
    width: 40%;
    background: var(--text-1);
    border-radius: 100px;
    animation: slideBar 1.5s ease-in-out infinite;
  }

  @keyframes slideBar {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(300%); }
  }

  .complete-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
    margin-bottom: 4px;
  }

  .ds-state-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .ds-state-sub {
    font-size: 12px;
    color: var(--text-3);
  }

  .code-inline {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: 0.1em;
  }

  /* Transfer */
  .transferring-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-1);
  }

  .ds-badge-nearby {
    margin-left: auto;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 100px;
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.2);
    color: #3b82f6;
    font-weight: 500;
  }

  /* Error */
  .error-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: #ef4444;
  }

  .error-msg {
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.5;
  }

  .error-tip {
    font-size: 12px;
    color: var(--text-2);
    padding: 10px 12px;
    background: rgba(245,158,11,0.06);
    border: 1px solid rgba(245,158,11,0.15);
    border-radius: 8px;
    line-height: 1.5;
  }

  .error-tip strong { color: var(--text-1); }

  @media (max-width: 767px) {
    .ds-card {
      padding: 14px;
    }

    .code-display {
      font-size: 22px;
      letter-spacing: 0.2em;
      padding: 11px 12px;
    }

    .ds-ready-summary {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .ds-send-btn {
      min-height: 46px;
      font-size: 14px;
      position: sticky;
      bottom: 0;
      z-index: 1;
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.18);
      flex-wrap: wrap;
    }

    .ds-qr-wrap {
      padding-top: 4px;
    }

    .ds-copy-btn,
    .ds-cancel-btn {
      white-space: normal;
    }
  }
</style>
