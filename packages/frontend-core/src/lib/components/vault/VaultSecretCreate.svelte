<script lang="ts">
  import { encryptSecret } from '$lib/vault/crypto'
  import { fade, fly, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  export let vaultApiUrl = '/vault/api'
  $: VAULT_API = vaultApiUrl
  const MAX_CHARS = 10_000

  type TTL = 3600 | 21600 | 86400 | 604800
  const TTL_OPTIONS: { value: TTL; label: string }[] = [
    { value: 3600, label: '1 hour' },
    { value: 21600, label: '6 hours' },
    { value: 86400, label: '24 hours' },
    { value: 604800, label: '7 days' },
  ]

  let content = ''
  let ttl: TTL = 86400
  let creating = false
  let secretUrl = ''
  let secretId = ''
  let error = ''
  let copied = false
  let statusData: { alreadyOpened: boolean; openedAt: number | null } | null = null
  let statusPoller: ReturnType<typeof setInterval>

  $: remaining = MAX_CHARS - content.length
  $: canCreate = content.trim().length > 0 && !creating

  async function createSecret() {
    if (!canCreate) return
    creating = true
    error = ''
    try {
      const { encrypted, keyB64 } = await encryptSecret(content)
      const res = await fetch(`${VAULT_API}/secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedPayload: encrypted.ciphertextB64,
          iv: encrypted.ivB64,
          ttlSeconds: ttl,
        }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json() as { id: string }
      secretId = data.id
      secretUrl = `${window.location.origin}/vault/secret/${data.id}#key=${keyB64}`
      startStatusPolling()
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to create secret'
    } finally {
      creating = false
    }
  }

  function startStatusPolling() {
    clearInterval(statusPoller)
    statusPoller = setInterval(async () => {
      try {
        const res = await fetch(`${VAULT_API}/secret/${secretId}/status`)
        if (!res.ok) return
        statusData = await res.json() as { alreadyOpened: boolean; openedAt: number | null }
        if (statusData.alreadyOpened) clearInterval(statusPoller)
      } catch { /* continue */ }
    }, 5000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(secretUrl)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  function reset() {
    clearInterval(statusPoller)
    secretUrl = ''
    secretId = ''
    statusData = null
    content = ''
    copied = false
    error = ''
  }
</script>

<div class="vsc-root">
  {#if !secretUrl}
    <!-- Create form -->
    <div class="vsc-form" in:fade={{ duration: 160 }}>
      <div class="vsc-header">
        <div class="vsc-title-row">
          <span class="vsc-icon">👁</span>
          <h3 class="vsc-title">Secret Share</h3>
        </div>
        <p class="vsc-sub">
          Share text that can only be viewed once. The decryption key is in the URL hash only — the server has zero knowledge.
        </p>
      </div>

      <div class="vsc-field">
        <label class="vsc-label" for="secret-content">Secret content</label>
        <textarea
          id="secret-content"
          class="input vsc-textarea scroll-thin"
          placeholder="Paste a password, API key, private note, or any text…"
          bind:value={content}
          rows="8"
          maxlength={MAX_CHARS}
        ></textarea>
        <div class="vsc-char-count" class:vsc-char-count--warn={remaining < 500}>
          {remaining} chars remaining
        </div>
      </div>

      <div class="vsc-field">
        <label class="vsc-label">Self-destructs after</label>
        <div class="vsc-ttl-row">
          {#each TTL_OPTIONS as opt}
            <button
              class="vsc-ttl-btn"
              class:vsc-ttl-btn--active={ttl === opt.value}
              on:click={() => (ttl = opt.value)}
            >{opt.label}</button>
          {/each}
        </div>
      </div>

      <div class="vsc-protections">
        <div class="vsc-section-label">Active protections</div>
        <div class="vsc-protection-grid">
          {#each [
            { icon: '⏱', label: '60s countdown' },
            { icon: '👁', label: 'View once' },
            { icon: '⊘', label: 'No copy' },
            { icon: '🔒', label: 'Tab blur' },
            { icon: '🛡', label: 'DevTools guard' },
            { icon: '🗑', label: 'Memory-only' },
          ] as p}
            <div class="vsc-protection-badge">
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </div>
          {/each}
        </div>
      </div>

      {#if error}
        <p class="vsc-err" in:fly={{ y: 4, duration: 140 }}>{error}</p>
      {/if}

      <button
        class="btn-accent vsc-create-btn"
        disabled={!canCreate}
        on:click={createSecret}
      >
        {#if creating}
          <span class="vsc-spinner"></span> Encrypting…
        {:else}
          Create Secret Link →
        {/if}
      </button>
    </div>

  {:else}
    <!-- Link display -->
    <div class="vsc-result" in:scale={{ duration: 280, easing: quintOut, start: 0.96 }}>
      <div class="vsc-result-icon">🔗</div>
      <h3 class="vsc-result-title">Secret link ready</h3>
      <p class="vsc-result-sub">
        Share this URL. It works only once. The key is in the hash — it never reaches the server.
      </p>

      <div class="vsc-url-box">
        <span class="vsc-url-text">{secretUrl}</span>
        <button class="btn-accent vsc-copy-btn" on:click={copyUrl}>
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>

      <!-- Sender status -->
      <div class="vsc-status-card">
        <div class="vsc-status-header">
          <span class="vsc-status-label">Recipient status</span>
        </div>
        {#if !statusData?.alreadyOpened}
          <div class="vsc-status-row">
            <span class="vsc-status-dot vsc-status-dot--pulse"></span>
            <span class="vsc-status-text">Not yet opened</span>
          </div>
        {:else}
          <div class="vsc-status-row" in:fade={{ duration: 200 }}>
            <span class="vsc-status-dot vsc-status-dot--opened"></span>
            <span class="vsc-status-text">
              Opened {statusData.openedAt ? new Date(statusData.openedAt).toLocaleTimeString() : ''}
            </span>
          </div>
        {/if}
      </div>

      <button class="btn-ghost vsc-new-btn" on:click={reset}>
        Create another secret
      </button>
    </div>
  {/if}
</div>

<style>
  .vsc-root {
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
  }

  .vsc-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .vsc-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vsc-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .vsc-icon {
    font-size: 22px;
  }

  .vsc-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .vsc-sub {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.6;
    margin: 0;
  }

  .vsc-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vsc-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
  }

  .vsc-textarea {
    resize: vertical;
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.6;
    min-height: 160px;
  }

  .vsc-char-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    text-align: right;
  }

  .vsc-char-count--warn {
    color: var(--amber);
  }

  .vsc-ttl-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .vsc-ttl-btn {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--border-hard);
    transition: all 0.13s;
  }

  .vsc-ttl-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vsc-ttl-btn--active {
    background: var(--accent);
    color: #000;
    border-color: #000;
    box-shadow: 2px 2px 0 #000;
  }

  .vsc-protections {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .vsc-section-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
  }

  .vsc-protection-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vsc-protection-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--green);
    background: rgba(0, 229, 112, 0.08);
    border: 1px solid rgba(0, 229, 112, 0.2);
    border-radius: 5px;
    padding: 3px 9px;
  }

  .vsc-err { color: var(--red); font-size: 13px; margin: 0; }

  .vsc-create-btn {
    align-self: flex-start;
  }

  .vsc-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0,0,0,0.2);
    border-top-color: #000;
    border-radius: 50%;
    animation: spin-slow 0.7s linear infinite;
    flex-shrink: 0;
  }

  /* Result state */
  .vsc-result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
    padding: 16px 0;
  }

  .vsc-result-icon { font-size: 40px; }

  .vsc-result-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .vsc-result-sub {
    font-size: 13px;
    color: var(--text-2);
    max-width: 400px;
    line-height: 1.6;
    margin: 0;
  }

  .vsc-url-box {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--surface-2);
    border: 2px solid var(--border-hard);
    border-radius: 10px;
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vsc-url-text {
    flex: 1 1 0;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .vsc-copy-btn {
    flex-shrink: 0;
    font-size: 12px;
    padding: 6px 14px;
  }

  .vsc-status-card {
    width: 100%;
    padding: 14px 16px;
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 10px;
  }

  .vsc-status-header {
    margin-bottom: 10px;
  }

  .vsc-status-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
  }

  .vsc-status-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .vsc-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .vsc-status-dot--pulse {
    background: var(--amber);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .vsc-status-dot--opened {
    background: var(--green);
  }

  .vsc-status-text {
    font-size: 13px;
    color: var(--text-2);
  }

  .vsc-new-btn {
    font-size: 13px;
  }
</style>
