<script lang="ts">
  import { onDestroy } from 'svelte'
  import { transferStore } from '$stores/transfer'
  import { getSignalingBaseUrl } from '$transfer/signaling'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import { isValidRoomCode } from '$utils/crypto'
  import type { TransferProfile } from '$transfer/types'
  import TransferProgress from '$components/sharing/TransferProgress.svelte'

  const signalingUrl = getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL as string | undefined)

  let code = ''
  let error = ''
  let transfer: WebRTCTransfer | null = null

  $: state = $transferStore.state
  $: inputError = code.length > 0 && code.length < 6 ? 'Code must be 6 characters' : ''

  async function connect() {
    const trimmed = code.trim().toUpperCase()
    if (!isValidRoomCode(trimmed)) {
      error = 'Please enter a valid 6-character room code'
      return
    }
    error = ''
    transfer?.destroy()
    transfer = new WebRTCTransfer(signalingUrl, trimmed, 'receiver', getRequestedProfile())
    try {
      await transfer.initReceiver()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not connect'
      transferStore.setError(msg)
    }
  }

  function reset() {
    transfer?.destroy()
    transfer = null
    code = ''
    error = ''
    transferStore.reset()
  }

  onDestroy(() => {
    transfer?.destroy()
  })

  function getRequestedProfile(): TransferProfile {
    if (typeof window === 'undefined') return 'webrtc'
    const raw = new URL(window.location.href).searchParams.get('mode')
    return raw === 'local' ? 'local' : 'webrtc'
  }
</script>

<svelte:head>
  <title>Receive Files — Clex</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-6 pt-20">
  <div class="w-full max-w-sm">
    <!-- Icon -->
    <div class="text-center mb-8">
      <div
        class="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4"
        style="background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.25);"
      >
        📥
      </div>
      <h1 class="font-display font-bold text-2xl text-slate-100">Receive Files</h1>
      <p class="text-slate-400 text-sm mt-2">Enter the room code to connect with the sender</p>
    </div>

    <!-- Card -->
    <div class="glass-panel p-6 flex flex-col gap-5">
      {#if state === 'idle' || state === 'failed'}
        <div class="flex flex-col gap-4">
          <div>
            <input
              type="text"
              class="input-glass text-center font-mono text-3xl tracking-[0.4em] uppercase py-4"
              placeholder="XXXXXX"
              maxlength="6"
              bind:value={code}
              on:keydown={e => e.key === 'Enter' && connect()}
              autocomplete="off"
              spellcheck="false"
            />
            {#if inputError || error || ($transferStore.error && state === 'failed')}
              <p class="text-xs text-red-400 mt-2 text-center">{inputError || error || $transferStore.error}</p>
            {/if}
          </div>

          <button
            class="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
            on:click={connect}
            disabled={code.length !== 6}
          >
            Connect & Receive
            <span>→</span>
          </button>

          {#if state === 'failed'}
            <button class="btn-secondary text-sm" on:click={reset}>Try again</button>
          {/if}
        </div>

      {:else if state === 'preparing' || state === 'waiting_peer'}
        <div class="flex flex-col items-center gap-4 text-center py-4">
          <div class="relative">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl animate-pulse-glow"
                 style="background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.25);">
              🔗
            </div>
            <div class="absolute inset-0 rounded-2xl animate-ping opacity-10"
                 style="background: rgba(124,58,237,0.4);" />
          </div>
          <div>
            <p class="font-display font-semibold text-slate-100">Connecting…</p>
            <p class="text-xs text-slate-500 mt-1">Room <span class="font-mono text-violet-400">{code.toUpperCase()}</span></p>
          </div>
          <button class="btn-secondary text-sm" on:click={reset}>Cancel</button>
        </div>

      {:else if state === 'connecting'}
        <div class="flex flex-col items-center gap-3 text-center py-4">
          <span class="text-4xl animate-float">🌐</span>
          <p class="font-display font-semibold text-slate-100">Establishing connection…</p>
          <p class="text-xs text-slate-500">Peer-to-peer negotiation in progress</p>
          <div class="w-full bg-white/5 rounded-full h-1 overflow-hidden mt-2">
            <div class="h-full bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full animate-pulse w-3/5" />
          </div>
        </div>

      {:else if state === 'transferring'}
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <span class="text-3xl animate-float">📥</span>
            <div>
              <p class="font-display font-semibold text-slate-100">Receiving files…</p>
              <p class="text-xs text-slate-400">Files will download automatically when complete</p>
            </div>
          </div>
          <TransferProgress />
        </div>

      {:else if state === 'complete'}
        <div class="flex flex-col items-center gap-4 text-center py-4">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
               style="background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3);">
            ✓
          </div>
          <div>
            <p class="font-display font-bold text-xl text-green-400">Files received!</p>
            <p class="text-sm text-slate-400 mt-1">Check your downloads folder</p>
          </div>
          <div class="flex gap-3 w-full">
            <button class="btn-secondary flex-1" on:click={reset}>Receive more</button>
            <a href="/" class="btn-primary flex-1 text-center">Home</a>
          </div>
        </div>
      {/if}
    </div>

    <!-- Back link -->
    <div class="text-center mt-6">
      <a href="/workspace" class="text-xs text-slate-600 hover:text-slate-400 transition-colors">
        ← Back to workspace
      </a>
    </div>
  </div>
</div>
