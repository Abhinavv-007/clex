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
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px clamp(16px, 2.4vw, 30px);
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface-2) 50%, var(--surface));
    flex-shrink: 0;
  }

  .vh-left,
  .vh-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .vh-sync {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: default;
  }

  .vh-dot {
    position: relative;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-3);
    flex-shrink: 0;
    transition: background 400ms;
  }

  .vh-dot--green { background: var(--green); }
  .vh-dot--amber { background: var(--amber); }

  .vh-dot--pulse::after {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    color: var(--green);
    animation: pulse-ring 1.6s ease-out infinite;
    opacity: 0;
  }

  .vh-label {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-2);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .vh-since {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--text-3);
  }

  .vh-sync-btn,
  .vh-peer-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--surface);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-1);
  }

  .vh-sync-btn {
    cursor: pointer;
    transition: border-color 150ms, background 150ms;
  }

  .vh-sync-btn:hover {
    border-color: var(--border-strong);
    background: var(--surface-2);
  }

  .vh-peer-pill {
    color: var(--accent-text);
    background: var(--accent-dim);
    border-color: transparent;
  }

  .vh-error {
    max-width: min(100%, 520px);
    padding: 5px 10px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--red) 8%, var(--surface));
    color: var(--red);
    font-size: 12px;
    line-height: 1.4;
  }

  .vh-offline-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--amber) 10%, transparent);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--amber);
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
