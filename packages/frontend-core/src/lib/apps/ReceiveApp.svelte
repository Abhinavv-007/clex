<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { transferStore } from '$stores/transfer'
  import { getSignalingBaseUrl } from '$transfer/signaling'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import { isValidRoomCode } from '$utils/crypto'
  import { siteRoutes } from '$utils'
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

  $: state = $transferStore.state
  $: inputError = code.length > 0 && code.length < 6 ? 'Code must be 6 characters' : ''
  $: nearby = $transferStore.nearby
  $: normalizedCode = code.trim().toUpperCase()

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
              class="input-glass receive-input text-center font-mono text-3xl tracking-[0.4em] uppercase py-4"
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
            class="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
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
              <p class="receive-state-sub">Files will download automatically when complete</p>
            </div>
          </div>
          <TransferProgress />
        </div>

      {:else if state === 'complete'}
        <div class="receive-state receive-state--center">
          <div class="receive-complete-icon">✓</div>
          <div>
            <p class="receive-complete-title">Files received!</p>
            <p class="receive-state-sub">Check your downloads folder</p>
          </div>
          <div class="receive-actions">
            <button class="btn-secondary" on:click={reset}>Receive more</button>
            <a href={homeHref} class="btn-primary">Home</a>
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
    padding: 96px 24px 40px;
  }

  .receive-card-wrap {
    width: 100%;
    max-width: 420px;
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

  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes pulse-bar {
    0%, 100% { opacity: 0.65; transform: scaleX(0.98); }
    50% { opacity: 1; transform: scaleX(1); }
  }
</style>
