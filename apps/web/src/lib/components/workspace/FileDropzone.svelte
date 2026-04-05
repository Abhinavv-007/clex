<script lang="ts">
  import { filesStore } from '$stores/files'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher<{ added: File[] }>()

  let isDragging = false
  let inputEl: HTMLInputElement

  function handleDragEnter(e: DragEvent) {
    e.preventDefault()
    isDragging = true
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault()
    if (e.currentTarget === e.target) isDragging = false
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) addFiles(files)
  }

  function handleFileInput(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files ?? [])
    if (files.length) addFiles(files)
    inputEl.value = ''
  }

  function addFiles(files: File[]) {
    filesStore.add(files)
    dispatch('added', files)
  }
</script>

<!-- Full-screen drag overlay -->
{#if isDragging}
  <div
    class="drag-overlay"
    on:dragover={handleDragOver}
    on:drop={handleDrop}
    on:dragleave={() => (isDragging = false)}
    role="presentation"
  >
    <div class="overlay-inner">
      <div class="overlay-icon">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 6v12M8 12l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4 20h20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="overlay-title">Drop files to add</p>
      <p class="overlay-sub">Release to add to workspace</p>
    </div>
  </div>
{/if}

<div
  class="dropzone"
  class:dropzone-active={isDragging}
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  on:click={() => inputEl.click()}
  on:keydown={e => e.key === 'Enter' && inputEl.click()}
  role="button"
  tabindex="0"
  aria-label="Drop files here or click to browse"
>
  <div class="dropzone-icon">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 3v10M6 9l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 16h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  </div>
  <p class="dropzone-title">
    {isDragging ? 'Release to drop' : 'Drop files here'}
  </p>
  <p class="dropzone-hint">or <span class="dropzone-link">click to browse</span></p>
  <p class="dropzone-types">Images · PDFs · Word · Any file</p>
</div>

<input
  bind:this={inputEl}
  type="file"
  multiple
  style="display:none"
  on:change={handleFileInput}
  aria-hidden="true"
/>

<style>
  .dropzone {
    border: 1.5px dashed var(--border-strong);
    border-radius: 12px;
    padding: 28px 16px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .dropzone:hover,
  .dropzone:focus-visible {
    border-color: var(--text-3);
    background: var(--raised);
    outline: none;
  }

  .dropzone-active {
    border-color: var(--text-1);
    background: var(--raised);
  }

  .dropzone-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--raised);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
    margin-bottom: 8px;
    transition: transform 0.2s ease;
  }

  .dropzone-active .dropzone-icon {
    transform: scale(1.1);
    border-color: var(--border-strong);
  }

  .dropzone-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  .dropzone-hint {
    font-size: 12px;
    color: var(--text-3);
  }

  .dropzone-link {
    color: var(--text-2);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .dropzone-types {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 4px;
  }

  /* Drag overlay */
  .drag-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    pointer-events: all;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--canvas) 92%, transparent);
    border: 2px dashed var(--border-strong);
  }

  .overlay-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }

  .overlay-icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-1);
    margin-bottom: 8px;
  }

  .overlay-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }

  .overlay-sub {
    font-size: 14px;
    color: var(--text-3);
  }
</style>
