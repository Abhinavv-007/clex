<script lang="ts">
  import { activeNote, ui, wordCount, readTimeMins, relativeTime, attachments, formatBytes, masterKey, devices, syncState } from '$stores/vault'
  import { fly, fade } from 'svelte/transition'

  $: note = $activeNote
  $: noteAttachments = note ? ($attachments.get(note.id) ?? []) : []
</script>

{#if !$ui.infoPanelCollapsed}
  <div class="vip-root" in:fly={{ x: 12, duration: 180 }}>
    {#if note}
      <div class="vip-seal">
        <span class="vip-seal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </span>
        <div class="vip-seal-copy">
          <b>Encrypted on this device</b>
          <span>AES-GCM 256 · key {$masterKey?.fingerprint ?? '—'}</span>
        </div>
        <ul class="vip-seal-list">
          <li class:vip-on={true}>Stored encrypted in IndexedDB</li>
          <li class:vip-on={$devices.length > 0}>{$devices.length ? `Syncs with ${$devices.length} paired device${$devices.length === 1 ? '' : 's'}` : 'No paired devices yet'}</li>
          <li class:vip-on={$syncState.peerCount > 0}>{$syncState.peerCount > 0 ? `${$syncState.peerCount} peer live now` : 'No peers online'}</li>
          <li class:vip-on={true}>Never written to the chain</li>
        </ul>
      </div>

      <div class="vip-section">
        <div class="vip-section-title">Info</div>
        <div class="vip-rows">
          <div class="vip-row">
            <span class="vip-label">Created</span>
            <span class="vip-val">{relativeTime(note.createdAt)}</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Modified</span>
            <span class="vip-val">{relativeTime(note.updatedAt)}</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Words</span>
            <span class="vip-val">{wordCount(note.body)}</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Read time</span>
            <span class="vip-val">{readTimeMins(note.body)} min</span>
          </div>
          <div class="vip-row">
            <span class="vip-label">Characters</span>
            <span class="vip-val">{note.body.length}</span>
          </div>
        </div>
      </div>

      <div class="vip-divider" />

      <div class="vip-section">
        <div class="vip-section-title">Tags</div>
        {#if note.tags.length > 0}
          <div class="vip-tags">
            {#each note.tags as tag}
              <span class="vip-tag">#{tag}</span>
            {/each}
          </div>
        {:else}
          <p class="vip-empty-text">No tags yet — add tags in the editor.</p>
        {/if}
      </div>

      <div class="vip-divider" />

      <div class="vip-section">
        <div class="vip-section-header">
          <div class="vip-section-title">Attachments</div>
        </div>
        {#if noteAttachments.length > 0}
          <div class="vip-attachments">
            {#each noteAttachments as att}
              <div class="vip-att-item">
                <span class="vip-att-icon">📎</span>
                <div class="vip-att-info">
                  <span class="vip-att-name">{att.filename}</span>
                  <span class="vip-att-meta">{formatBytes(att.sizeBytes)}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="vip-empty-text">No files attached.</p>
        {/if}
      </div>
    {:else}
      <div class="vip-no-note">
        <p class="vip-empty-text">Select a note to see details.</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .vip-seal {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 10px;
    margin-bottom: 18px;
    padding: 14px;
    border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
    border-radius: 14px;
    background: var(--accent-dim);
  }

  .vip-seal-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-fg);
  }

  .vip-seal-copy {
    display: grid;
    align-content: center;
    gap: 1px;
    min-width: 0;
  }

  .vip-seal-copy b {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-1);
  }

  .vip-seal-copy span {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .vip-seal-list {
    grid-column: 1 / -1;
    display: grid;
    gap: 6px;
    margin: 2px 0 0;
    padding: 0;
    list-style: none;
  }

  .vip-seal-list li {
    position: relative;
    padding-left: 16px;
    font-size: 11.5px;
    color: var(--text-3);
  }

  .vip-seal-list li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 0.45em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-strong);
  }

  .vip-seal-list li.vip-on {
    color: var(--text-2);
  }

  .vip-seal-list li.vip-on::before {
    background: var(--accent);
  }

  .vip-root {
    display: flex;
    flex-direction: column;
    gap: 0;
    min-height: 0;
    height: 100%;
    position: relative;
    padding-top: 4px;
  }

  .vip-section {
    padding: 0 0 16px;
  }

  .vip-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .vip-section-title {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
    margin-bottom: 8px;
  }

  .vip-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .vip-label {
    font-size: 12px;
    color: var(--text-3);
    flex-shrink: 0;
  }

  .vip-val {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
    text-align: right;
  }

  .vip-divider {
    height: 1px;
    background: var(--border);
    margin-bottom: 16px;
  }

  .vip-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vip-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--accent-text);
    background: var(--accent-dim);
    border: 1px solid var(--accent-border);
    border-radius: 4px;
    padding: 2px 7px;
  }

  .vip-empty-text {
    font-size: 12px;
    color: var(--text-3);
    margin: 0;
  }

  .vip-attachments {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .vip-att-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .vip-att-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .vip-att-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .vip-att-name {
    font-size: 12px;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .vip-att-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-3);
  }

  .vip-no-note {
    padding: 20px 0;
  }

</style>
