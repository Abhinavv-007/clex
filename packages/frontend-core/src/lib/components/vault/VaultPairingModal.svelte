<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import { masterKey, vaultActions } from '$stores/vault'
  import { startPairingAsSender, completePairingAsReceiver, type PairingDeviceInfo } from '$lib/vault/pairing'
  import { storeMasterKeyFromRaw } from '$lib/vault/crypto'
  import { detectDeviceName, getDeviceFingerprint, saveDevice, type StoredDevice } from '$lib/vault/db'
  import { formatGroupedCode } from '$lib/vault/handoff'
  import { scale, fade } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import QRCode from '$components/sharing/QRCode.svelte'

  export let vaultApiUrl = '/vault/api'
  export let initialTab: Tab = 'sender'
  export let prefillCode = ''
  export let autoConnect = false

  const dispatch = createEventDispatcher<{ close: void }>()

  type Tab = 'sender' | 'receiver'
  type Status = 'idle' | 'waiting' | 'connecting' | 'connected' | 'complete' | 'failed' | 'expired'

  let tab: Tab = 'sender'
  let status: Status = 'idle'
  let pairingCode = ''
  let pairingLink = ''
  let qrPayload = ''
  let expiresAt = 0
  let receiverCode = ''
  let error = ''
  let countdown = 300
  let codeCopied = false
  let linkCopied = false

  let countdownTimer: ReturnType<typeof setInterval> | null = null
  let localDeviceFingerprint = ''

  onMount(() => {
    tab = initialTab
    receiverCode = sanitizeCode(prefillCode)

    void (async () => {
      localDeviceFingerprint = await getDeviceFingerprint()

      if (tab === 'receiver' && autoConnect && receiverCode.length === 8) {
        void startReceiver()
      }
    })()
  })

  onDestroy(() => {
    clearCountdown()
  })

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function close() {
    clearCountdown()
    dispatch('close')
    vaultActions.closePairingModal()
  }

  function handleBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) close()
  }

  function sanitizeCode(raw: string): string {
    return raw.replace(/\D/g, '').slice(0, 8)
  }

  function switchTab(nextTab: Tab) {
    tab = nextTab
    status = 'idle'
    error = ''
    codeCopied = false
    linkCopied = false

    if (nextTab === 'sender') {
      pairingCode = ''
      pairingLink = ''
      qrPayload = ''
      expiresAt = 0
      clearCountdown()
    }
  }

  function handleReceiverInput(event: Event) {
    receiverCode = sanitizeCode((event.currentTarget as HTMLInputElement).value)
    if (status === 'failed') {
      status = 'idle'
      error = ''
    }
  }

  async function startSender() {
    const key = $masterKey
    if (!key) {
      error = 'No master key found. Reload Vault and try again.'
      return
    }

    const localDevice = await getLocalDeviceInfo()

    status = 'waiting'
    error = ''
    pairingCode = ''
    pairingLink = ''
    qrPayload = ''
    codeCopied = false
    linkCopied = false

    try {
      const result = await startPairingAsSender(
        vaultApiUrl,
        key,
        localDevice,
        (nextStatus) => {
          status = nextStatus as Status
        },
        () => {
          status = 'complete'
          clearCountdown()
        },
        (remoteDevice) => {
          void storePairedDevice(remoteDevice)
        },
      )

      pairingCode = result.code
      pairingLink = result.pairingLink
      qrPayload = result.qrPayload
      expiresAt = result.expiresAt
      startCountdown()
    } catch (eventualError: unknown) {
      status = 'failed'
      error = eventualError instanceof Error ? eventualError.message : 'Pairing failed'
    }
  }

  function startCountdown() {
    countdown = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
    clearCountdown()
    countdownTimer = setInterval(() => {
      countdown = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      if (countdown <= 0) {
        clearCountdown()
        if (status === 'waiting') {
          status = 'expired'
        }
      }
    }, 1000)
  }

  async function startReceiver() {
    receiverCode = sanitizeCode(receiverCode)

    if (receiverCode.length !== 8) {
      error = 'Enter the 8-digit code shown on the other device.'
      status = 'idle'
      return
    }

    status = 'connecting'
    error = ''

    try {
      const localDevice = await getLocalDeviceInfo()
      await completePairingAsReceiver(
        receiverCode,
        vaultApiUrl,
        localDevice,
        (nextStatus) => {
          status = nextStatus as Status
        },
        async (rawKey) => {
          const nextKey = await storeMasterKeyFromRaw(rawKey)
          vaultActions.setMasterKey(nextKey)
          status = 'complete'
          setTimeout(close, 1800)
        },
        (remoteDevice) => {
          void storePairedDevice(remoteDevice)
        },
      )
    } catch (eventualError: unknown) {
      status = 'failed'
      error = eventualError instanceof Error ? eventualError.message : 'Could not complete pairing'
    }
  }

  async function copyCode() {
    const nextCode = tab === 'sender' ? pairingCode : receiverCode
    if (!nextCode) return
    await navigator.clipboard.writeText(nextCode)
    codeCopied = true
    setTimeout(() => {
      codeCopied = false
    }, 1800)
  }

  async function copyLink() {
    if (!pairingLink) return
    await navigator.clipboard.writeText(pairingLink)
    linkCopied = true
    setTimeout(() => {
      linkCopied = false
    }, 1800)
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    return `${minutes}:${remainder.toString().padStart(2, '0')}`
  }

  async function getLocalDeviceInfo(): Promise<PairingDeviceInfo> {
    const id = localDeviceFingerprint || await getDeviceFingerprint()
    localDeviceFingerprint = id

    return {
      id,
      name: detectDeviceName(),
      lastSeen: Date.now(),
    }
  }

  async function storePairedDevice(deviceInfo: PairingDeviceInfo | null) {
    if (!deviceInfo?.id || deviceInfo.id === localDeviceFingerprint) return

    const device: StoredDevice = {
      id: deviceInfo.id,
      name: deviceInfo.name,
      pairedAt: Date.now(),
      lastSeen: deviceInfo.lastSeen,
      roomVersion: 1,
    }

    await saveDevice(device)
    vaultActions.upsertDevice(device)
  }

  $: groupedPairingCode = formatGroupedCode(pairingCode)
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="vpm-backdrop"
  on:click={handleBackdrop}
  role="presentation"
  transition:fade={{ duration: 200 }}
>
  <div
    class="vpm-panel nb-card"
    transition:scale={{ duration: 300, easing: quintOut, start: 0.96 }}
    role="dialog"
    aria-modal="true"
    aria-label="Add Device"
  >
    <div class="vpm-header">
      <div class="vpm-header-copy">
        <p class="vpm-kicker">Quick Connect</p>
        <h2 class="vpm-title">Add another Vault device</h2>
        <p class="vpm-subtitle">Use a QR scan, a direct handoff link, or the 8-digit code.</p>
      </div>
      <button class="btn-icon" on:click={close} aria-label="Close">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M3 3l9 9M12 3L3 12"/>
        </svg>
      </button>
    </div>

    <div class="vpm-tabs" role="tablist" aria-label="Pairing mode">
      <button
        class="vpm-tab"
        class:vpm-tab--active={tab === 'sender'}
        type="button"
        on:click={() => switchTab('sender')}
      >This device has the key</button>
      <button
        class="vpm-tab"
        class:vpm-tab--active={tab === 'receiver'}
        type="button"
        on:click={() => switchTab('receiver')}
      >This is a new device</button>
    </div>

    <div class="vpm-body">
      {#if tab === 'sender'}
        {#if status === 'idle'}
          <div class="vpm-intro" in:fade={{ duration: 160 }}>
            <div class="vpm-intro-card">
              <span class="vpm-intro-label">Scan, tap, or type</span>
              <h3 class="vpm-intro-title">Generate a temporary pairing handoff</h3>
              <p class="vpm-desc">
                Open Vault on the new device, then scan the QR code, open the quick-connect link, or paste the 8-digit code manually.
              </p>
            </div>
            <button class="btn-primary vpm-start-btn" on:click={startSender}>
              Generate pairing handoff
            </button>
          </div>

        {:else if status === 'waiting' || status === 'connecting' || status === 'connected'}
          <div class="vpm-pair-layout" in:fade={{ duration: 180 }}>
            <div class="vpm-qr-side">
              <div class="vpm-qr-header">
                <span class="vpm-qr-label">Scan to open Vault instantly</span>
                <span class="vpm-chip">Preferred</span>
              </div>
              <div class="vpm-qr-wrap">
                {#if qrPayload}
                  <QRCode value={qrPayload} size={184} />
                {:else}
                  <div class="vpm-qr-placeholder">
                    <span class="animate-spin-slow" style="font-size: 28px;">◌</span>
                  </div>
                {/if}
              </div>
              <p class="vpm-helper">
                The QR opens <code>/vault</code> with the pairing code prefilled on the receiving device.
              </p>
            </div>

            <div class="vpm-code-side">
              <div class="vpm-code-card">
                <div class="vpm-code-head">
                  <span class="vpm-code-label">8-digit pairing code</span>
                  <button class="vpm-inline-btn" type="button" on:click={copyCode}>
                    {codeCopied ? 'Copied' : 'Copy code'}
                  </button>
                </div>
                <div class="vpm-code-display">
                  {#if pairingCode}
                    {groupedPairingCode}
                  {:else}
                    ···· ····
                  {/if}
                </div>
                <p class="vpm-helper">Paste this into Vault on the new device if you cannot scan.</p>
              </div>

              <div class="vpm-link-card">
                <div class="vpm-code-head">
                  <span class="vpm-code-label">Quick-connect link</span>
                  <button class="vpm-inline-btn" type="button" on:click={copyLink}>
                    {linkCopied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <div class="vpm-link-box">{pairingLink}</div>
              </div>

              <div class="vpm-status-card">
                <div class="vpm-status-row">
                  {#if status === 'waiting'}
                    <span class="vpm-status-dot vpm-status-dot--pulse"></span>
                    <span class="vpm-status-text">Waiting for the new device to connect</span>
                  {:else if status === 'connecting'}
                    <span class="vpm-status-dot vpm-status-dot--amber"></span>
                    <span class="vpm-status-text">Establishing a secure direct channel</span>
                  {:else if status === 'connected'}
                    <span class="vpm-status-dot vpm-status-dot--green"></span>
                    <span class="vpm-status-text">Transferring the local master key now</span>
                  {/if}
                </div>

                <div class="vpm-countdown" class:vpm-countdown--urgent={countdown < 60}>
                  Expires in {formatTime(countdown)}
                </div>
              </div>
            </div>
          </div>

        {:else if status === 'complete'}
          <div class="vpm-success" in:scale={{ duration: 280, easing: quintOut, start: 0.9 }}>
            <div class="vpm-success-icon">✓</div>
            <h3 class="vpm-success-title">Device paired</h3>
            <p class="vpm-success-sub">Vault can now decrypt the same local data on both devices.</p>
            <button class="btn-primary" on:click={close}>Done</button>
          </div>

        {:else if status === 'expired'}
          <div class="vpm-error" in:fade={{ duration: 160 }}>
            <p>The pairing window expired.</p>
            <button class="vpm-retry-link" type="button" on:click={startSender}>Generate a new handoff</button>
          </div>

        {:else if status === 'failed'}
          <div class="vpm-error" in:fade={{ duration: 160 }}>
            <p>{error || 'Pairing failed.'}</p>
            <button class="vpm-retry-link" type="button" on:click={() => switchTab('sender')}>Try again</button>
          </div>
        {/if}

      {:else}
        {#if status === 'idle' || status === 'failed'}
          <div class="vpm-receiver-form" in:fade={{ duration: 160 }}>
            <div class="vpm-intro-card">
              <span class="vpm-intro-label">Manual connect</span>
              <h3 class="vpm-intro-title">Enter the 8-digit pairing code</h3>
              <p class="vpm-desc">
                If you scanned the QR code, Vault should fill this automatically. Otherwise type the code shown on the other device.
              </p>
            </div>

            <div class="vpm-code-input-row">
              <input
                class="input-code input"
                type="text"
                inputmode="numeric"
                maxlength="11"
                placeholder="0000 0000"
                value={formatGroupedCode(receiverCode)}
                on:input={handleReceiverInput}
                on:keydown={(event) => event.key === 'Enter' && startReceiver()}
              />
            </div>

            <div class="vpm-action-row">
              <button class="btn-primary vpm-start-btn" disabled={receiverCode.length < 8} on:click={startReceiver}>
                Connect
              </button>
              <button class="vpm-inline-btn" type="button" disabled={receiverCode.length < 8} on:click={copyCode}>
                {codeCopied ? 'Copied' : 'Copy typed code'}
              </button>
            </div>

            {#if error}
              <p class="vpm-err">{error}</p>
            {/if}
          </div>

        {:else if status === 'connecting' || status === 'connected'}
          <div class="vpm-connecting" in:fade={{ duration: 160 }}>
            <div class="vpm-spinner"></div>
            <p class="vpm-status-text">
              {status === 'connecting' ? 'Connecting to the other device…' : 'Receiving the encryption key…'}
            </p>
          </div>

        {:else if status === 'complete'}
          <div class="vpm-success" in:scale={{ duration: 280, easing: quintOut, start: 0.9 }}>
            <div class="vpm-success-icon">✓</div>
            <h3 class="vpm-success-title">Pairing complete</h3>
            <p class="vpm-success-sub">Vault is ready on this device.</p>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .vpm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 8000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(8, 8, 16, 0.82);
    backdrop-filter: blur(8px);
  }

  .vpm-panel {
    width: 100%;
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .vpm-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 24px 18px;
    border-bottom: 1px solid var(--border);
  }

  .vpm-header-copy {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vpm-kicker,
  .vpm-qr-label,
  .vpm-code-label,
  .vpm-intro-label {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vpm-title,
  .vpm-intro-title {
    font-family: var(--font-display);
    font-size: clamp(1.65rem, 2.2vw, 2rem);
    font-weight: 700;
    line-height: 1.02;
    letter-spacing: -0.03em;
    color: var(--text-1);
    margin: 0;
    text-wrap: balance;
  }

  .vpm-intro-title {
    font-size: clamp(1.3rem, 1.8vw, 1.6rem);
  }

  .vpm-subtitle,
  .vpm-desc,
  .vpm-helper,
  .vpm-success-sub {
    margin: 0;
    font-size: 14px;
    line-height: 1.65;
    color: var(--text-2);
  }

  .vpm-tabs {
    display: flex;
    gap: 4px;
    padding: 18px 24px 0;
  }

  .vpm-tab {
    flex: 1 1 0;
    min-height: 44px;
    padding: 10px 14px;
    border: 2px solid transparent;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-3);
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
    text-align: center;
  }

  .vpm-tab:hover {
    color: var(--text-1);
  }

  .vpm-tab--active {
    color: var(--text-1);
    background: var(--surface-2);
    border-color: var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  .vpm-body {
    padding: 24px;
    min-height: 300px;
  }

  .vpm-intro,
  .vpm-receiver-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .vpm-intro-card,
  .vpm-code-card,
  .vpm-link-card,
  .vpm-status-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: var(--surface-2);
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vpm-start-btn {
    align-self: flex-start;
  }

  .vpm-pair-layout {
    display: grid;
    grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .vpm-qr-side,
  .vpm-code-side {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .vpm-qr-header,
  .vpm-code-head,
  .vpm-action-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .vpm-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vpm-qr-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 212px;
    padding: 14px;
    background: var(--surface-2);
    border: 2px solid var(--border-hard);
    border-radius: 16px;
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vpm-qr-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 180px;
    color: var(--text-3);
  }

  .vpm-code-display {
    font-family: var(--font-mono);
    font-size: clamp(1.5rem, 2.4vw, 1.95rem);
    font-weight: 700;
    letter-spacing: 0.22em;
    color: var(--text-1);
    text-align: center;
    padding: 16px;
    background: var(--surface);
    border: 2px solid var(--border-hard);
    border-radius: 12px;
  }

  .vpm-link-box {
    padding: 12px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.55;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }

  .vpm-inline-btn,
  .vpm-retry-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vpm-inline-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .vpm-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vpm-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-3);
    flex-shrink: 0;
  }

  .vpm-status-dot--pulse {
    background: var(--amber);
    animation: pulse-dot 1.8s ease-in-out infinite;
  }

  .vpm-status-dot--amber {
    background: var(--amber);
  }

  .vpm-status-dot--green {
    background: var(--green);
    animation: pulse-dot 1s ease-in-out infinite;
  }

  .vpm-status-text {
    font-size: 13px;
    color: var(--text-2);
  }

  .vpm-countdown {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .vpm-countdown--urgent {
    color: var(--red);
    font-weight: 700;
  }

  .vpm-code-input-row {
    display: flex;
    justify-content: center;
  }

  .input-code {
    width: 100%;
    max-width: 340px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    letter-spacing: 0.16em;
  }

  .vpm-connecting,
  .vpm-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 20px 0;
  }

  .vpm-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin-slow 0.8s linear infinite;
  }

  .vpm-success-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 700;
    color: #000;
    border: 2px solid #000;
    box-shadow: 3px 3px 0 #000;
  }

  .vpm-success-title {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .vpm-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 16px;
    border: 1.5px solid rgba(180, 35, 24, 0.2);
    border-radius: 14px;
    background: rgba(180, 35, 24, 0.06);
    color: var(--red);
    font-size: 14px;
  }

  .vpm-error p,
  .vpm-err {
    margin: 0;
  }

  @keyframes pulse-dot {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }

    50% {
      transform: scale(1.35);
      opacity: 0.72;
    }
  }

  @media (max-width: 760px) {
    .vpm-panel {
      max-width: 100%;
    }

    .vpm-pair-layout {
      grid-template-columns: 1fr;
    }

    .vpm-header,
    .vpm-body {
      padding: 18px;
    }

    .vpm-tabs {
      padding: 14px 18px 0;
    }

    .vpm-start-btn,
    .vpm-action-row .btn-primary {
      width: 100%;
    }
  }
</style>
