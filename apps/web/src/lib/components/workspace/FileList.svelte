<script lang="ts">
  import { filesStore, hasFiles } from '$stores/files'
  import { uiStore } from '$stores/ui'
  import FileCard from './FileCard.svelte'
  import FileDropzone from './FileDropzone.svelte'
  import { flip } from 'svelte/animate'
  import { slide } from 'svelte/transition'
  import { formatBytes } from '$utils/format'

  $: totalSize = $filesStore.reduce((sum, f) => sum + f.size, 0)
</script>

<div class="fl-root">
  <!-- Header -->
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

  <!-- Dropzone -->
  <FileDropzone />

  <!-- File list -->
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

    <div class="fl-mobile-actions">
      <button class="btn-secondary fl-mobile-btn" on:click={() => uiStore.setPanel('tools')}>
        Prepare files
      </button>
      <button class="btn-primary fl-mobile-btn" on:click={() => uiStore.setPanel('share')}>
        Share / Send files
      </button>
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

<style>
  .fl-root {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .fl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .fl-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: calc(100vh - 380px);
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
    gap: 12px;
    padding: 48px 24px;
    color: var(--text-3);
    font-size: 13px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    text-align: center;
  }

  .fl-empty svg {
    color: var(--text-2);
    opacity: 0.5;
    margin-bottom: 4px;
  }

  @media (max-width: 767px) {
    .fl-list {
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }

    .fl-mobile-actions {
      display: flex;
    }
  }
</style>
