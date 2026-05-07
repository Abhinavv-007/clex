<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { syncState } from '$stores/vault'
  import { fade } from 'svelte/transition'

  export let offline = false

  const dispatch = createEventDispatcher<{ syncNow: void }>()

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

  function requestManualSync() {
    dispatch('syncNow')
  }
</script>

<div class="vh-bar">
  <div class="vh-left">
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
          Last sync {new Date(state.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      {/if}
    </div>

    {#if state.error}
      <div class="vh-error" in:fade={{ duration: 200 }}>
        {state.error}
      </div>
    {/if}
  </div>

  <div class="vh-actions">
    <button class="vh-sync-btn" type="button" on:click={requestManualSync}>
      {state.syncing ? 'Syncing…' : 'Sync + backup'}
    </button>

    {#if state.peerCount > 0}
      <div class="vh-peer-pill" in:fade={{ duration: 200 }}>
        {state.peerCount} peer{state.peerCount > 1 ? 's' : ''} live
      </div>
    {/if}

    {#if offline}
      <div class="vh-offline-badge" in:fade={{ duration: 200 }}>
        <span class="vh-offline-dot"></span>
        Offline, saved locally
      </div>
    {/if}
  </div>
</div>

<style>
  .vh-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 0 10px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .vh-left,
  .vh-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .vh-sync {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: default;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
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
    color: var(--text-2);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .vh-since {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    opacity: 0.9;
  }

  .vh-sync-btn,
  .vh-peer-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
  }

  .vh-sync-btn {
    cursor: pointer;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .vh-sync-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vh-peer-pill {
    color: var(--accent-text);
  }

  .vh-error {
    max-width: min(100%, 520px);
    padding: 7px 12px;
    border-radius: 999px;
    border: 1.5px solid color-mix(in srgb, var(--red) 50%, var(--border-hard));
    background: color-mix(in srgb, var(--red) 8%, var(--surface));
    color: var(--red);
    font-size: 12px;
    line-height: 1.4;
  }

  .vh-offline-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--amber);
    padding: 7px 12px;
    border: 1.5px solid var(--amber);
    border-radius: 999px;
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

  @media (max-width: 767px) {
    .vh-bar,
    .vh-left,
    .vh-actions {
      align-items: stretch;
    }

    .vh-sync,
    .vh-error,
    .vh-sync-btn,
    .vh-peer-pill,
    .vh-offline-badge {
      width: 100%;
    }
  }
</style>
