<script lang="ts">
  import { onDestroy } from 'svelte'
  import { uiStore } from '$stores/ui'
  import { transferStore } from '$stores/transfer'
  import { getSignalingBaseUrl } from '$transfer/signaling'
  import { WebRTCTransfer } from '$transfer/webrtc'
  import { zipFiles } from '$tools/zip'
  import { isValidRoomCode } from '$utils/crypto'
  import { formatBytes, saveBlobWithSystemFallback, triggerBlobDownload, truncateName } from '$utils'
  import type { TransferProfile } from '$transfer/types'
  import TransferProgress from './TransferProgress.svelte'

  const signalingUrl = getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL as string | undefined)

  let code = ''
  let error = ''
  let transfer: WebRTCTransfer | null = null
  let saving = false

  $: state = $transferStore.state
  $: inputError = code.length > 0 && code.length < 6 ? 'Code must be 6 characters' : ''
  $: receivedFiles = $transferStore.receivedFiles

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

      const archiveName = `${code.trim().toUpperCase() || 'clex-transfer'}.zip`
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

<div class="flex flex-col gap-6">
  {#if state === 'idle' || state === 'failed'}
    <!-- Input form -->
    <div class="flex flex-col gap-5">
      <div>
        <p class="text-sm text-slate-400 font-medium">
          Enter the 6-character code
        </p>
      </div>

      <div>
        <input
          type="text"
          class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-center font-mono text-[28px] tracking-[0.4em] uppercase text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all focus:shadow-[0_0_24px_rgba(255,255,255,0.05)]"
          placeholder="XXXXXX"
          maxlength="6"
          bind:value={code}
          on:keydown={e => e.key === 'Enter' && connect()}
          autocomplete="off"
          spellcheck="false"
        />
        {#if inputError || error}
          <p class="text-[13px] font-medium text-red-400 mt-2 text-center">{inputError || error}</p>
        {/if}
      </div>

      <button
        class="bg-white text-black font-semibold text-[15px] py-3.5 px-6 rounded-xl w-full flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        on:click={connect}
        disabled={code.length !== 6}
      >
        Connect & Receive
        <span>→</span>
      </button>
    </div>

  {:else if state === 'preparing' || state === 'waiting_peer'}
    <div class="flex flex-col items-center gap-4 text-center py-6">
      <div class="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center text-2xl relative"
           style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
         <div class="absolute inset-0 border border-white/10 rounded-[18px] animate-[spin_3s_linear_infinite]" style="border-top-color: transparent"></div>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="opacity-80">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
          <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.4"/>
        </svg>
      </div>
      <div>
        <p class="text-[15px] font-semibold text-white tracking-[-0.01em]">Connecting to sender</p>
        <p class="text-[13px] text-slate-400 mt-1">Room <span class="font-mono text-white opacity-80">{code.toUpperCase()}</span></p>
      </div>
      <button class="text-[13px] text-slate-400 hover:text-white transition-colors" on:click={close}>Cancel connection</button>
    </div>

  {:else if state === 'connecting'}
    <div class="flex flex-col items-center gap-4 text-center py-6">
      <div class="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center relative animate-[pulse_2s_ease-in-out_infinite]"
           style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div>
        <p class="text-[15px] font-semibold text-white tracking-[-0.01em]">Establishing secure P2P link…</p>
        <p class="text-[13px] text-slate-400 mt-1">Finding the optimal route</p>
      </div>
    </div>

  {:else if state === 'transferring'}
    <div class="flex flex-col gap-6">
      <div class="flex items-center gap-4">
        <div class="w-[48px] h-[48px] rounded-[14px] flex items-center justify-center bg-white/5 border border-white/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v11M5 9l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3 17h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div>
          <p class="text-[15px] font-semibold text-white tracking-[-0.01em]">Receiving files…</p>
          <p class="text-[13px] text-slate-400 mt-0.5">We'll try to save automatically and keep manual save options ready</p>
        </div>
      </div>
      <TransferProgress />
    </div>

  {:else if state === 'complete'}
    <div class="flex flex-col items-center gap-5 text-center py-6">
      <div class="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center text-green-400"
           style="background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M6 14l5.5 5.5L22 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <p class="text-[18px] font-semibold text-white tracking-tight">Transfer Complete</p>
        <p class="text-[14px] text-slate-400 mt-1">
          Your browser may have saved the files automatically. If not, use the save controls below.
        </p>
      </div>
      {#if receivedFiles.length > 0}
        <div class="rm-save-panel">
          <button class="bg-white text-black font-medium text-[14px] py-2.5 px-6 rounded-lg hover:bg-slate-100 transition-colors w-full" on:click={saveAllReceivedFiles} disabled={saving}>
            {#if saving}
              Preparing…
            {:else if receivedFiles.length === 1}
              Save file
            {:else}
              Save all as ZIP
            {/if}
          </button>

          {#if receivedFiles.length > 1}
            <div class="rm-file-actions">
              {#each receivedFiles as file, index}
                <button class="rm-file-btn" on:click={() => saveReceivedFile(index)} disabled={saving}>
                  <span>{truncateName(file.name, 28)}</span>
                  <span class="rm-file-size">{formatBytes(file.size)}</span>
                </button>
              {/each}
            </div>
          {:else}
            <button class="rm-file-btn" on:click={() => downloadReceivedFile(0)} disabled={saving}>
              Download again
            </button>
          {/if}
        </div>
      {/if}
      <button class="bg-white text-black font-medium text-[14px] py-2.5 px-6 rounded-lg mt-2 hover:bg-slate-100 transition-colors" on:click={close}>Done</button>
    </div>
  {/if}
</div>

<style>
  .rm-save-panel {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
  }

  .rm-file-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .rm-file-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.04);
    color: white;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .rm-file-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.18);
  }

  .rm-file-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .rm-file-size {
    flex-shrink: 0;
    color: rgba(255,255,255,0.6);
    font-size: 12px;
  }

  @media (max-width: 520px) {
    .rm-file-btn {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
