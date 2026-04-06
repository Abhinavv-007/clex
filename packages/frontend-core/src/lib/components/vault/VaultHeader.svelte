<script lang="ts">
  import { syncState } from '$stores/vault'
  import { fade } from 'svelte/transition'

  export let offline = false

  $: state = $syncState
  $: statusLabel = offline
    ? 'Offline'
    : state.peerCount > 0
      ? `${state.peerCount} peer${state.peerCount > 1 ? 's' : ''} connected`
      : state.connected
        ? 'Synced'
        : state.syncing
          ? 'Syncing…'
          : 'Local only'

  $: statusColor = offline
    ? 'amber'
    : state.peerCount > 0
      ? 'green'
      : state.connected
        ? 'green'
        : state.syncing
          ? 'amber'
          : 'text3'
</script>

<div class="vh-bar">
  <!-- Sync status dot -->
  <div class="vh-sync" title={state.error ?? statusLabel}>
    <span
      class="vh-dot"
      class:vh-dot--green={statusColor === 'green'}
      class:vh-dot--amber={statusColor === 'amber'}
      class:vh-dot--pulse={state.syncing || state.peerCount > 0}
    ></span>
    <span class="vh-label">{statusLabel}</span>
    {#if state.lastSync}
      <span class="vh-since" in:fade={{ duration: 200 }}>
        · {new Date(state.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    {/if}
  </div>

  <!-- Offline indicator -->
  {#if offline}
    <div class="vh-offline-badge" in:fade={{ duration: 200 }}>
      <span class="vh-offline-dot"></span>
      Offline — changes saved locally
    </div>
  {/if}
</div>

<style>
  .vh-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 0 10px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
    flex-shrink: 0;
  }

  .vh-sync {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: default;
  }

  .vh-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-3);
    flex-shrink: 0;
    transition: background 400ms;
  }

  .vh-dot--green { background: var(--green); }
  .vh-dot--amber { background: var(--amber); }

  .vh-dot--pulse {
    animation: pulse-ring 1.6s ease-out infinite;
    position: relative;
  }

  .vh-dot--pulse::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    animation: pulse-ring 1.6s ease-out infinite;
    opacity: 0;
  }

  .vh-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  .vh-since {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    opacity: 0.6;
  }

  .vh-offline-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--amber);
    padding: 3px 10px;
    border: 1.5px solid var(--amber);
    border-radius: 5px;
    background: rgba(255, 170, 0, 0.08);
  }

  .vh-offline-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--amber);
    animation: pulse-dot 2s ease-in-out infinite;
    flex-shrink: 0;
  }
</style>
