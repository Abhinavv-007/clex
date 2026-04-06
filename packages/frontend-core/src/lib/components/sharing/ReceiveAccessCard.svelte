<script lang="ts">
  import { transferStore } from '$stores/transfer'
  import type { TransferProfile } from '$transfer/types'
  import { siteRoutes } from '$utils'
  import QRCode from './QRCode.svelte'

  export let receiveBasePath = siteRoutes.receive
  export let receivePathFormat: 'segment' | 'query' = 'segment'
  export let size = 140
  export let compact = false

  let copied = false

  $: transferProfile = (($transferStore.method === 'local' ? 'local' : 'webrtc') as TransferProfile)
  $: roomCode = $transferStore.roomCode ?? ''
  $: receivePageUrl = typeof window !== 'undefined'
    ? buildReceivePageUrl(window.location.origin, roomCode, transferProfile)
    : buildReceivePath(roomCode, transferProfile)

  async function copyLink() {
    await navigator.clipboard.writeText(receivePageUrl)
    copied = true
    setTimeout(() => {
      copied = false
    }, 2000)
  }

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

<div class="rac-card" class:rac-card--compact={compact}>
  <div class="rac-header">
    <div class="rac-copy">
      <p class="rac-label">Receiver Access</p>
      <h3 class="rac-title">Scan or copy the receive link</h3>
    </div>
    <div class="rac-code">{roomCode}</div>
  </div>

  <div class="rac-qr">
    <QRCode value={receivePageUrl} {size} />
  </div>

  <button class="btn-secondary rac-copy-btn" on:click={copyLink}>
    {#if copied}
      Copied receive link
    {:else}
      Copy receive link
    {/if}
  </button>

  <p class="rac-hint">Scan to open the receive page instantly on the other device</p>
</div>

<style>
  .rac-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    border: 2px solid var(--border-hard);
    border-radius: 14px;
    box-shadow: 3px 3px 0 var(--border-hard);
    min-width: 0;
  }

  .rac-card--compact {
    padding: 12px;
    gap: 10px;
  }

  .rac-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rac-label {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .rac-title {
    margin: 0;
    font-size: 15px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .rac-code {
    align-self: flex-start;
    padding: 7px 10px;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: var(--text-1);
    text-transform: uppercase;
  }

  .rac-qr {
    display: flex;
    justify-content: center;
  }

  .rac-copy-btn {
    width: 100%;
    justify-content: center;
    min-height: 42px;
  }

  .rac-hint {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-2);
    text-align: center;
  }

  @media (max-width: 767px) {
    .rac-title {
      font-size: 14px;
    }

    .rac-code {
      font-size: 11px;
      letter-spacing: 0.14em;
    }
  }
</style>
