<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { transferStore } from '$stores/transfer'
  import { getSignalingBaseUrl } from '$transfer/signaling'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import { zipFiles } from '$tools/zip'
  import { isValidRoomCode } from '$utils/crypto'
  import { formatBytes, saveBlobWithSystemFallback, siteRoutes, truncateName, triggerBlobDownload } from '$utils'
  import type { TransferProfile } from '$transfer/types'
  import TransferProgress from '$components/sharing/TransferProgress.svelte'

  export let initialCode = ''
  export let initialMode: TransferProfile = 'webrtc'
  export let homeHref = siteRoutes.home
  export let backHref = siteRoutes.workspace

  const signalingUrl = getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL as string | undefined)

  let code = initialCode
  let selectedMode: TransferProfile = initialMode
  let error = ''
  let transfer: WebRTCTransfer | null = null
  let autoConnecting = false
  let saving = false

  $: state = $transferStore.state
  $: inputError = code.length > 0 && code.length < 6 ? 'Code must be 6 characters' : ''
  $: nearby = $transferStore.nearby
  $: normalizedCode = code.trim().toUpperCase()
  $: receivedFiles = $transferStore.receivedFiles

  onMount(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const codeParam = url.searchParams.get('code')
    const modeParam = url.searchParams.get('mode')

    if (!code && codeParam) {
      code = codeParam
    }
    if (modeParam === 'local' || modeParam === 'webrtc') {
      selectedMode = modeParam
    }

    if (code.trim()) {
      void connect(true)
    }
  })

  onDestroy(() => {
    transfer?.destroy()
  })

  async function connect(fromAutofill = false) {
    const trimmed = code.trim().toUpperCase()
    if (!isValidRoomCode(trimmed)) {
      if (!fromAutofill) {
        error = 'Please enter a valid 6-character room code'
      }
      return
    }

    error = ''
    autoConnecting = fromAutofill
    transfer?.destroy()
    transfer = new WebRTCTransfer(signalingUrl, trimmed, 'receiver', selectedMode)

    try {
      await transfer.initReceiver()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not connect'
      transferStore.setError(message)
      if (fromAutofill) {
        error = message
      }
    } finally {
      autoConnecting = false
    }
  }

  function reset() {
    transfer?.destroy()
    transfer = null
    code = ''
    error = ''
    autoConnecting = false
    selectedMode = initialMode
    transferStore.reset()

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      url.searchParams.delete('mode')
      window.history.replaceState({}, '', url.pathname)
    }
  }

  async function saveReceivedFile(index: number) {
    const file = receivedFiles[index]
    if (!file) return

    saving = true
    try {
      await saveBlobWithSystemFallback(file.blob, file.name, file.type)
    } finally {
      saving = false
    }
  }

  async function saveAllReceivedFiles() {
    if (receivedFiles.length === 0) return

    saving = true
    try {
      if (receivedFiles.length === 1) {
        await saveBlobWithSystemFallback(receivedFiles[0].blob, receivedFiles[0].name, receivedFiles[0].type)
        return
      }

      const archiveName = `${normalizedCode || 'clex-transfer'}.zip`
      const zipBlob = await zipFiles(
        receivedFiles.map(file => ({
          blob: file.blob,
          name: file.name,
        })),
        archiveName
      )

      await saveBlobWithSystemFallback(zipBlob, archiveName, 'application/zip')
    } finally {
      saving = false
    }
  }

  function downloadReceivedFile(index: number) {
    const file = receivedFiles[index]
    if (!file) return
    triggerBlobDownload(file.blob, file.name)
  }
</script>

<div class="receive-shell">
  <div class="receive-card-wrap">
    <div class="receive-head">
      <div
        class="receive-head-icon"
        style={state === 'complete'
          ? 'background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.3); color: #22c55e;'
          : 'background: rgba(124,58,237,0.12); border-color: rgba(124,58,237,0.25);'}
      >
        {#if state === 'complete'}
          ✓
        {:else}
          📥
        {/if}
      </div>

      <h1 class="receive-title">Receive Files</h1>
      <p class="receive-sub">
        {#if normalizedCode}
          Room <span class="font-mono receive-code-inline">{normalizedCode}</span>
        {:else}
          Enter the room code to connect with the sender
        {/if}
      </p>

      {#if nearby}
        <div class="receive-nearby">
          <span class="receive-nearby-dot" />
          Same network detected
        </div>
      {/if}
    </div>

    <div class="nb-card receive-card">
      {#if state === 'idle' || state === 'failed'}
        <div class="receive-form">
          <div>
            <input
              type="text"
              class="receive-input text-center font-mono uppercase"
              placeholder="XXXXXX"
              maxlength="6"
              bind:value={code}
              on:keydown={event => event.key === 'Enter' && connect()}
              autocomplete="off"
              spellcheck="false"
            />

            {#if inputError || error || ($transferStore.error && state === 'failed')}
              <p class="receive-error">{inputError || error || $transferStore.error}</p>
            {/if}
          </div>

          <div class="receive-mode-switch">
            <button
              class="receive-mode-btn"
              class:receive-mode-btn--active={selectedMode === 'webrtc'}
              on:click={() => (selectedMode = 'webrtc')}
            >
              Direct
            </button>
            <button
              class="receive-mode-btn"
              class:receive-mode-btn--active={selectedMode === 'local'}
              on:click={() => (selectedMode = 'local')}
            >
              Local
            </button>
          </div>

          <button
            class="btn-primary receive-primary"
            on:click={() => connect()}
            disabled={normalizedCode.length !== 6}
          >
            Connect & Receive
            <span>→</span>
          </button>

          {#if state === 'failed'}
            <button class="btn-secondary receive-secondary" on:click={reset}>Try again</button>
          {/if}
        </div>

      {:else if autoConnecting || state === 'preparing' || state === 'waiting_peer'}
        <div class="receive-state receive-state--center">
          <div class="receive-wait-icon">
            <div class="receive-wait-spin" />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
              <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <p class="receive-state-title">Waiting for sender…</p>
            <p class="receive-state-sub">Ready to receive when they start</p>
          </div>
          <button class="btn-secondary receive-secondary" on:click={reset}>Cancel</button>
        </div>

      {:else if state === 'connecting'}
        <div class="receive-state receive-state--center">
          <div class="receive-network-icon">🌐</div>
          <div>
            <p class="receive-state-title">Establishing connection…</p>
            <p class="receive-state-sub">Finding the best route</p>
          </div>
          <div class="receive-connecting-bar">
            <div class="receive-connecting-fill" />
          </div>
        </div>

      {:else if state === 'transferring'}
        <div class="receive-state">
          <div class="receive-transfer-head">
            <span class="receive-transfer-icon">📥</span>
            <div>
              <p class="receive-state-title">Receiving files…</p>
              <p class="receive-state-sub">We'll try to save automatically when complete, and manual save controls will stay available</p>
            </div>
          </div>
          <TransferProgress />
        </div>

      {:else if state === 'complete'}
        <div class="receive-state receive-state--center">
          <div class="receive-complete-icon">✓</div>
          <div>
            <p class="receive-complete-title">Files received!</p>
            <p class="receive-state-sub">
              Your browser may have saved the files automatically. If not, use the save controls below.
            </p>
          </div>
          {#if receivedFiles.length > 0}
            <div class="receive-save-panel">
              <button class="btn-primary receive-save-primary" on:click={saveAllReceivedFiles} disabled={saving}>
                {#if saving}
                  Preparing…
                {:else if receivedFiles.length === 1}
                  Save file
                {:else}
                  Save all as ZIP
                {/if}
              </button>

              {#if receivedFiles.length > 1}
                <div class="receive-file-actions">
                  {#each receivedFiles as file, index}
                    <button class="btn-secondary receive-file-btn" on:click={() => saveReceivedFile(index)} disabled={saving}>
                      <span>{truncateName(file.name, 28)}</span>
                      <span class="receive-file-size">{formatBytes(file.size)}</span>
                    </button>
                  {/each}
                </div>
              {:else}
                <button class="btn-secondary receive-file-btn" on:click={() => downloadReceivedFile(0)} disabled={saving}>
                  Download again
                </button>
              {/if}
            </div>
          {/if}
          <div class="receive-actions">
            <button class="btn-secondary" on:click={reset}>Receive more</button>
            <a href={homeHref} class="btn-secondary">Home</a>
          </div>
        </div>
      {/if}
    </div>

    <div class="receive-footer">
      <a href={backHref}>← Back</a>
    </div>
  </div>
</div>

<style>
  .receive-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
      calc(96px + env(safe-area-inset-top, 0px))
      calc(16px + env(safe-area-inset-right, 0px))
      calc(40px + env(safe-area-inset-bottom, 0px))
      calc(16px + env(safe-area-inset-left, 0px));
  }

  .receive-card-wrap {
    width: 100%;
    max-width: min(420px, 100%);
    min-width: 0;
  }

  .receive-head {
    text-align: center;
    margin-bottom: 28px;
  }

  .receive-head-icon {
    width: 80px;
    height: 80px;
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 40px;
    border: 1px solid;
  }

  .receive-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    color: var(--text-1);
  }

  .receive-sub {
    font-size: 14px;
    color: var(--text-2);
    margin-top: 8px;
  }

  .receive-code-inline {
    color: var(--violet);
  }

  .receive-nearby {
    margin-top: 12px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(34, 211, 238, 0.12);
    color: var(--cyan);
    font-size: 12px;
    font-weight: 600;
  }

  .receive-nearby-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .receive-card {
    padding: 24px;
    width: 100%;
    min-width: 0;
  }

  .receive-form,
  .receive-state {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .receive-state--center {
    text-align: center;
    align-items: center;
  }

  .receive-input {
    width: 100%;
    display: block;
    padding: 16px 18px;
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    background: var(--surface-2);
    box-shadow: 3px 3px 0 var(--border-hard);
    color: var(--text-1);
    font-size: 1.875rem;
    letter-spacing: 0.4em;
  }

  .receive-error {
    font-size: 12px;
    color: #ef4444;
    margin-top: 8px;
    text-align: center;
  }

  .receive-mode-switch {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    padding: 4px;
    border-radius: 12px;
    background: var(--surface-2);
    border: 2px solid var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .receive-mode-btn {
    border: 2px solid transparent;
    border-radius: 8px;
    background: transparent;
    padding: 10px 12px;
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
  }

  .receive-mode-btn--active {
    background: var(--surface);
    border-color: var(--border-hard);
    color: var(--text-1);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .receive-secondary {
    width: 100%;
    justify-content: center;
  }

  .receive-primary {
    width: 100%;
    justify-content: center;
    gap: 8px;
    padding: 14px 18px;
  }

  .receive-wait-icon {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .receive-wait-spin {
    position: absolute;
    inset: 0;
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-top-color: transparent;
    animation: spinSlow 3s linear infinite;
  }

  .receive-network-icon,
  .receive-transfer-icon {
    font-size: 40px;
    animation: float 6s ease-in-out infinite;
  }

  .receive-state-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
  }

  .receive-state-sub {
    font-size: 14px;
    color: var(--text-2);
    margin-top: 4px;
  }

  .receive-connecting-bar {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--surface-2);
  }

  .receive-connecting-fill {
    width: 60%;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--violet), var(--cyan));
    animation: pulse-bar 1.6s ease-in-out infinite;
  }

  .receive-transfer-head {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .receive-complete-icon {
    width: 72px;
    height: 72px;
    border-radius: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #22c55e;
    font-size: 36px;
    font-weight: 700;
  }

  .receive-complete-title {
    font-size: 22px;
    font-weight: 700;
    color: #22c55e;
  }

  .receive-actions {
    display: flex;
    gap: 12px;
    width: 100%;
  }

  .receive-save-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .receive-save-primary {
    width: 100%;
    justify-content: center;
  }

  .receive-file-actions {
    display: grid;
    gap: 8px;
    width: 100%;
  }

  .receive-file-btn {
    width: 100%;
    justify-content: space-between;
    gap: 12px;
    text-align: left;
    white-space: normal;
  }

  .receive-file-size {
    color: var(--text-3);
    font-size: 12px;
    flex-shrink: 0;
  }

  .receive-actions :global(.btn-primary),
  .receive-actions :global(.btn-secondary) {
    flex: 1;
    justify-content: center;
  }

  .receive-footer {
    text-align: center;
    margin-top: 20px;
  }

  .receive-footer a {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 767px) {
    .receive-shell {
      align-items: flex-start;
      padding-top: calc(88px + env(safe-area-inset-top, 0px));
    }

    .receive-card {
      padding: 18px;
      box-shadow: 3px 3px 0 var(--border-hard);
    }

    .receive-head-icon {
      width: 72px;
      height: 72px;
      font-size: 36px;
    }

    .receive-input {
      font-size: 1.625rem;
      letter-spacing: 0.24em;
      padding: 14px 16px;
    }

    .receive-transfer-head {
      align-items: flex-start;
    }

    .receive-actions {
      flex-direction: column;
    }
  }

  @media (max-width: 420px) {
    .receive-title {
      font-size: 24px;
    }

    .receive-sub {
      font-size: 13px;
    }

    .receive-mode-switch {
      gap: 4px;
      padding: 3px;
    }

    .receive-mode-btn {
      padding: 9px 10px;
      font-size: 14px;
    }

    .receive-state-title {
      font-size: 15px;
    }

    .receive-state-sub,
    .receive-error {
      font-size: 12px;
      line-height: 1.6;
    }

    .receive-file-btn {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes pulse-bar {
    0%, 100% { opacity: 0.65; transform: scaleX(0.98); }
    50% { opacity: 1; transform: scaleX(1); }
  }
</style>
