<script lang="ts">
  import { masterKey, vaultActions } from '$stores/vault'
  import { startPairingAsSender, completePairingAsReceiver, parseQRPayload } from '$lib/vault/pairing'
  import { storeMasterKeyFromRaw } from '$lib/vault/crypto'
  import { scale, fade } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import QRCode from '$components/sharing/QRCode.svelte'

  export let vaultApiUrl = '/vault/api'

  type Tab = 'sender' | 'receiver'
  type Status = 'idle' | 'waiting' | 'connecting' | 'connected' | 'complete' | 'failed' | 'expired'

  let tab: Tab = 'sender'
  let status: Status = 'idle'
  let pairingCode = ''
  let qrPayload = ''
  let expiresAt = 0
  let receiverCode = ''
  let error = ''
  let countdown = 300

  let countdownTimer: ReturnType<typeof setInterval>

  function close() {
    clearInterval(countdownTimer)
    vaultActions.closePairingModal()
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) close()
  }

  async function startSender() {
    const key = $masterKey
    if (!key) { error = 'No master key found. Please reload.'; return }
    status = 'waiting'
    error = ''
    try {
      const result = await startPairingAsSender(
        vaultApiUrl,
        key,
        (s) => { status = s as Status },
        () => { status = 'complete'; clearInterval(countdownTimer) }
      )
      pairingCode = result.code
      qrPayload = result.qrPayload
      expiresAt = result.expiresAt
      startCountdown()
    } catch (e: unknown) {
      status = 'failed'
      error = e instanceof Error ? e.message : 'Pairing failed'
    }
  }

  function startCountdown() {
    countdown = Math.ceil((expiresAt - Date.now()) / 1000)
    clearInterval(countdownTimer)
    countdownTimer = setInterval(() => {
      countdown = Math.ceil((expiresAt - Date.now()) / 1000)
      if (countdown <= 0) {
        clearInterval(countdownTimer)
        if (status === 'waiting') status = 'expired'
      }
    }, 1000)
  }

  async function startReceiver() {
    if (receiverCode.length !== 8) { error = 'Enter the 8-digit code shown on the other device.'; return }
    status = 'connecting'
    error = ''
    try {
      await completePairingAsReceiver(
        receiverCode,
        vaultApiUrl,
        (s) => { status = s as Status },
        async (rawKey) => {
          const mk = await storeMasterKeyFromRaw(rawKey)
          vaultActions.setMasterKey(mk)
          status = 'complete'
          setTimeout(close, 1800)
        }
      )
    } catch (e: unknown) {
      status = 'failed'
      error = e instanceof Error ? e.message : 'Could not complete pairing'
    }
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }
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
    <!-- Header -->
    <div class="vpm-header">
      <div class="vpm-header-left">
        <span class="vpm-icon">⟳</span>
        <h2 class="vpm-title">Add Device</h2>
      </div>
      <button class="btn-icon" on:click={close} aria-label="Close">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M3 3l9 9M12 3L3 12"/>
        </svg>
      </button>
    </div>

    <!-- Tabs -->
    <div class="vpm-tabs">
      <button
        class="vpm-tab"
        class:vpm-tab--active={tab === 'sender'}
        on:click={() => { tab = 'sender'; status = 'idle'; error = '' }}
      >This device has the key</button>
      <button
        class="vpm-tab"
        class:vpm-tab--active={tab === 'receiver'}
        on:click={() => { tab = 'receiver'; status = 'idle'; error = '' }}
      >This is a new device</button>
    </div>

    <div class="vpm-body">
      {#if tab === 'sender'}
        <!-- ── Sender: show code + QR ────────────────────────────────────── -->
        {#if status === 'idle'}
          <div class="vpm-intro" in:fade={{ duration: 160 }}>
            <p class="vpm-desc">
              Generate a pairing code and QR. Open Vault on the new device, choose
              "This is a new device", and enter the code — or scan the QR.
            </p>
            <button class="btn-primary vpm-start-btn" on:click={startSender}>
              Generate Pairing Code
            </button>
          </div>

        {:else if status === 'waiting' || status === 'connecting' || status === 'connected'}
          <div class="vpm-pair-layout" in:fade={{ duration: 180 }}>
            <!-- QR side -->
            <div class="vpm-qr-side">
              <div class="vpm-qr-label">Fast Pair (QR)</div>
              <div class="vpm-qr-wrap">
                {#if qrPayload}
                  <QRCode text={qrPayload} size={160} />
                {:else}
                  <div class="vpm-qr-placeholder">
                    <span class="animate-spin-slow" style="font-size:28px;">◌</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Code side -->
            <div class="vpm-code-side">
              <div class="vpm-code-label">Manual Code</div>
              <div class="vpm-code-display">
                {#if pairingCode}
                  {pairingCode.slice(0, 4)} {pairingCode.slice(4)}
                {:else}
                  ··· ···
                {/if}
              </div>

              <div class="vpm-status-row">
                {#if status === 'waiting'}
                  <span class="vpm-status-dot vpm-status-dot--pulse"></span>
                  <span class="vpm-status-text">Waiting for device B…</span>
                {:else if status === 'connecting'}
                  <span class="vpm-status-dot vpm-status-dot--amber"></span>
                  <span class="vpm-status-text">Connecting…</span>
                {:else if status === 'connected'}
                  <span class="vpm-status-dot vpm-status-dot--green"></span>
                  <span class="vpm-status-text">Transferring key…</span>
                {/if}
              </div>

              <div class="vpm-countdown" class:vpm-countdown--urgent={countdown < 60}>
                Expires in {formatTime(countdown)}
              </div>
            </div>
          </div>

        {:else if status === 'complete'}
          <div class="vpm-success" in:scale={{ duration: 280, easing: quintOut, start: 0.9 }}>
            <div class="vpm-success-icon">✓</div>
            <h3 class="vpm-success-title">Device paired!</h3>
            <p class="vpm-success-sub">Your notes will sync automatically.</p>
            <button class="btn-primary" on:click={close}>Done</button>
          </div>

        {:else if status === 'expired'}
          <div class="vpm-error" in:fade={{ duration: 160 }}>
            <p>Code expired. <button class="vpm-retry-link" on:click={startSender}>Generate a new one →</button></p>
          </div>

        {:else if status === 'failed'}
          <div class="vpm-error" in:fade={{ duration: 160 }}>
            <p>{error || 'Pairing failed.'} <button class="vpm-retry-link" on:click={() => { status = 'idle'; error = '' }}>Try again →</button></p>
          </div>
        {/if}

      {:else}
        <!-- ── Receiver: enter code ──────────────────────────────────────── -->
        {#if status === 'idle' || status === 'failed'}
          <div class="vpm-receiver-form" in:fade={{ duration: 160 }}>
            <p class="vpm-desc">
              On the device that already has your Vault, open Settings → Add Device.
              Enter the 8-digit code shown there.
            </p>
            <div class="vpm-code-input-row">
              <input
                class="input-code input"
                type="text"
                inputmode="numeric"
                maxlength="8"
                placeholder="00000000"
                bind:value={receiverCode}
                on:keydown={(e) => e.key === 'Enter' && startReceiver()}
              />
            </div>
            {#if error}<p class="vpm-err">{error}</p>{/if}
            <button
              class="btn-primary vpm-start-btn"
              disabled={receiverCode.length < 8}
              on:click={startReceiver}
            >
              Connect
            </button>
          </div>

        {:else if status === 'connecting' || status === 'connected'}
          <div class="vpm-connecting" in:fade={{ duration: 160 }}>
            <div class="vpm-spinner"></div>
            <p class="vpm-status-text">
              {status === 'connecting' ? 'Connecting to your other device…' : 'Receiving encryption key…'}
            </p>
          </div>

        {:else if status === 'complete'}
          <div class="vpm-success" in:scale={{ duration: 280, easing: quintOut, start: 0.9 }}>
            <div class="vpm-success-icon">✓</div>
            <h3 class="vpm-success-title">Paired!</h3>
            <p class="vpm-success-sub">Vault is now set up on this device.</p>
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
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .vpm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--border);
  }

  .vpm-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .vpm-icon {
    font-size: 20px;
    color: var(--accent-text);
  }

  .vpm-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
    margin: 0;
  }

  .vpm-tabs {
    display: flex;
    gap: 0;
    padding: 16px 24px 0;
    border-bottom: 1px solid var(--border);
  }

  .vpm-tab {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-3);
    transition: color 150ms, border-color 150ms;
    text-align: center;
  }

  .vpm-tab:hover { color: var(--text-2); }

  .vpm-tab--active {
    color: var(--text-1);
    border-bottom-color: var(--accent);
  }

  .vpm-body {
    padding: 24px;
    min-height: 280px;
  }

  .vpm-intro, .vpm-receiver-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .vpm-desc {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0;
  }

  .vpm-start-btn {
    align-self: flex-start;
  }

  .vpm-pair-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    align-items: start;
  }

  .vpm-qr-label, .vpm-code-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
    margin-bottom: 12px;
  }

  .vpm-qr-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    border: 2px solid var(--border-hard);
    border-radius: 10px;
    padding: 12px;
    box-shadow: 3px 3px 0 var(--border-hard);
    min-height: 184px;
  }

  .vpm-qr-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 160px;
    color: var(--text-3);
  }

  .vpm-code-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .vpm-code-display {
    font-family: var(--font-mono);
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.3em;
    color: var(--text-1);
    text-align: center;
    padding: 16px;
    background: var(--surface-2);
    border: 2px solid var(--border-hard);
    border-radius: 10px;
    box-shadow: 3px 3px 0 var(--border-hard);
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

  .vpm-status-dot--amber { background: var(--amber); }
  .vpm-status-dot--green { background: var(--green); animation: pulse-dot 1s ease-in-out infinite; }

  .vpm-status-text {
    font-size: 13px;
    color: var(--text-2);
  }

  .vpm-countdown {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    letter-spacing: 0.04em;
    text-align: center;
  }

  .vpm-countdown--urgent { color: var(--red); font-weight: 700; }

  .vpm-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    padding: 20px 0;
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
    font-size: 20px;
    font-weight: 700;
    color: var(--text-1);
    margin: 0;
  }

  .vpm-success-sub {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
  }

  .vpm-error {
    padding: 16px 0;
    color: var(--red);
    font-size: 14px;
  }

  .vpm-retry-link {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--cyan);
    font-size: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    padding: 0;
  }

  .vpm-code-input-row {
    display: flex;
    justify-content: center;
  }

  .vpm-err {
    color: var(--red);
    font-size: 13px;
    margin: 0;
  }

  .vpm-connecting {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 40px 0;
  }

  .vpm-spinner {
    width: 32px;
    height: 32px;
    border: 2.5px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin-slow 0.8s linear infinite;
  }

  @media (max-width: 480px) {
    .vpm-pair-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
