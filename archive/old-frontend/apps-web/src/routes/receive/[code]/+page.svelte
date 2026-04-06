<script lang="ts">
  import { page } from '$app/stores'
  import { onMount, onDestroy } from 'svelte'
  import { transferStore } from '$stores/transfer'
  import { getSignalingBaseUrl } from '$transfer/signaling'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import type { TransferProfile } from '$transfer/types'
  import TransferProgress from '$components/sharing/TransferProgress.svelte'

  const signalingUrl = getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL as string | undefined)

  $: roomCode = $page.params.code?.toUpperCase() ?? ''
  $: state = $transferStore.state
  $: nearby = $transferStore.nearby

  let transfer: WebRTCTransfer | null = null
  let autoConnecting = true

  onMount(async () => {
    if (roomCode) {
      transfer = new WebRTCTransfer(signalingUrl, roomCode, 'receiver', getRequestedProfile())
      try {
        await transfer.initReceiver()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not connect'
        transferStore.setError(msg)
      } finally {
        autoConnecting = false
      }
    }
  })

  onDestroy(() => {
    transfer?.destroy()
  })

  function reset() {
    transfer?.destroy()
    transfer = null
    transferStore.reset()
    window.location.href = '/receive'
  }

  function getRequestedProfile(): TransferProfile {
    return $page.url.searchParams.get('mode') === 'local' ? 'local' : 'webrtc'
  }
</script>

<svelte:head>
  <title>Receive — Room {roomCode} — Clex</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-6 pt-20">
  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <h1 class="font-display font-bold text-2xl text-slate-100">Receive Files</h1>
      <p class="text-slate-500 text-sm mt-1">
        Room <span class="font-mono text-violet-400">{roomCode}</span>
      </p>
      {#if nearby}
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span class="badge badge-cyan text-xs">Same network — fast transfer</span>
        </div>
      {/if}
    </div>

    <div class="p-8 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/5 bg-white/5 backdrop-blur-xl relative overflow-hidden">
      <!-- Top edge highlight -->
      <div class="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

      {#if autoConnecting || state === 'preparing' || state === 'waiting_peer'}
        <div class="flex flex-col items-center gap-6 py-6 text-center">
          <div class="relative">
            <div class="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center relative"
                 style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
              <div class="absolute inset-0 border border-white/10 rounded-[22px] animate-[spin_3s_linear_infinite]" style="border-top-color: transparent"></div>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" class="opacity-80">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"/>
              </svg>
            </div>
            <div class="absolute inset-0 rounded-[22px] animate-ping opacity-10 bg-white" />
          </div>
          <div>
            <p class="text-[16px] font-semibold text-white tracking-[-0.01em]">Waiting for sender…</p>
            <p class="text-[14px] text-slate-400 mt-1">Ready to receive when they start</p>
          </div>
          <button class="text-[13px] text-slate-400 hover:text-white transition-colors" on:click={reset}>Cancel</button>
        </div>

      {:else if state === 'connecting'}
        <div class="flex flex-col items-center gap-5 text-center py-6">
          <div class="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center relative animate-[pulse_2s_ease-in-out_infinite]"
               style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div>
            <p class="text-[16px] font-semibold text-white tracking-[-0.01em]">Establishing direct connection…</p>
            <p class="text-[14px] text-slate-400 mt-1">Finding the optimal route</p>
          </div>
        </div>

      {:else if state === 'transferring'}
        <div class="flex flex-col gap-6 py-2">
          <div class="flex items-center gap-4">
            <div class="w-[56px] h-[56px] rounded-[16px] flex items-center justify-center bg-white/5 border border-white/10">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <path d="M10 3v11M5 9l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3 17h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div>
              <p class="text-[16px] font-semibold text-white tracking-[-0.01em]">Receiving…</p>
              <p class="text-[14px] text-slate-400 mt-0.5">Files will download automatically</p>
            </div>
          </div>
          <TransferProgress />
        </div>

      {:else if state === 'complete'}
        <div class="flex flex-col items-center gap-6 text-center py-6">
          <div class="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center text-green-400"
               style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);">
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
              <path d="M6 14l5.5 5.5L22 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <p class="text-[20px] font-bold text-green-400 tracking-tight">Files received!</p>
            <p class="text-[14px] text-slate-400 mt-1.5">Check your downloads folder</p>
          </div>
          <div class="flex gap-3 w-full mt-2">
            <button class="bg-white/10 text-white font-medium text-[14px] py-3 px-4 rounded-xl flex-1 hover:bg-white/15 transition-colors" on:click={reset}>Receive more</button>
            <a href="/workspace" class="bg-white text-black font-semibold text-[14px] py-3 px-4 rounded-xl flex-1 hover:bg-slate-100 transition-colors">Workspace</a>
          </div>
        </div>

      {:else if state === 'failed'}
        <div class="flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <span class="text-xl">⚠</span>
            <div>
              <p class="font-display font-semibold text-red-400">Connection failed</p>
              <p class="text-xs text-slate-400 mt-1">{$transferStore.error}</p>
            </div>
          </div>
          <button class="btn-primary" on:click={reset}>Try again</button>
        </div>
      {/if}
    </div>

    <div class="text-center mt-6">
      <a href="/" class="text-xs text-slate-600 hover:text-slate-400 transition-colors">
        ← Back to Clex
      </a>
    </div>
  </div>
</div>
