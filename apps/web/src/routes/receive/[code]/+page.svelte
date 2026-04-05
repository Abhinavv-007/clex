<script lang="ts">
  import { page } from '$app/stores'
  import { onMount, onDestroy } from 'svelte'
  import { transferStore } from '$stores/transfer'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import TransferProgress from '$components/sharing/TransferProgress.svelte'

  const signalingUrl = import.meta.env.PUBLIC_SIGNALING_URL ?? 'ws://localhost:8787'

  $: roomCode = $page.params.code?.toUpperCase() ?? ''
  $: state = $transferStore.state
  $: nearby = $transferStore.nearby

  let transfer: WebRTCTransfer | null = null
  let autoConnecting = true

  onMount(async () => {
    if (roomCode) {
      transfer = new WebRTCTransfer(signalingUrl, roomCode, 'receiver')
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

    <div class="glass-panel p-6">
      {#if autoConnecting || state === 'preparing' || state === 'waiting_peer'}
        <div class="flex flex-col items-center gap-5 py-6 text-center">
          <div class="relative">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl animate-pulse-glow"
                 style="background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.3);">
              📡
            </div>
            <div class="absolute inset-0 rounded-2xl animate-ping opacity-10"
                 style="background: rgba(124,58,237,0.5);" />
          </div>
          <div>
            <p class="font-display font-semibold text-slate-100">Waiting for sender…</p>
            <p class="text-xs text-slate-500 mt-1">Ready to receive when they start</p>
          </div>
          <button class="btn-secondary text-sm" on:click={reset}>Cancel</button>
        </div>

      {:else if state === 'connecting'}
        <div class="flex flex-col items-center gap-4 text-center py-4">
          <span class="text-4xl animate-float">🌐</span>
          <p class="font-display font-semibold text-slate-100">Establishing direct connection…</p>
          <div class="w-full bg-white/5 rounded-full h-1 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-violet-600 to-cyan-400 animate-pulse w-3/5 rounded-full" />
          </div>
        </div>

      {:else if state === 'transferring'}
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <span class="text-3xl animate-float">📥</span>
            <div>
              <p class="font-display font-semibold text-slate-100">Receiving…</p>
              <p class="text-xs text-slate-400">Files will download automatically</p>
            </div>
          </div>
          <TransferProgress />
        </div>

      {:else if state === 'complete'}
        <div class="flex flex-col items-center gap-5 text-center py-4">
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
            <a href="/workspace" class="btn-primary flex-1 text-center text-sm">Workspace</a>
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
