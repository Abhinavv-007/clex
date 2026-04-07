<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { decryptSecret } from '$lib/vault/crypto'
  import { decodeSecretAccessCode } from '$lib/vault/handoff'

  export let vaultApiUrl = '/vault/api'

  type Phase = 'entry' | 'loading' | 'confirm' | 'viewing' | 'destroyed' | 'error'

  interface SecretPolicy {
    viewOnce: boolean
    timedView: boolean
    noSelect: boolean
    tabSwitchLock: boolean
    devtoolsGuard: boolean
    memoryOnly: true
    viewWindowSeconds: number
  }

  interface SecretStatusPayload {
    exists?: boolean
    alreadyOpened: boolean
    openedAt: number | null
    expiresAt?: number | null
    policy?: Partial<SecretPolicy>
  }

  interface SecretFetchPayload {
    encryptedPayload: string
    iv: string
    expiresAt: number
    createdAt: number
    policy?: Partial<SecretPolicy>
  }

  const LEGACY_POLICY: SecretPolicy = {
    viewOnce: true,
    timedView: true,
    noSelect: true,
    tabSwitchLock: true,
    devtoolsGuard: true,
    memoryOnly: true,
    viewWindowSeconds: 60,
  }

  let phase: Phase = 'loading'
  let secretContent: string | null = null
  let errorMsg = ''
  let countdown = LEGACY_POLICY.viewWindowSeconds
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  let devtoolsTimer: ReturnType<typeof setInterval> | null = null
  let locked = false
  let lockReason = ''
  let secretPolicy: SecretPolicy = LEGACY_POLICY
  let secretId = ''
  let secretKeyB64 = ''
  let accessInput = ''

  function normalizePolicy(input?: Partial<SecretPolicy>): SecretPolicy {
    if (!input) return LEGACY_POLICY

    const timedView = Boolean(input.timedView)
    const requestedWindow = Math.floor(Number(input.viewWindowSeconds ?? 60))

    return {
      viewOnce: Boolean(input.viewOnce),
      timedView,
      noSelect: Boolean(input.noSelect),
      tabSwitchLock: Boolean(input.tabSwitchLock),
      devtoolsGuard: Boolean(input.devtoolsGuard),
      memoryOnly: true,
      viewWindowSeconds: timedView
        ? Math.min(3600, Math.max(15, Number.isFinite(requestedWindow) ? requestedWindow : 60))
        : 0,
    }
  }

  function extractIdFromPath(pathname: string): string {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length >= 3 && parts[0] === 'vault' && parts[1] === 'secret') {
      return parts[2] ?? ''
    }
    return ''
  }

  function parseSecretLocation(): { id: string; keyB64: string } | null {
    const url = new URL(window.location.href)
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
    const id = url.searchParams.get('id') ?? extractIdFromPath(url.pathname)
    const keyB64 = hashParams.get('key') ?? ''

    if (!id || !keyB64) return null
    return { id, keyB64 }
  }

  function parseSecretInput(raw: string): { id: string; keyB64: string } | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    const directCode = decodeSecretAccessCode(trimmed)
    if (directCode) return directCode

    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
      try {
        const url = new URL(trimmed, window.location.origin)
        const codeParam = url.searchParams.get('code')
        if (codeParam) {
          return decodeSecretAccessCode(codeParam)
        }

        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
        const id = url.searchParams.get('id') ?? extractIdFromPath(url.pathname)
        const keyB64 = hashParams.get('key') ?? ''

        if (!id || !keyB64) return null
        return { id, keyB64 }
      } catch {
        return null
      }
    }

    return null
  }

  function applySecretLocation(id: string, keyB64: string) {
    secretId = id
    secretKeyB64 = keyB64

    const url = new URL(window.location.href)
    url.searchParams.set('id', id)
    url.hash = `key=${encodeURIComponent(keyB64)}`
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function describePolicy(policy: SecretPolicy): string {
    const rules: string[] = []

    rules.push(policy.viewOnce ? 'One reveal only' : 'Reopens until link expiry')

    if (policy.timedView) {
      rules.push(`${policy.viewWindowSeconds}s viewing window`)
    }
    if (policy.noSelect) {
      rules.push('No text selection')
    }
    if (policy.tabSwitchLock) {
      rules.push('Tab switch destroys access')
    }
    if (policy.devtoolsGuard) {
      rules.push('DevTools guard enabled')
    }

    rules.push('Memory only')
    return rules.join(' • ')
  }

  function policyBadges(policy: SecretPolicy): string[] {
    const badges: string[] = []

    if (policy.viewOnce) badges.push('View once')
    if (policy.timedView) badges.push(`${policy.viewWindowSeconds}s window`)
    if (policy.noSelect) badges.push('No select')
    if (policy.tabSwitchLock) badges.push('Tab switch lock')
    if (policy.devtoolsGuard) badges.push('DevTools guard')
    badges.push('Memory only')

    return badges
  }

  function onContextMenu(event: MouseEvent) {
    if (!(phase === 'viewing' && secretPolicy.noSelect)) return
    event.preventDefault()
    event.stopPropagation()
  }

  function onSelectStart(event: Event) {
    if (!(phase === 'viewing' && secretPolicy.noSelect)) return
    event.preventDefault()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (phase !== 'viewing') return

    const ctrl = event.ctrlKey || event.metaKey
    const shift = event.shiftKey
    const key = event.key.toLowerCase()

    if (secretPolicy.noSelect && ctrl && ['a', 'c', 'x'].includes(key)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (secretPolicy.devtoolsGuard && ctrl && shift && ['i', 'j', 'c'].includes(key)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (secretPolicy.devtoolsGuard && ctrl && key === 'u') {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (secretPolicy.devtoolsGuard && event.key === 'F12') {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function onVisibilityChange() {
    if (phase === 'viewing' && secretPolicy.tabSwitchLock && document.hidden) {
      permanentLock('Tab switched — secret destroyed for safety')
    }
  }

  function permanentLock(reason: string) {
    if (locked) return
    locked = true
    lockReason = reason
    destroySecret()
  }

  function startDevtoolsDetection() {
    if (!secretPolicy.devtoolsGuard) return

    devtoolsTimer = setInterval(() => {
      const widthDelta = window.outerWidth - window.innerWidth
      const heightDelta = window.outerHeight - window.innerHeight
      if (widthDelta > 160 || heightDelta > 160) {
        permanentLock('DevTools detected — secret destroyed for safety')
      }
    }, 1000)

    let devtoolsOpen = false
    const checkConsole = () => {
      const start = performance.now()
      // eslint-disable-next-line no-console
      console.log('%c', 'color: transparent; font-size: 0')
      const elapsed = performance.now() - start
      if (elapsed > 10) {
        devtoolsOpen = true
      }
    }

    setTimeout(() => {
      checkConsole()
      if (devtoolsOpen && phase === 'viewing') {
        permanentLock('DevTools detected — secret destroyed for safety')
      }
    }, 200)
  }

  function startCountdown() {
    if (!secretPolicy.timedView || secretPolicy.viewWindowSeconds <= 0) return

    countdown = secretPolicy.viewWindowSeconds
    countdownTimer = setInterval(() => {
      countdown -= 1
      if (countdown <= 0) {
        clearInterval(countdownTimer!)
        destroySecret()
      }
    }, 1000)
  }

  function destroySecret() {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    if (devtoolsTimer) {
      clearInterval(devtoolsTimer)
      devtoolsTimer = null
    }
    secretContent = null
    phase = 'destroyed'
    const url = new URL(window.location.href)
    url.hash = ''
    history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  async function loadSecretStatus() {
    if (!secretId) {
      errorMsg = 'Paste a valid secret link or reveal code.'
      phase = 'entry'
      return
    }

    try {
      const res = await fetch(`${vaultApiUrl}/secret/${secretId}/status`)
      const data = await res.json().catch(() => null) as SecretStatusPayload | null

      if (!res.ok || !data?.exists) {
        errorMsg = 'This secret is no longer available'
        phase = 'error'
        return
      }

      secretPolicy = normalizePolicy(data.policy)

      if (data.alreadyOpened && secretPolicy.viewOnce) {
        errorMsg = 'This secret has already been opened and destroyed'
        phase = 'error'
        return
      }

      phase = 'confirm'
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : 'Could not verify this secret'
      phase = 'error'
    }
  }

  async function loadAndReveal() {
    if (!secretId) {
      errorMsg = 'Paste a valid secret link or reveal code.'
      phase = 'entry'
      return
    }

    if (!secretKeyB64) {
      errorMsg = 'The reveal key is missing. Paste the full link or reveal code from Vault.'
      phase = 'entry'
      return
    }

    try {
      const res = await fetch(`${vaultApiUrl}/secret/${secretId}`)

      if (res.status === 404) {
        errorMsg = 'This secret does not exist'
        phase = 'error'
        return
      }

      if (res.status === 410) {
        errorMsg = 'This secret has already been opened or expired'
        phase = 'error'
        return
      }

      if (!res.ok) {
        errorMsg = `Vault could not open this secret (${res.status})`
        phase = 'error'
        return
      }

      const data = await res.json() as SecretFetchPayload
      secretPolicy = normalizePolicy(data.policy)
      const decrypted = await decryptSecret(
        { ciphertextB64: data.encryptedPayload, ivB64: data.iv },
        secretKeyB64,
      )

      secretContent = decrypted
      phase = 'viewing'

      await tick()
      startCountdown()
      startDevtoolsDetection()

      const url = new URL(window.location.href)
      url.hash = ''
      history.replaceState(null, '', `${url.pathname}${url.search}`)
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : 'Failed to decrypt this secret'
      phase = 'error'
    }
  }

  async function acceptAccessInput() {
    const parsed = parseSecretInput(accessInput)

    if (!parsed) {
      errorMsg = 'Paste the full secret link or the reveal code from Vault.'
      phase = 'entry'
      return
    }

    errorMsg = ''
    applySecretLocation(parsed.id, parsed.keyB64)
    phase = 'loading'
    await loadSecretStatus()
  }

  onMount(async () => {
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('selectstart', onSelectStart)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('visibilitychange', onVisibilityChange)

    const locationSecret = parseSecretLocation()
    if (!locationSecret) {
      phase = 'entry'
      return
    }

    secretId = locationSecret.id
    secretKeyB64 = locationSecret.keyB64
    await loadSecretStatus()
  })

  onDestroy(() => {
    document.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('selectstart', onSelectStart)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('visibilitychange', onVisibilityChange)

    if (countdownTimer) clearInterval(countdownTimer)
    if (devtoolsTimer) clearInterval(devtoolsTimer)
    secretContent = null
  })

  $: countdownUrgent = countdown <= 10
  $: countdownWarning = countdown <= 30 && countdown > 10
  $: activeGuardLabels = policyBadges(secretPolicy)
  $: confirmSummary = describePolicy(secretPolicy)
  $: revealRule = secretPolicy.viewOnce
    ? 'The first reveal consumes this link'
    : 'This link can reopen until the expiry timer ends'
  $: viewingCaution = secretPolicy.timedView
    ? 'Move this into your own password manager or notes app before the timer ends'
    : 'This page stays open until you close it, but the link still expires on schedule'
</script>

<div
  class="vsa-page"
  class:vsa-page--locked={locked}
  class:vsa-page--no-select={phase === 'viewing' && secretPolicy.noSelect}
>
  {#if phase === 'loading'}
    <div class="vsa-center" in:fade={{ duration: 160 }}>
      <div class="vsa-spinner-lg"></div>
    </div>

  {:else if phase === 'entry'}
    <div class="vsa-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsa-card">
        <div class="vsa-kicker">Secret Link</div>
        <h1 class="vsa-title">Open a private secret</h1>
        <p class="vsa-desc">Paste the full secret link or the reveal code from Vault.</p>

        <div class="vsa-entry-stack">
          <textarea
            class="input vsa-entry-input"
            rows="3"
            placeholder="Paste the secret link or reveal code"
            bind:value={accessInput}
            on:keydown={(event) => event.key === 'Enter' && !event.shiftKey && (event.preventDefault(), acceptAccessInput())}
          ></textarea>

          {#if errorMsg}
            <p class="vsa-desc vsa-desc--red">{errorMsg}</p>
          {/if}

          <button class="btn-accent vsa-reveal-btn" on:click={acceptAccessInput}>
            Continue
          </button>
        </div>

        <p class="vsa-entry-note">
          QR scans from Vault open this page automatically. Use the reveal code when you cannot send the full direct link.
        </p>
      </div>
    </div>

  {:else if phase === 'confirm'}
    <div class="vsa-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsa-card">
        <div class="vsa-kicker">Secret Link</div>
        <h1 class="vsa-title">Reveal Secret</h1>
        <p class="vsa-desc">
          {revealRule}. Selected protections apply only if they were enabled by the sender.
        </p>

        <div class="vsa-warn-grid">
          {#each activeGuardLabels as badge}
            <div class="vsa-warn-badge">
              <span>{badge}</span>
            </div>
          {/each}
        </div>

        <p class="vsa-warn-note">{confirmSummary}</p>

        <button class="btn-accent vsa-reveal-btn" on:click={loadAndReveal}>
          Reveal secret
        </button>
      </div>
    </div>

  {:else if phase === 'viewing'}
    <div class="vsa-view" in:fade={{ duration: 200 }}>
      {#if secretPolicy.timedView}
        <div class="vsa-countdown-wrap">
          <div
            class="vsa-countdown-bar"
            class:vsa-countdown-bar--warn={countdownWarning}
            class:vsa-countdown-bar--urgent={countdownUrgent}
            style="width: {(countdown / secretPolicy.viewWindowSeconds) * 100}%"
          ></div>
        </div>
      {/if}

      <div class="vsa-view-inner">
        {#if secretPolicy.timedView}
          <div
            class="vsa-timer"
            class:vsa-timer--warn={countdownWarning}
            class:vsa-timer--urgent={countdownUrgent}
          >
            <span class="vsa-timer-icon">⏱</span>
            <span class="vsa-timer-num">{countdown}s</span>
            <span class="vsa-timer-label">until hidden</span>
          </div>
        {/if}

        <div class="vsa-content-card">
          <div class="vsa-content-label">Secret content</div>
          <div class="vsa-content" aria-label="Secret content">
            {secretContent}
          </div>
        </div>

        <div class="vsa-active-guards">
          <span class="vsa-guards-label">Active guards</span>
          <div class="vsa-guards-row">
            {#each activeGuardLabels as badge}
              <span class="vsa-guard-dot">{badge}</span>
            {/each}
          </div>
        </div>

        <p class="vsa-caution">{viewingCaution}</p>
      </div>
    </div>

  {:else if phase === 'destroyed'}
    <div class="vsa-center" in:scale={{ duration: 300, easing: quintOut, start: 0.93 }}>
      <div class="vsa-card vsa-card--destroyed">
        <div class="vsa-icon vsa-icon--red">🗑</div>
        <h1 class="vsa-title">Secret Removed</h1>
        {#if lockReason}
          <p class="vsa-desc vsa-desc--red">{lockReason}</p>
        {:else if secretPolicy.timedView}
          <p class="vsa-desc">The viewing window ended and this local reveal was cleared.</p>
        {:else}
          <p class="vsa-desc">This secret is no longer available on this page.</p>
        {/if}
        <a href="/vault" class="btn-ghost vsa-back-btn">← Back to Vault</a>
      </div>
    </div>

  {:else if phase === 'error'}
    <div class="vsa-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsa-card">
        <div class="vsa-icon vsa-icon--red">⚠</div>
        <h1 class="vsa-title">Secret Unavailable</h1>
        <p class="vsa-desc">{errorMsg}</p>
        <a href="/vault" class="btn-ghost vsa-back-btn">← Back to Vault</a>
      </div>
    </div>

  {/if}
</div>

<style>
  .vsa-page {
    min-height: 100vh;
    background: var(--canvas);
    padding: calc(80px + env(safe-area-inset-top, 0px)) 16px 40px;
    transition: filter 0.3s;
  }

  .vsa-page--locked {
    filter: blur(12px) grayscale(0.5);
    pointer-events: none;
  }

  .vsa-page--no-select,
  .vsa-page--no-select * {
    user-select: none;
    -webkit-user-select: none;
  }

  .vsa-center {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 120px);
  }

  .vsa-card {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    border-radius: 20px;
    padding: 40px 36px;
    max-width: 560px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
  }

  .vsa-kicker {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .vsa-card--destroyed {
    border-color: var(--red, #ff4444);
    box-shadow: 6px 6px 0 var(--red, #ff4444);
  }

  .vsa-title {
    font-family: var(--font-display);
    font-size: clamp(1.9rem, 3vw, 2.45rem);
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.025em;
    margin: 0;
    line-height: 1.02;
    text-wrap: balance;
  }

  .vsa-desc {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.7;
    margin: 0;
    max-width: 460px;
  }

  .vsa-desc--red {
    color: var(--red, #ff4444);
  }

  .vsa-entry-stack {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .vsa-entry-input {
    width: 100%;
    min-height: 104px;
    resize: vertical;
    font-size: 14px;
    line-height: 1.6;
  }

  .vsa-entry-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-3);
  }

  .vsa-warn-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    justify-content: center;
  }

  .vsa-warn-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--accent-text);
    background: rgba(255, 230, 0, 0.08);
    border: 1px solid rgba(255, 230, 0, 0.22);
    border-radius: 999px;
    padding: 5px 10px;
  }

  .vsa-warn-note {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-2);
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    line-height: 1.6;
    margin: 0;
    text-align: center;
  }

  .vsa-reveal-btn {
    width: 100%;
    justify-content: center;
    font-size: 15px;
    padding: 12px 20px;
  }

  .vsa-view {
    max-width: 720px;
    margin: 0 auto;
  }

  .vsa-countdown-wrap {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--border);
    z-index: 500;
  }

  .vsa-countdown-bar {
    height: 100%;
    background: var(--green, #00e570);
    transition: width 1s linear, background 0.5s;
    border-radius: 0 2px 2px 0;
  }

  .vsa-countdown-bar--warn {
    background: var(--amber, #ffaa00);
  }

  .vsa-countdown-bar--urgent {
    background: var(--red, #ff4444);
    animation: urgent-pulse 0.5s ease-in-out infinite alternate;
  }

  .vsa-view-inner {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 16px;
  }

  .vsa-timer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--surface);
    border: 2px solid var(--border-hard);
    border-radius: 12px;
    box-shadow: 3px 3px 0 var(--border-hard);
    width: fit-content;
    transition: border-color 0.4s, box-shadow 0.4s;
  }

  .vsa-timer--warn {
    border-color: var(--amber, #ffaa00);
    box-shadow: 3px 3px 0 var(--amber, #ffaa00);
  }

  .vsa-timer--urgent {
    border-color: var(--red, #ff4444);
    box-shadow: 3px 3px 0 var(--red, #ff4444);
    animation: shake-timer 0.4s ease-in-out;
  }

  .vsa-timer-icon {
    font-size: 16px;
  }

  .vsa-timer-num {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.02em;
    min-width: 3ch;
  }

  .vsa-timer-label {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .vsa-content-card {
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: 5px 5px 0 var(--border-hard);
    border-radius: 16px;
    overflow: hidden;
  }

  .vsa-content-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--text-3);
    padding: 10px 16px 8px;
    border-bottom: 1.5px solid var(--border);
    background: var(--surface-2);
  }

  .vsa-content {
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.75;
    color: var(--text-1);
    padding: 20px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .vsa-active-guards {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .vsa-guards-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-3);
    white-space: nowrap;
  }

  .vsa-guards-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vsa-guard-dot {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--green, #00e570);
    background: rgba(0, 229, 112, 0.08);
    border: 1px solid rgba(0, 229, 112, 0.2);
    border-radius: 999px;
    padding: 4px 10px;
  }

  .vsa-caution {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
    margin: 0;
    line-height: 1.6;
  }

  .vsa-back-btn {
    font-size: 13px;
  }

  .vsa-spinner-lg {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin-slow 0.8s linear infinite;
  }

  @keyframes urgent-pulse {
    from { opacity: 1; }
    to { opacity: 0.5; }
  }

  @keyframes shake-timer {
    0% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
    100% { transform: translateX(0); }
  }

  @media (max-width: 640px) {
    .vsa-card {
      padding: 28px 20px;
      border-radius: 16px;
    }

    .vsa-title {
      font-size: 22px;
    }

    .vsa-content {
      font-size: 13px;
      padding: 16px;
    }
  }
</style>
