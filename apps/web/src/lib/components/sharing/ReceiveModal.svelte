<script lang="ts">
  import { onDestroy } from 'svelte'
  import { uiStore } from '$stores/ui'
  import { transferStore } from '$stores/transfer'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import { isValidRoomCode } from '$utils/crypto'
  import type { TransferProfile } from '$transfer/types'
  import TransferProgress from './TransferProgress.svelte'

  const signalingUrl = import.meta.env.PUBLIC_SIGNALING_URL ?? 'ws://localhost:8787'

  let code = ''
  let error = ''
  let transfer: WebRTCTransfer | null = null

  $: state = $transferStore.state
  $: inputError = code.length > 0 && code.length < 6 ? 'Code must be 6 characters' : ''

  async function connect() {
    const trimmed = code.trim().toUpperCase()
    if (!isValidRoomCode(trimmed)) {
      error = 'Enter a valid 6-character room code'
      return
    }

    error = ''
    transfer?.destroy()
    transfer = new WebRTCTransfer(signalingUrl, trimmed, 'receiver', getRequestedProfile())
    try {
      transferStore.setState('preparing')
      await transfer.initReceiver()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not connect to room'
      transferStore.setError(msg)
    }
  }

  function close() {
    transfer?.destroy()
    transfer = null
    transferStore.reset()
    uiStore.closeModal()
  }

  onDestroy(() => {
    transfer?.destroy()
  })

  function getRequestedProfile(): TransferProfile {
    return $transferStore.method === 'local' ? 'local' : 'webrtc'
  }
</script>

<div class="flex flex-col gap-5">
  {#if state === 'idle' || state === 'failed'}
    <!-- Input form -->
    <div class="flex flex-col gap-4">
      <div>
        <p class="text-sm text-slate-400 leading-relaxed mb-4">
          Enter the 6-character code shown on the sender's screen to receive files directly.
        </p>
      </div>

      <div>
        <input
          type="text"
          class="input-glass text-center font-mono text-2xl tracking-[0.3em] uppercase"
          placeholder="XXXXXX"
          maxlength="6"
          bind:value={code}
          on:keydown={e => e.key === 'Enter' && connect()}
          autocomplete="off"
          spellcheck="false"
        />
        {#if inputError || error}
          <p class="text-xs text-red-400 mt-1.5">{inputError || error}</p>
        {/if}
      </div>

      <button
        class="btn-primary w-full flex items-center justify-center gap-2"
        on:click={connect}
        disabled={code.length !== 6}
      >
        Connect & Receive
        <span>→</span>
      </button>
    </div>

  {:else if state === 'preparing' || state === 'waiting_peer'}
    <div class="flex flex-col items-center gap-4 text-center py-4">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl animate-pulse-glow"
           style="background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.25);">
        🔗
      </div>
      <div>
        <p class="font-display font-semibold text-slate-100">Connecting to sender…</p>
        <p class="text-xs text-slate-500 mt-1">Room <span class="font-mono text-violet-400">{code.toUpperCase()}</span></p>
      </div>
      <button class="btn-secondary text-sm" on:click={close}>Cancel</button>
    </div>

  {:else if state === 'connecting'}
    <div class="flex flex-col items-center gap-3 text-center py-4">
      <div class="text-2xl animate-float">🌐</div>
      <p class="font-display font-semibold text-slate-100">Establishing P2P connection…</p>
      <p class="text-xs text-slate-500">Negotiating the best route</p>
      <div class="w-full bg-white/5 rounded-full h-1 overflow-hidden mt-1">
        <div class="h-full bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full animate-pulse w-3/5" />
      </div>
    </div>

  {:else if state === 'transferring'}
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <span class="text-2xl animate-float">📥</span>
        <div>
          <p class="font-display font-semibold text-sm text-slate-100">Receiving…</p>
          <p class="text-xs text-slate-400">Files will download automatically</p>
        </div>
      </div>
      <TransferProgress />
    </div>

  {:else if state === 'complete'}
    <div class="flex flex-col items-center gap-4 text-center py-2">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
           style="background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.25);">
        ✓
      </div>
      <div>
        <p class="font-display font-bold text-green-400 text-lg">Files received!</p>
        <p class="text-sm text-slate-400 mt-1">Check your downloads folder</p>
      </div>
      <button class="btn-primary" on:click={close}>Done</button>
    </div>
  {/if}
</div>
