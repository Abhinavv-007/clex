<script lang="ts">
  /**
   * VaultSecretApp — view-once secret share recipient page
   *
   * URL format: /vault/secret/[id]#key=[keyB64]
   *
   * Privacy protections (all active simultaneously once content renders):
   * 1. Tab visibility blur  — switching tabs permanently locks the secret
   * 2. Right-click disabled — no context menu
   * 3. Text selection disabled — user-select: none + selectstart prevent
   * 4. DevTools detection   — size heuristic + console timing trick
   * 5. PrintScreen detection — keyup blur
   * 6. Keyboard blocking    — Ctrl+S/A/C/P/U, Shift+I/J, F12, etc.
   * 7. 60s self-destruct    — wipes content from DOM + nulls vars
   * 8. Memory-only          — never touches localStorage / sessionStorage
   */
  import { onMount, onDestroy, tick } from 'svelte'
  import { fade, scale } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import { decryptSecret } from '$lib/vault/crypto'

  export let vaultApiUrl = '/vault/api'

  // ── State ──────────────────────────────────────────────────────────────────
  type Phase = 'loading' | 'confirm' | 'viewing' | 'destroyed' | 'error' | 'missing-key'
  let phase: Phase = 'loading'

  let secretContent: string | null = null
  let errorMsg = ''
  let countdown = 60
  let countdownTimer: ReturnType<typeof setInterval> | null = null
  let devtoolsTimer: ReturnType<typeof setInterval> | null = null
  let locked = false   // set when tab blur or devtools detected
  let lockReason = ''

  // Extract secret ID from URL path (/vault/secret/<id>)
  function extractId(): string {
    const parts = window.location.pathname.split('/')
    return parts[parts.length - 1] ?? ''
  }

  // Extract key from hash (#key=<b64>)
  function extractKey(): string {
    const hash = window.location.hash.slice(1)  // remove leading #
    const params = new URLSearchParams(hash)
    return params.get('key') ?? ''
  }

  // ── Privacy guard handlers ─────────────────────────────────────────────────

  function onContextMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    return false
  }

  function onSelectStart(e: Event) {
    if (phase === 'viewing') {
      e.preventDefault()
      return false
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (phase !== 'viewing') return
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    // Block: Ctrl+S/A/C/P/U, Ctrl+Shift+I/J/C/S, F12
    if (ctrl && ['s','a','c','p','u'].includes(e.key.toLowerCase())) {
      e.preventDefault(); e.stopPropagation(); return
    }
    if (ctrl && shift && ['i','j','c','s','e'].includes(e.key.toLowerCase())) {
      e.preventDefault(); e.stopPropagation(); return
    }
    if (e.key === 'F12') {
      e.preventDefault(); e.stopPropagation(); return
    }
    // PrintScreen / PrtSc
    if (e.key === 'PrintScreen' || e.key === 'Print') {
      permanentLock('PrintScreen detected')
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    // Some browsers only fire keyup for PrintScreen
    if (e.key === 'PrintScreen' || e.key === 'Print') {
      permanentLock('PrintScreen detected')
    }
  }

  function onVisibilityChange() {
    if (phase === 'viewing' && document.hidden) {
      permanentLock('Tab switched — secret destroyed for safety')
    }
  }

  function permanentLock(reason: string) {
    if (locked) return
    locked = true
    lockReason = reason
    destroySecret()
  }

  // ── DevTools detection ─────────────────────────────────────────────────────

  function startDevtoolsDetection() {
    // Method 1: window size heuristic (DevTools open widens the delta)
    devtoolsTimer = setInterval(() => {
      const widthDelta = window.outerWidth - window.innerWidth
      const heightDelta = window.outerHeight - window.innerHeight
      if (widthDelta > 160 || heightDelta > 160) {
        permanentLock('DevTools detected — secret destroyed for safety')
      }
    }, 1000)

    // Method 2: console getter timing trick
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
    // Run once after mount
    setTimeout(() => {
      checkConsole()
      if (devtoolsOpen && phase === 'viewing') {
        permanentLock('DevTools detected — secret destroyed for safety')
      }
    }, 200)
  }

  // ── Countdown ─────────────────────────────────────────────────────────────

  function startCountdown() {
    countdown = 60
    countdownTimer = setInterval(() => {
      countdown -= 1
      if (countdown <= 0) {
        clearInterval(countdownTimer!)
        destroySecret()
      }
    }, 1000)
  }

  // ── Secret lifecycle ───────────────────────────────────────────────────────

  function destroySecret() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
    if (devtoolsTimer) { clearInterval(devtoolsTimer); devtoolsTimer = null }
    // Overwrite string in memory (best-effort; GC determines actual clearing)
    secretContent = null
    phase = 'destroyed'
    // Remove URL hash so key is gone from URL bar
    history.replaceState(null, '', window.location.pathname)
  }

  async function loadAndReveal() {
    const secretId = extractId()
    const keyB64 = extractKey()

    if (!keyB64) {
      phase = 'missing-key'
      return
    }

    if (!secretId) {
      errorMsg = 'Invalid secret URL'
      phase = 'error'
      return
    }

    try {
      const res = await fetch(`${vaultApiUrl}/secret/${secretId}`)
      if (res.status === 404) {
        errorMsg = 'This secret does not exist or has already been viewed.'
        phase = 'error'
        return
      }
      if (res.status === 410) {
        errorMsg = 'This secret has already been opened and destroyed.'
        phase = 'error'
        return
      }
      if (!res.ok) {
        errorMsg = `Server error (${res.status})`
        phase = 'error'
        return
      }

      const data = await res.json() as { encryptedPayload: string; iv: string }

      // Decrypt in memory — never store result anywhere persistent
      const decrypted = await decryptSecret(
        { ciphertextB64: data.encryptedPayload, ivB64: data.iv },
        keyB64
      )

      secretContent = decrypted
      phase = 'viewing'

      await tick()
      startCountdown()
      startDevtoolsDetection()

      // Wipe key from URL bar immediately after decrypt
      history.replaceState(null, '', window.location.pathname + '#')

    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : 'Failed to decrypt secret'
      phase = 'error'
    }
  }

  // ── Mount ──────────────────────────────────────────────────────────────────

  onMount(async () => {
    // Register privacy guards immediately (even before content loads)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('selectstart', onSelectStart)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('visibilitychange', onVisibilityChange)

    phase = 'confirm'
  })

  onDestroy(() => {
    document.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('selectstart', onSelectStart)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyUp)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (countdownTimer) clearInterval(countdownTimer)
    if (devtoolsTimer) clearInterval(devtoolsTimer)
    secretContent = null
  })

  $: countdownUrgent = countdown <= 10
  $: countdownWarning = countdown <= 30 && countdown > 10
</script>

<div class="vsa-page" class:vsa-page--locked={locked}>

  <!-- ── Loading ─────────────────────────────────────────────────── -->
  {#if phase === 'loading'}
    <div class="vsa-center" in:fade={{ duration: 160 }}>
      <div class="vsa-spinner-lg"></div>
    </div>

  <!-- ── Confirm / Warning screen ───────────────────────────────── -->
  {:else if phase === 'confirm'}
    <div class="vsa-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsa-card">
        <div class="vsa-icon">👁</div>
        <h1 class="vsa-title">View Secret</h1>
        <p class="vsa-desc">
          You are about to view a one-time secret. Once opened, it will be <strong>permanently destroyed</strong> after 60 seconds.
        </p>

        <div class="vsa-warn-grid">
          {#each [
            { icon: '⏱', text: '60s countdown — then gone' },
            { icon: '👁', text: 'View once only' },
            { icon: '⊘', text: 'Copy disabled' },
            { icon: '🔒', text: 'Tab switch locks' },
            { icon: '🛡', text: 'DevTools blocked' },
            { icon: '🗑', text: 'Memory-only' },
          ] as w}
            <div class="vsa-warn-badge">
              <span>{w.icon}</span>
              <span>{w.text}</span>
            </div>
          {/each}
        </div>

        <p class="vsa-warn-note">
          Do not switch tabs or open DevTools — the secret will be immediately destroyed.
        </p>

        <button class="btn-accent vsa-reveal-btn" on:click={loadAndReveal}>
          Reveal Secret
        </button>
      </div>
    </div>

  <!-- ── Viewing ─────────────────────────────────────────────────── -->
  {:else if phase === 'viewing'}
    <div class="vsa-view" in:fade={{ duration: 200 }}>

      <!-- Countdown bar -->
      <div class="vsa-countdown-wrap">
        <div
          class="vsa-countdown-bar"
          class:vsa-countdown-bar--warn={countdownWarning}
          class:vsa-countdown-bar--urgent={countdownUrgent}
          style="width: {(countdown / 60) * 100}%"
        ></div>
      </div>

      <div class="vsa-view-inner">
        <!-- Timer display -->
        <div
          class="vsa-timer"
          class:vsa-timer--warn={countdownWarning}
          class:vsa-timer--urgent={countdownUrgent}
        >
          <span class="vsa-timer-icon">⏱</span>
          <span class="vsa-timer-num">{countdown}s</span>
          <span class="vsa-timer-label">until destroyed</span>
        </div>

        <!-- Secret content -->
        <div class="vsa-content-card">
          <div class="vsa-content-label">Secret content</div>
          <div class="vsa-content" aria-label="Secret content">
            {secretContent}
          </div>
        </div>

        <!-- Protection badges -->
        <div class="vsa-active-guards">
          <span class="vsa-guards-label">Active guards</span>
          <div class="vsa-guards-row">
            {#each ['Tab blur', 'No copy', 'No select', 'Anti-DevTools', 'Memory-only'] as g}
              <span class="vsa-guard-dot">{g}</span>
            {/each}
          </div>
        </div>

        <p class="vsa-caution">
          Copy this now — it cannot be recovered after the timer expires.
        </p>
      </div>
    </div>

  <!-- ── Destroyed ──────────────────────────────────────────────── -->
  {:else if phase === 'destroyed'}
    <div class="vsa-center" in:scale={{ duration: 300, easing: quintOut, start: 0.93 }}>
      <div class="vsa-card vsa-card--destroyed">
        <div class="vsa-icon vsa-icon--red">🗑</div>
        <h1 class="vsa-title">Secret Destroyed</h1>
        {#if lockReason}
          <p class="vsa-desc vsa-desc--red">{lockReason}</p>
        {:else}
          <p class="vsa-desc">The 60-second viewing window has elapsed. This secret has been permanently wiped.</p>
        {/if}
        <a href="/vault" class="btn-ghost vsa-back-btn">← Back to Vault</a>
      </div>
    </div>

  <!-- ── Already opened / not found ─────────────────────────────── -->
  {:else if phase === 'error'}
    <div class="vsa-center" in:scale={{ duration: 280, easing: quintOut, start: 0.95 }}>
      <div class="vsa-card">
        <div class="vsa-icon vsa-icon--red">⚠</div>
        <h1 class="vsa-title">Secret Unavailable</h1>
        <p class="vsa-desc">{errorMsg}</p>
        <a href="/vault" class="btn-ghost vsa-back-btn">← Back to Vault</a>
      </div>
    </div>

  <!-- ── Missing key in hash ────────────────────────────────────── -->
  {:else if phase === 'missing-key'}
    <div class="vsa-center" in:fade={{ duration: 200 }}>
      <div class="vsa-card">
        <div class="vsa-icon">🔑</div>
        <h1 class="vsa-title">Incomplete Link</h1>
        <p class="vsa-desc">
          The decryption key is missing from this URL. Make sure you copied the full link including the <code>#key=…</code> portion.
        </p>
        <p class="vsa-desc vsa-desc--mono">The key is in the URL fragment after the <code>#</code> symbol.</p>
        <a href="/vault" class="btn-ghost vsa-back-btn">← Back to Vault</a>
      </div>
    </div>
  {/if}

</div>

<style>
  /* ── Page shell ─────────────────────────────────────────────────────────── */
  .vsa-page {
    min-height: 100vh;
    background: var(--canvas);
    padding: calc(80px + env(safe-area-inset-top, 0px)) 16px 40px;
    transition: filter 0.3s;
    /* text selection disabled globally on this page */
    user-select: none;
    -webkit-user-select: none;
  }

  .vsa-page--locked {
    filter: blur(12px) grayscale(0.5);
    pointer-events: none;
  }

  /* ── Centered card layout ───────────────────────────────────────────────── */
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
    max-width: 520px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
  }

  .vsa-card--destroyed {
    border-color: var(--red, #ff4444);
    box-shadow: 6px 6px 0 var(--red, #ff4444);
  }

  .vsa-icon {
    font-size: 48px;
    line-height: 1;
  }

  .vsa-icon--red {
    filter: hue-rotate(0deg); /* keep red emoji */
  }

  .vsa-title {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .vsa-desc {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.7;
    margin: 0;
    max-width: 400px;
  }

  .vsa-desc--red {
    color: var(--red, #ff4444);
  }

  .vsa-desc--mono code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--surface-2);
    padding: 1px 5px;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  /* ── Warning grid ───────────────────────────────────────────────────────── */
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
    color: var(--amber, #ffaa00);
    background: rgba(255, 170, 0, 0.08);
    border: 1px solid rgba(255, 170, 0, 0.25);
    border-radius: 5px;
    padding: 3px 9px;
  }

  .vsa-warn-note {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-3);
    background: var(--surface-2);
    border: 1.5px solid var(--border);
    border-radius: 8px;
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

  /* ── Viewing state ──────────────────────────────────────────────────────── */
  .vsa-view {
    max-width: 680px;
    margin: 0 auto;
  }

  /* Countdown progress bar at top */
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

  /* Timer badge */
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

  .vsa-timer-icon { font-size: 16px; }

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

  /* Secret content card */
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
    word-break: break-all;
    /* Prevent screenshot via CSS (cosmetic only — not a real security measure) */
    -webkit-user-select: none;
    user-select: none;
  }

  /* Active guards row */
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
    gap: 5px;
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
    border-radius: 4px;
    padding: 2px 8px;
  }

  .vsa-caution {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
    margin: 0;
  }

  /* ── Back button ─────────────────────────────────────────────────────────── */
  .vsa-back-btn {
    font-size: 13px;
  }

  /* ── Loading spinner ─────────────────────────────────────────────────────── */
  .vsa-spinner-lg {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin-slow 0.8s linear infinite;
  }

  /* ── Keyframes ───────────────────────────────────────────────────────────── */
  @keyframes urgent-pulse {
    from { opacity: 1; }
    to   { opacity: 0.5; }
  }

  @keyframes shake-timer {
    0%  { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
    100%{ transform: translateX(0); }
  }

  /* ── Mobile ──────────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .vsa-card {
      padding: 28px 20px;
      border-radius: 16px;
    }

    .vsa-title { font-size: 22px; }

    .vsa-content {
      font-size: 13px;
      padding: 16px;
    }
  }
</style>
