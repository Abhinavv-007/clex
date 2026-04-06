<script lang="ts">
  import { onDestroy } from 'svelte'
  import { encryptSecret } from '$lib/vault/crypto'
  import QRCode from '$components/sharing/QRCode.svelte'
  import { fade, fly, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  export let vaultApiUrl = '/vault/api'

  const MAX_CHARS = 10_000
  const QUICK_TTL_OPTIONS = [
    { value: 60, label: '1 min' },
    { value: 300, label: '5 min' },
    { value: 900, label: '15 min' },
    { value: 1800, label: '30 min' },
    { value: 3600, label: '1 hour' },
  ]

  let content = ''
  let quickTtl = 900
  let useCustomTtl = false
  let customMinutes = 45
  let creating = false
  let secretUrl = ''
  let secretId = ''
  let error = ''
  let copied = false
  let statusData: { exists?: boolean; alreadyOpened: boolean; openedAt: number | null; expiresAt?: number | null } | null = null
  let statusPoller: ReturnType<typeof setInterval> | null = null

  $: remaining = MAX_CHARS - content.length
  $: ttlSeconds = useCustomTtl
    ? Math.min(604800, Math.max(60, Math.round(customMinutes * 60)))
    : quickTtl
  $: ttlLabel = formatTtl(ttlSeconds)
  $: canCreate = content.trim().length > 0 && !creating
  $: qrValue = secretUrl

  onDestroy(() => {
    if (statusPoller) clearInterval(statusPoller)
  })

  function formatTtl(seconds: number): string {
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`
    if (seconds < 86400) {
      const hours = seconds / 3600
      return hours % 1 === 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${hours.toFixed(1)} hours`
    }
    const days = seconds / 86400
    return `${days} day${days === 1 ? '' : 's'}`
  }

  async function createSecret() {
    if (!canCreate) return
    creating = true
    error = ''

    try {
      const { encrypted, keyB64 } = await encryptSecret(content)
      const res = await fetch(`${vaultApiUrl}/secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedPayload: encrypted.ciphertextB64,
          iv: encrypted.ivB64,
          ttlSeconds,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error ?? `Server error: ${res.status}`)

      secretId = payload.id as string
      secretUrl = `${window.location.origin}/vault/secret/${payload.id}#key=${keyB64}`
      statusData = {
        alreadyOpened: false,
        openedAt: null,
        expiresAt: (payload.expiresAt as number | undefined) ?? Date.now() + ttlSeconds * 1000,
      }
      startStatusPolling()
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create secret'
    } finally {
      creating = false
    }
  }

  function startStatusPolling() {
    if (statusPoller) clearInterval(statusPoller)
    statusPoller = setInterval(async () => {
      try {
        const res = await fetch(`${vaultApiUrl}/secret/${secretId}/status`)
        if (!res.ok) return
        statusData = await res.json() as { exists?: boolean; alreadyOpened: boolean; openedAt: number | null; expiresAt?: number | null }
        if (statusData.alreadyOpened && statusPoller) {
          clearInterval(statusPoller)
        }
      } catch {
        // keep polling until a later successful response
      }
    }, 5000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(secretUrl)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  function openLink() {
    window.open(secretUrl, '_blank', 'noopener,noreferrer')
  }

  function reset() {
    if (statusPoller) clearInterval(statusPoller)
    statusPoller = null
    secretUrl = ''
    secretId = ''
    statusData = null
    content = ''
    copied = false
    error = ''
    useCustomTtl = false
    quickTtl = 900
    customMinutes = 45
  }
</script>

<div class="vsc-root">
  <div class="vsc-shell">
    <section class="vsc-main" in:fade={{ duration: 180 }}>
      <div class="vsc-header">
        <p class="vsc-kicker">Secret Share</p>
        <h2 class="vsc-title">One-time text links with room to work.</h2>
        <p class="vsc-subtitle">
          Build the message in Vault, choose the expiry window you actually need, then hand off the one-time link through a URL or QR code.
        </p>
      </div>

      {#if !secretUrl}
        <div class="vsc-section">
          <label class="vsc-section-head" for="secret-content">Secret content</label>
          <textarea
            id="secret-content"
            class="input vsc-textarea scroll-thin"
            placeholder="Paste a password, API key, private note, or any text that should vanish after one reveal."
            bind:value={content}
            rows="12"
            maxlength={MAX_CHARS}
          ></textarea>
          <div class="vsc-field-meta">
            <span>{ttlLabel} before expiry if unopened</span>
            <span class:vsc-char-count--warn={remaining < 500}>{remaining} chars remaining</span>
          </div>
        </div>

        <fieldset class="vsc-section">
          <legend class="vsc-section-head">Link lifetime</legend>
          <div class="vsc-ttl-grid">
            {#each QUICK_TTL_OPTIONS as option}
              <button
                class="vsc-ttl-btn"
                class:vsc-ttl-btn--active={!useCustomTtl && ttlSeconds === option.value}
                type="button"
                on:click={() => {
                  quickTtl = option.value
                  useCustomTtl = false
                }}
              >
                {option.label}
              </button>
            {/each}

            <button
              class="vsc-ttl-btn"
              class:vsc-ttl-btn--active={useCustomTtl}
              type="button"
              on:click={() => (useCustomTtl = true)}
            >
              Custom
            </button>
          </div>

          {#if useCustomTtl}
            <div class="vsc-custom-wrap" in:fly={{ y: 6, duration: 140 }}>
              <label class="vsc-label" for="secret-custom-ttl">Custom time in minutes</label>
              <input
                id="secret-custom-ttl"
                class="input vsc-custom-input"
                type="number"
                min="1"
                max="10080"
                step="1"
                bind:value={customMinutes}
              />
              <p class="vsc-custom-note">Allowed range: 1 minute to 7 days.</p>
            </div>
          {/if}
        </fieldset>

        <div class="vsc-section">
          <p class="vsc-section-head">Active protections</p>
          <div class="vsc-protection-grid">
            {#each [
              'View once',
              '60s viewing window',
              'No select',
              'Tab switch lock',
              'DevTools guard',
              'Memory only',
            ] as protection}
              <span class="vsc-protection-badge">{protection}</span>
            {/each}
          </div>
        </div>

        {#if error}
          <p class="vsc-error" in:fly={{ y: 4, duration: 140 }}>{error}</p>
        {/if}

        <button
          class="vsc-primary-btn"
          disabled={!canCreate}
          type="button"
          on:click={createSecret}
        >
          {#if creating}
            <span class="vsc-spinner"></span>
            Encrypting link...
          {:else}
            Create one-time link
          {/if}
        </button>
      {:else}
        <div class="vsc-result-copy" in:scale={{ duration: 260, easing: quintOut, start: 0.98 }}>
          <div class="vsc-result-status">
            <p class="vsc-section-head">Recipient status</p>
            <p class="vsc-result-status-copy">
              {#if !statusData?.alreadyOpened}
                Waiting for the recipient to open the link.
              {:else}
                Opened {statusData.openedAt ? new Date(statusData.openedAt).toLocaleTimeString() : 'recently'}.
              {/if}
            </p>
          </div>

          <div class="vsc-result-actions">
            <button class="vsc-primary-btn" type="button" on:click={copyUrl}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button class="vsc-secondary-btn" type="button" on:click={openLink}>
              Open link
            </button>
            <button class="vsc-secondary-btn" type="button" on:click={reset}>
              Create another
            </button>
          </div>
        </div>
      {/if}
    </section>

    <aside class="vsc-side">
      {#if secretUrl}
        <div class="vsc-side-card" in:scale={{ duration: 260, easing: quintOut, start: 0.97 }}>
          <p class="vsc-kicker">Ready to share</p>
          <h3 class="vsc-side-title">Scan or send the full link.</h3>
          <p class="vsc-side-copy">
            The key stays in the URL hash, so the server never receives it. The recipient must open the exact link shown here.
          </p>

          <div class="vsc-qr-wrap">
            <QRCode value={qrValue} size={186} />
          </div>

          <div class="vsc-link-box">{secretUrl}</div>

          <div class="vsc-side-meta">
            <div class="vsc-meta-card">
              <span class="vsc-meta-label">Link expiry</span>
              <strong>{ttlLabel}</strong>
            </div>
            <div class="vsc-meta-card">
              <span class="vsc-meta-label">View window</span>
              <strong>60 seconds once opened</strong>
            </div>
            <div class="vsc-meta-card">
              <span class="vsc-meta-label">Status</span>
              <strong>{statusData?.alreadyOpened ? 'Opened' : 'Not yet opened'}</strong>
            </div>
          </div>
        </div>
      {:else}
        <div class="vsc-side-card">
          <p class="vsc-kicker">How it behaves</p>
          <h3 class="vsc-side-title">Tighter timing, cleaner handoff.</h3>
          <p class="vsc-side-copy">
            Once a recipient opens the secret, Vault starts a 60-second viewing timer and destroys the payload after the first reveal.
          </p>

          <div class="vsc-side-list">
            <div class="vsc-side-item">
              <span class="vsc-meta-label">Fast presets</span>
              <strong>1, 5, 15, and 30 minutes are built in.</strong>
            </div>
            <div class="vsc-side-item">
              <span class="vsc-meta-label">Custom range</span>
              <strong>Any minute value from 1 to 10080 is accepted.</strong>
            </div>
            <div class="vsc-side-item">
              <span class="vsc-meta-label">Share mode</span>
              <strong>Copy the URL or let the recipient scan the QR code.</strong>
            </div>
          </div>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .vsc-root {
    width: 100%;
  }

  .vsc-shell {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 380px);
    gap: 20px;
    align-items: start;
  }

  .vsc-main,
  .vsc-side {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 24px;
  }

  .vsc-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vsc-kicker,
  .vsc-section-head,
  .vsc-meta-label {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vsc-title,
  .vsc-side-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(2rem, 3.5vw, 2.95rem);
    line-height: 0.92;
    letter-spacing: -0.045em;
    color: var(--text-1);
    text-transform: uppercase;
  }

  .vsc-side-title {
    font-size: clamp(1.6rem, 3vw, 2.15rem);
  }

  .vsc-subtitle,
  .vsc-side-copy,
  .vsc-result-status-copy,
  .vsc-custom-note {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-2);
  }

  .vsc-section,
  .vsc-side-card,
  .vsc-result-copy {
    margin-top: 20px;
    padding: 18px;
    border: 2px solid var(--border-hard);
    background: var(--surface-2);
    border-radius: 16px;
    box-shadow: 4px 4px 0 var(--border-hard);
  }

  .vsc-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .vsc-textarea {
    min-height: 240px;
    resize: vertical;
    font-size: 15px;
    line-height: 1.7;
  }

  .vsc-field-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }

  .vsc-char-count--warn {
    color: var(--amber);
  }

  .vsc-ttl-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .vsc-ttl-btn {
    min-height: 42px;
    padding: 8px 14px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 3px 3px 0 var(--border-hard);
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-2);
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .vsc-ttl-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--border-hard);
  }

  .vsc-ttl-btn--active {
    background: var(--accent);
    border-color: #111;
    color: #111;
    box-shadow: 4px 4px 0 #111;
  }

  .vsc-custom-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vsc-label {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vsc-custom-input {
    max-width: 180px;
  }

  .vsc-protection-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .vsc-protection-badge {
    padding: 6px 10px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 10px;
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vsc-result-actions,
  .vsc-side-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }

  .vsc-link-box {
    margin-top: 18px;
    padding: 12px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.6;
    color: var(--text-2);
    overflow-wrap: anywhere;
  }

  .vsc-qr-wrap {
    margin-top: 18px;
    display: flex;
    justify-content: center;
  }

  .vsc-meta-card,
  .vsc-side-item {
    flex: 1 1 150px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface);
    border-radius: 12px;
  }

  .vsc-side-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 18px;
  }

  .vsc-meta-card strong,
  .vsc-side-item strong {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-1);
  }

  .vsc-primary-btn,
  .vsc-secondary-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    padding: 10px 16px;
    border-radius: 12px;
    border: 2px solid var(--border-hard);
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--border-hard);
    transition: transform 120ms ease, box-shadow 120ms ease;
  }

  .vsc-primary-btn:hover,
  .vsc-secondary-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--border-hard);
  }

  .vsc-primary-btn {
    background: var(--accent);
    color: #111;
  }

  .vsc-secondary-btn {
    background: var(--surface);
    color: var(--text-1);
  }

  .vsc-primary-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    transform: none;
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  .vsc-error {
    margin: 0;
    color: #b42318;
    font-size: 13px;
  }

  .vsc-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(0, 0, 0, 0.2);
    border-top-color: rgba(0, 0, 0, 0.85);
    border-radius: 50%;
    animation: vsc-spin 0.8s linear infinite;
  }

  @keyframes vsc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 1080px) {
    .vsc-shell {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .vsc-main,
    .vsc-side,
    .vsc-section,
    .vsc-side-card,
    .vsc-result-copy {
      padding: 16px;
    }

    .vsc-title,
    .vsc-side-title {
      font-size: 1.8rem;
    }

    .vsc-field-meta,
    .vsc-result-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .vsc-primary-btn,
    .vsc-secondary-btn {
      width: 100%;
    }
  }
</style>
