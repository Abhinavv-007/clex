<script lang="ts">
  import { onDestroy } from 'svelte'
  import { encryptSecret } from '$lib/vault/crypto'
  import { encodeSecretAccessCode } from '$lib/vault/handoff'
  import QRCode from '$components/sharing/QRCode.svelte'
  import { fade, fly, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'

  export let vaultApiUrl = '/vault/api'

  interface SecretPolicy {
    viewOnce: boolean
    timedView: boolean
    noSelect: boolean
    tabSwitchLock: boolean
    devtoolsGuard: boolean
    screenshotGuard: boolean
    memoryOnly: true
    viewWindowSeconds: number
  }

  type SelectableProtectionKey =
    | 'viewOnce'
    | 'timedView'
    | 'noSelect'
    | 'tabSwitchLock'
    | 'devtoolsGuard'
    | 'screenshotGuard'

  interface SecretStatusPayload {
    exists?: boolean
    alreadyOpened: boolean
    openedAt: number | null
    expiresAt?: number | null
    policy?: Partial<SecretPolicy>
  }

  const MAX_CHARS = 10_000
  const QUICK_TTL_OPTIONS = [
    { value: 60, label: '1 min' },
    { value: 300, label: '5 min' },
    { value: 900, label: '15 min' },
    { value: 1800, label: '30 min' },
    { value: 3600, label: '1 hour' },
  ]

  const SELECTABLE_PROTECTIONS: {
    key: SelectableProtectionKey
    label: string
    copy: string
  }[] = [
    {
      key: 'viewOnce',
      label: 'View once',
      copy: 'Consume the link after the first reveal',
    },
    {
      key: 'timedView',
      label: '60s viewing window',
      copy: 'Auto-hide the open page after 60 seconds',
    },
    {
      key: 'noSelect',
      label: 'No select',
      copy: 'Disable selection and copy shortcuts on the reveal page',
    },
    {
      key: 'tabSwitchLock',
      label: 'Tab switch lock',
      copy: 'Destroy the local reveal if the recipient changes tabs',
    },
    {
      key: 'devtoolsGuard',
      label: 'DevTools guard',
      copy: 'Block common inspector shortcuts and detect an open panel',
    },
    {
      key: 'screenshotGuard',
      label: 'Screenshot guard',
      copy: 'Best-effort block for Print Screen and a live watermark on reveal',
    },
  ]

  const DEFAULT_PROTECTIONS: Record<SelectableProtectionKey, boolean> = {
    viewOnce: false,
    timedView: false,
    noSelect: false,
    tabSwitchLock: false,
    devtoolsGuard: false,
    screenshotGuard: false,
  }

  let content = ''
  let quickTtl = 900
  let useCustomTtl = false
  let customMinutes = 45
  let creating = false
  let secretUrl = ''
  let secretId = ''
  let secretAccessCode = ''
  let error = ''
  let copied = false
  let codeCopied = false
  let statusData: SecretStatusPayload | null = null
  let statusPoller: ReturnType<typeof setInterval> | null = null
  let protections = { ...DEFAULT_PROTECTIONS }

  $: remaining = MAX_CHARS - content.length
  $: ttlSeconds = useCustomTtl
    ? Math.min(604800, Math.max(60, Math.round(customMinutes * 60)))
    : quickTtl
  $: ttlLabel = formatTtl(ttlSeconds)
  $: canCreate = content.trim().length > 0 && !creating
  $: qrValue = secretUrl
  $: formattedSecretAccessCode = secretAccessCode
  $: selectedProtectionCount = Object.values(protections).filter(Boolean).length
  $: policy = {
    ...protections,
    memoryOnly: true as const,
    viewWindowSeconds: protections.timedView ? 60 : 0,
  }
  $: protectionLabels = SELECTABLE_PROTECTIONS.filter((item) => protections[item.key]).map((item) => item.label)
  $: revealRuleLabel = policy.viewOnce ? 'Consumed on first reveal' : 'Reopens until link expiry'
  $: viewWindowLabel = policy.timedView ? 'Open page closes after 60 seconds' : 'No forced close after reveal'
  $: resultGuardLabel = protectionLabels.length > 0 ? protectionLabels.join(' • ') : 'No optional guards selected'

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

  function toggleProtection(key: SelectableProtectionKey) {
    protections = {
      ...protections,
      [key]: !protections[key],
    }
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
          policy,
        }),
      })

      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error ?? `Server error: ${res.status}`)

      secretId = payload.id as string
      secretUrl = `${window.location.origin}/vault/secret?id=${encodeURIComponent(payload.id as string)}#key=${encodeURIComponent(keyB64)}`
      secretAccessCode = encodeSecretAccessCode(payload.id as string, keyB64)
      statusData = {
        alreadyOpened: false,
        openedAt: null,
        expiresAt: (payload.expiresAt as number | undefined) ?? Date.now() + ttlSeconds * 1000,
        policy: (payload.policy as Partial<SecretPolicy> | undefined) ?? policy,
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
        statusData = await res.json() as SecretStatusPayload
        if (statusData.alreadyOpened && statusPoller && policy.viewOnce) {
          clearInterval(statusPoller)
        }
      } catch {
        // Keep polling until a later successful response.
      }
    }, 5000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(secretUrl)
    copied = true
    setTimeout(() => (copied = false), 2000)
  }

  async function copyCode() {
    if (!secretAccessCode) return
    await navigator.clipboard.writeText(secretAccessCode)
    codeCopied = true
    setTimeout(() => (codeCopied = false), 2000)
  }

  function openLink() {
    window.open(secretUrl, '_blank', 'noopener,noreferrer')
  }

  function reset() {
    if (statusPoller) clearInterval(statusPoller)
    statusPoller = null
    secretUrl = ''
    secretId = ''
    secretAccessCode = ''
    statusData = null
    content = ''
    copied = false
    codeCopied = false
    error = ''
    useCustomTtl = false
    quickTtl = 900
    customMinutes = 45
    protections = { ...DEFAULT_PROTECTIONS }
  }
</script>

<div class="vsc-root">
  <div class="vsc-shell">
    <section class="vsc-main" in:fade={{ duration: 180 }}>
      <div class="vsc-header">
        <p class="vsc-kicker">Secret Share</p>
        <h2 class="vsc-title">Private links with selectable protections</h2>
        <p class="vsc-subtitle">
          Write the message, choose how long the link stays live, then turn on only the protections you want.
        </p>
      </div>

      {#if !secretUrl}
        <div class="vsc-section">
          <div class="vsc-section-row">
            <label class="vsc-section-head" for="secret-content">Secret content</label>
            <span class:vsc-char-count--warn={remaining < 500}>{remaining} chars left</span>
          </div>
          <textarea
            id="secret-content"
            class="input vsc-textarea scroll-thin"
            placeholder="Paste a password, API key, note, or any text that should stay private."
            bind:value={content}
            rows="12"
            maxlength={MAX_CHARS}
          ></textarea>
          <div class="vsc-field-meta">
            <span>{ttlLabel} link expiry</span>
            <span>{revealRuleLabel}</span>
          </div>
        </div>

        <div class="vsc-section" role="group" aria-labelledby="secret-link-lifetime">
          <div class="vsc-section-row">
            <p id="secret-link-lifetime" class="vsc-section-head">Link lifetime</p>
            <span class="vsc-section-meta">{ttlLabel}</span>
          </div>

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
        </div>

        <div class="vsc-section">
          <div class="vsc-section-row">
            <p class="vsc-section-head">Selectable protections</p>
            <span class="vsc-section-meta">{selectedProtectionCount} active</span>
          </div>

          <div class="vsc-protection-grid">
            {#each SELECTABLE_PROTECTIONS as item}
              <button
                type="button"
                class="vsc-protection-btn"
                class:vsc-protection-btn--active={protections[item.key]}
                aria-pressed={protections[item.key]}
                on:click={() => toggleProtection(item.key)}
              >
                <span class="vsc-protection-top">
                  <span class="vsc-protection-title">{item.label}</span>
                  <span
                    class="vsc-protection-state"
                    class:vsc-protection-state--active={protections[item.key]}
                  >
                    {protections[item.key] ? 'Selected' : 'Off'}
                  </span>
                </span>
                <span class="vsc-protection-copy">{item.copy}</span>
              </button>
            {/each}
          </div>

          <div class="vsc-system-card">
            <div>
              <span class="vsc-system-label">Always on</span>
              <strong class="vsc-system-title">Memory only</strong>
            </div>
            <p class="vsc-system-copy">
              The decrypted secret stays out of local storage and cookies. The key remains in the URL hash until reveal.
            </p>
          </div>
        </div>

        {#if error}
          <p class="vsc-error" in:fly={{ y: 4, duration: 140 }}>{error}</p>
        {/if}

        <div class="vsc-actions-row">
          <button
            class="vsc-primary-btn"
            disabled={!canCreate}
            type="button"
            on:click={createSecret}
          >
            {#if creating}
              <span class="vsc-spinner"></span>
              Creating link…
            {:else}
              Create link
            {/if}
          </button>

          <p class="vsc-actions-copy">{viewWindowLabel}</p>
        </div>
      {:else}
        <div class="vsc-result-copy" in:scale={{ duration: 260, easing: quintOut, start: 0.98 }}>
          <div class="vsc-result-status">
            <p class="vsc-section-head">Recipient status</p>
            <p class="vsc-result-status-copy">
              {#if !statusData?.alreadyOpened}
                Waiting for the recipient to open the link
              {:else if policy.viewOnce}
                Opened {statusData.openedAt ? new Date(statusData.openedAt).toLocaleTimeString() : 'recently'} and consumed
              {:else}
                Opened {statusData.openedAt ? new Date(statusData.openedAt).toLocaleTimeString() : 'recently'} and still reusable until expiry
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
          <h3 class="vsc-side-title">Send the link, QR, or reveal code</h3>
          <p class="vsc-side-copy">
            The server never receives the hash-based decryption key. Use the QR for the fastest handoff, the direct link for taps, or the reveal code for manual entry.
          </p>

          <div class="vsc-qr-wrap">
            <QRCode value={qrValue} size={186} />
          </div>

          <div class="vsc-handoff-grid">
            <div class="vsc-handoff-card">
              <div class="vsc-handoff-row">
                <span class="vsc-meta-label">Direct link</span>
                <button class="vsc-inline-btn" type="button" on:click={copyUrl}>
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div class="vsc-link-box">{secretUrl}</div>
            </div>

            <div class="vsc-handoff-card">
              <div class="vsc-handoff-row">
                <span class="vsc-meta-label">Reveal code</span>
                <button class="vsc-inline-btn" type="button" on:click={copyCode}>
                  {codeCopied ? 'Copied' : 'Copy code'}
                </button>
              </div>
              <div class="vsc-code-box">{formattedSecretAccessCode}</div>
              <p class="vsc-code-note">Open <code>/vault/secret</code> and paste this code if you cannot send the full link.</p>
            </div>
          </div>

          <div class="vsc-side-meta">
            <div class="vsc-meta-card">
              <span class="vsc-meta-label">Link expiry</span>
              <strong>{ttlLabel}</strong>
            </div>
            <div class="vsc-meta-card">
              <span class="vsc-meta-label">Reveal rule</span>
              <strong>{revealRuleLabel}</strong>
            </div>
            <div class="vsc-meta-card">
              <span class="vsc-meta-label">Optional guards</span>
              <strong>{resultGuardLabel}</strong>
            </div>
          </div>
        </div>
      {:else}
        <div class="vsc-side-card">
          <p class="vsc-kicker">How it behaves</p>
          <h3 class="vsc-side-title">You choose the policy for each link</h3>
          <p class="vsc-side-copy">
            A secret can be strictly one-time, reusable until expiry, timer-limited after reveal, or any mix of those rules.
          </p>

          <div class="vsc-side-list">
            <div class="vsc-side-item">
              <span class="vsc-meta-label">Expiry</span>
              <strong>The link itself always expires on the timer you choose.</strong>
            </div>
            <div class="vsc-side-item">
              <span class="vsc-meta-label">Reveal behavior</span>
              <strong>Enable only the protections you actually want the recipient to hit.</strong>
            </div>
            <div class="vsc-side-item">
              <span class="vsc-meta-label">Memory only</span>
              <strong>Decrypted content never gets written into local storage.</strong>
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
    grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
    gap: 20px;
    align-items: start;
  }

  .vsc-main,
  .vsc-side {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 16px;
    padding: 22px;
  }

  .vsc-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .vsc-kicker,
  .vsc-section-head,
  .vsc-meta-label,
  .vsc-system-label {
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
    font-size: clamp(1.7rem, 2.5vw, 2.2rem);
    line-height: 1.04;
    letter-spacing: -0.03em;
    color: var(--text-1);
    text-wrap: balance;
  }

  .vsc-side-title {
    font-size: clamp(1.35rem, 2vw, 1.75rem);
  }

  .vsc-subtitle,
  .vsc-side-copy,
  .vsc-result-status-copy,
  .vsc-custom-note,
  .vsc-protection-copy,
  .vsc-system-copy,
  .vsc-actions-copy {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-2);
  }

  .vsc-section,
  .vsc-side-card,
  .vsc-result-copy {
    margin-top: 18px;
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

  .vsc-section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .vsc-section-meta,
  .vsc-field-meta,
  .vsc-char-count--warn {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
  }

  .vsc-field-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .vsc-char-count--warn {
    color: var(--amber);
  }

  .vsc-textarea {
    min-height: 240px;
    resize: vertical;
    font-size: 15px;
    line-height: 1.7;
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

  .vsc-ttl-btn:hover,
  .vsc-protection-btn:hover,
  .vsc-primary-btn:hover,
  .vsc-secondary-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--border-hard);
  }

  .vsc-ttl-btn--active,
  .vsc-protection-btn--active {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--accent) 68%, var(--border-hard));
    color: var(--text-1);
    box-shadow: 4px 4px 0 var(--accent);
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
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .vsc-protection-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    min-height: 118px;
    padding: 15px 16px;
    border-radius: 14px;
    border: 2px solid var(--border-hard);
    background: var(--surface);
    box-shadow: 3px 3px 0 var(--border-hard);
    text-align: left;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    color: var(--text-1);
  }

  .vsc-protection-top {
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .vsc-protection-title {
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-weight: 700;
    color: inherit;
    line-height: 0.98;
    letter-spacing: -0.02em;
  }

  .vsc-protection-state,
  .vsc-inline-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1.5px solid var(--border);
    background: var(--surface-2);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .vsc-inline-btn {
    cursor: pointer;
  }

  .vsc-protection-state--active {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: #111;
    box-shadow: 2px 2px 0 #111;
  }

  .vsc-protection-btn--active .vsc-protection-copy {
    color: var(--text-1);
  }

  .vsc-system-card {
    display: grid;
    grid-template-columns: minmax(0, 180px) 1fr;
    gap: 14px;
    padding: 14px;
    border-radius: 14px;
    border: 1.5px solid var(--border-hard);
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  }

  .vsc-system-title {
    display: block;
    margin-top: 4px;
    font-family: var(--font-display);
    font-size: 1.08rem;
    line-height: 0.98;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }

  .vsc-actions-row,
  .vsc-result-actions,
  .vsc-side-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-top: 16px;
  }

  .vsc-actions-copy {
    flex: 1 1 220px;
  }

  .vsc-link-box,
  .vsc-code-box {
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

  .vsc-code-box {
    word-break: break-all;
  }

  .vsc-qr-wrap {
    margin-top: 18px;
    display: flex;
    justify-content: center;
  }

  .vsc-handoff-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 18px;
  }

  .vsc-handoff-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .vsc-handoff-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }

  .vsc-code-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-3);
  }

  .vsc-code-note code {
    font-family: var(--font-mono);
    font-size: 11px;
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
    line-height: 1.55;
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

  @media (max-width: 720px) {
    .vsc-protection-grid {
      grid-template-columns: 1fr;
    }

    .vsc-system-card {
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
      font-size: 1.7rem;
    }

    .vsc-field-meta,
    .vsc-actions-row,
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
