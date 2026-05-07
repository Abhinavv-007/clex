<script lang="ts">
  import { filesStore, hasFiles } from '$stores/files'
  import { uiStore } from '$stores/ui'
  import { siteRoutes } from '$utils'
  import FileCard from './FileCard.svelte'
  import FileDropzone from './FileDropzone.svelte'
  import ReceiveEntryCard from './ReceiveEntryCard.svelte'
  import { flip } from 'svelte/animate'
  import { slide } from 'svelte/transition'
  import { formatBytes } from '$utils/format'

  export let receiveEntryHref = siteRoutes.receive

  $: totalSize = $filesStore.reduce((sum, f) => sum + f.size, 0)
</script>

<div class="fl-root">
  <section class="fl-panel fl-panel--files">
    <div class="fl-header">
      <div>
        <h2 class="fl-title">Files</h2>
        {#if $hasFiles}
          <p class="fl-meta">
            {$filesStore.length} file{$filesStore.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}
          </p>
        {/if}
      </div>
      {#if $hasFiles}
        <button class="fl-clear-btn" on:click={() => filesStore.clear()}>
          Clear
        </button>
      {/if}
    </div>

    <div class="fl-files-body">
      <div class="fl-dropzone-wrap">
        <FileDropzone />
      </div>

      {#if $hasFiles}
        <div class="fl-list">
          {#each $filesStore as entry (entry.id)}
            <div
              animate:flip={{ duration: 220 }}
              in:slide={{ duration: 180 }}
              out:slide={{ duration: 140 }}
            >
              <FileCard {entry} />
            </div>
          {/each}
        </div>
      {:else}
        <div class="fl-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" stroke="currentColor" stroke-width="1.4"/>
            <path d="M9 3v6h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <p>No files yet</p>
        </div>
      {/if}
    </div>
  </section>

  <div class="fl-receive-wrap">
    <ReceiveEntryCard {receiveEntryHref} />
  </div>

  {#if $hasFiles}
    <div class="fl-mobile-actions">
      <button class="btn-secondary fl-mobile-btn" on:click={() => uiStore.setPanel('tools')}>
        Prepare files
      </button>
      <button class="btn-primary fl-mobile-btn" on:click={() => uiStore.setPanel('share')}>
        Share / Send files
      </button>
    </div>
  {/if}
</div>

<style>
  .fl-root {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
  }

  .fl-panel {
    background: color-mix(in srgb, var(--surface) 74%, var(--surface-2));
    border: 1.5px solid var(--border-strong);
    border-radius: 16px;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--surface) 70%, transparent);
    padding: 14px;
    min-width: 0;
  }

  .fl-panel--files {
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: min(540px, calc(100vh - 290px));
  }

  .fl-receive-wrap {
    flex: 0 0 auto;
  }

  .fl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .fl-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .fl-meta {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 2px;
  }

  .fl-clear-btn {
    font-size: 12px;
    color: var(--text-3);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .fl-clear-btn:hover {
    background: var(--raised);
    color: #ef4444;
  }

  .fl-files-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1 1 auto;
    min-height: 0;
    margin-top: 12px;
  }

  .fl-dropzone-wrap {
    flex: 0 0 auto;
  }

  .fl-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
    padding-right: 2px;
  }

  .fl-list::-webkit-scrollbar { width: 4px; }
  .fl-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 2px; }

  .fl-mobile-actions {
    display: none;
    gap: 10px;
    position: sticky;
    bottom: 0;
    padding-top: 10px;
    margin-top: 4px;
    background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--surface-solid) 84%, transparent) 36%);
  }

  .fl-mobile-btn {
    flex: 1;
    min-height: 42px;
    justify-content: center;
  }

  .fl-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 30px 20px;
    color: var(--text-3);
    font-size: 12px;
    background: var(--surface-2);
    border: 2px dashed var(--border-hard);
    border-radius: 12px;
    box-shadow: 3px 3px 0 var(--border-hard);
    border-radius: 12px;
    text-align: center;
  }

  .fl-empty svg {
    color: var(--text-2);
    opacity: 0.5;
    margin-bottom: 2px;
  }

  @media (max-width: 767px) {
    .fl-panel--files {
      max-height: none;
    }

    .fl-list {
      max-height: none;
      overflow: visible;
      padding-right: 0;
      min-height: auto;
      flex: 0 0 auto;
    }

    .fl-panel {
      padding: 12px;
    }
    .fl-mobile-actions {
      display: flex;
    }
  }
</style>
