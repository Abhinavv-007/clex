<script lang="ts">
  import '../app.css'
  import Background from '$lib/components/ui/Background.svelte'
  import Toast from '$lib/components/ui/Toast.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ReceiveModal from '$lib/components/sharing/ReceiveModal.svelte'
  import { uiStore } from '$stores/ui'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { theme } from '$lib/theme'
  import { pickupToken } from '$transfer/gdrive'

  let mobileMenuOpen = false
  let scrolled = false

  function isLocalSetupHost(hostname: string): boolean {
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    )
  }

  function getOAuthErrorMessage(code: string): string {
    switch (code) {
      case 'oauth_not_configured':
        return isLocalSetupHost(typeof window !== 'undefined' ? window.location.hostname : '')
          ? 'Google Drive not configured. Add GOOGLE_CLIENT_ID etc. in apps/api/.dev.vars or your Worker env.'
          : 'Google Drive not configured on this deployment.'
      case 'oauth_denied': return 'Google Drive authorization was cancelled.'
      case 'state_mismatch': return 'Google Drive auth state check failed. Try again.'
      case 'no_code': return 'Google Drive did not return an authorization code.'
      case 'token_exchange_failed': return 'Google Drive token exchange failed.'
      case 'no_access_token': return 'Google Drive did not return an access token.'
      default: return 'Google Drive auth failed. Please try again.'
    }
  }

  onMount(() => {
    // Handle Google OAuth callback
    async function handleOAuth() {
      const params = new URLSearchParams(window.location.search)
      const connected = params.get('gdrive') === 'connected'
      const errorCode = params.get('error')

      if (connected || errorCode) {
        history.replaceState(null, '', window.location.pathname)
      }

      if (connected) {
        const token = await pickupToken()
        if (token) {
          uiStore.toast({ type: 'success', message: 'Google Drive connected' })
        } else {
          uiStore.toast({ type: 'error', message: 'Google Drive auth failed — try again' })
        }
      } else if (errorCode) {
        uiStore.toast({ type: 'error', message: getOAuthErrorMessage(errorCode) })
      }
    }
    handleOAuth()

    // Scroll detection for nav border
    const handleScroll = () => { scrolled = window.scrollY > 20 }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  })

  $: isWorkspace = $page.url.pathname.startsWith('/workspace') || $page.url.pathname.startsWith('/receive')
  $: isDark = $theme === 'dark'
  $: currentPath = $page.url.pathname

  function isActive(path: string) {
    return currentPath === path || currentPath.startsWith(path + '/')
  }
</script>

<!-- Background dot grid -->
<Background />

<!-- ── NAV ───────────────────────────────────────────────────────── -->
<header class="site-header" class:scrolled>
  <nav class="nav-inner">
    <!-- Logo -->
    <a href="/" class="nav-brand" aria-label="Clex home">
      <div class="logo-mark">
        <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
          <path d="M10 1L18 5.5V14.5L10 19L2 14.5V5.5L10 1Z"
            stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M10 5L15 7.5V12.5L10 15L5 12.5V7.5L10 5Z"
            fill="currentColor" opacity="0.35"/>
        </svg>
      </div>
      <span class="logo-text">clex</span>
    </a>

    <!-- Center nav (desktop) -->
    <div class="nav-links" aria-label="Main navigation">
      <a href="/features"      class="nav-link" class:active={isActive('/features')}>Features</a>
      <a href="/how-it-works"  class="nav-link" class:active={isActive('/how-it-works')}>How it works</a>
      <a href="/getting-started" class="nav-link" class:active={isActive('/getting-started')}>Get started</a>
      <a href="/faq"           class="nav-link" class:active={isActive('/faq')}>FAQ</a>
    </div>

    <!-- Right -->
    <div class="nav-actions">
      <!-- Theme toggle -->
      <button
        class="btn-icon theme-btn"
        on:click={() => theme.toggle()}
        aria-label="Toggle theme"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {#if isDark}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 2.3A6.5 6.5 0 1013.7 10 5 5 0 016 2.3z"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </button>

      {#if isWorkspace}
        <button class="btn-ghost nav-action-btn" on:click={() => uiStore.openModal('receive')}>
          Receive
        </button>
        <a href="/" class="btn-secondary nav-action-btn">← Home</a>
      {:else}
        <a href="/workspace" class="btn-accent nav-cta">
          Open workspace
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      {/if}

      <!-- Mobile hamburger -->
      <button
        class="mobile-menu-btn"
        on:click={() => mobileMenuOpen = !mobileMenuOpen}
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        <span class="hamburger" class:open={mobileMenuOpen}>
          <span /><span /><span />
        </span>
      </button>
    </div>
  </nav>

  <!-- Mobile menu -->
  {#if mobileMenuOpen}
    <div class="mobile-menu">
      <a href="/features"       class="mobile-link" on:click={() => mobileMenuOpen = false}>Features</a>
      <a href="/how-it-works"   class="mobile-link" on:click={() => mobileMenuOpen = false}>How it works</a>
      <a href="/getting-started" class="mobile-link" on:click={() => mobileMenuOpen = false}>Get started</a>
      <a href="/faq"            class="mobile-link" on:click={() => mobileMenuOpen = false}>FAQ</a>
      <div class="mobile-divider" />
      <a href="/workspace"      class="btn-accent mobile-cta" on:click={() => mobileMenuOpen = false}>
        Open workspace
      </a>
    </div>
  {/if}
</header>

<!-- Page content -->
<main>
  <slot />
</main>

<!-- Toasts -->
<Toast />

<!-- Global modal -->
<Modal>
  {#if $uiStore.modalContent === 'receive'}
    <ReceiveModal />
  {/if}
</Modal>

<style>
  /* ── HEADER ──────────────────────────────────────────── */
  .site-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 12px 20px 0;
    transition: padding 200ms ease;
  }

  .site-header.scrolled {
    padding: 8px 20px 0;
  }

  /* ── NAV INNER ───────────────────────────────────────── */
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    max-width: 1280px;
    margin: 0 auto;
    height: 60px;
    padding: 0 20px;
    border-radius: 14px;
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: var(--shadow-md);
    transition: box-shadow 200ms ease, border-color 200ms ease;
  }

  :global(html:not(.dark)) .nav-inner {
    background: #FFFFFF;
    border-color: #000000;
    box-shadow: 4px 4px 0 #000000;
  }

  /* ── BRAND ───────────────────────────────────────────── */
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
  }

  .logo-mark {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: var(--text-1);
    color: var(--text-inv);
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--border-hard);
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .nav-brand:hover .logo-mark {
    transform: translate(-1px, -1px);
    box-shadow: var(--shadow-md);
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text-1);
    line-height: 1;
  }

  /* ── CENTER NAV ──────────────────────────────────────── */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nav-link {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
    padding: 8px 14px;
    border-radius: 8px;
    border: 1.5px solid transparent;
    text-decoration: none;
    transition: color 150ms ease, background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
    white-space: nowrap;
  }

  .nav-link:hover {
    color: var(--text-1);
    background: var(--raised);
    border-color: var(--border);
  }

  .nav-link.active {
    color: var(--text-1);
    background: var(--surface-2);
    border-color: var(--border-hard);
    box-shadow: 2px 2px 0 var(--border-hard);
  }

  @media (max-width: 900px) {
    .nav-links { display: none; }
  }

  /* ── RIGHT ACTIONS ───────────────────────────────────── */
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .theme-btn {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1.5px solid var(--border);
    color: var(--text-2);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
  }

  .theme-btn:hover {
    color: var(--text-1);
    border-color: var(--border-strong);
    background: var(--raised);
  }

  .nav-action-btn {
    font-size: 13px;
    padding: 9px 16px;
  }

  .nav-cta {
    font-size: 13px;
    padding: 9px 16px;
  }

  /* ── MOBILE MENU BUTTON ─────────────────────────────── */
  .mobile-menu-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1.5px solid var(--border-hard);
    background: transparent;
    cursor: pointer;
    box-shadow: 2px 2px 0 var(--border-hard);
    transition: transform 150ms ease, box-shadow 150ms ease;
  }

  .mobile-menu-btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 var(--border-hard);
  }

  @media (max-width: 900px) {
    .mobile-menu-btn { display: flex; }
  }

  .hamburger {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 18px;
  }

  .hamburger span {
    display: block;
    height: 2px;
    background: var(--text-1);
    border-radius: 1px;
    transition: transform 200ms ease, opacity 200ms ease;
  }

  .hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
  .hamburger.open span:nth-child(2) { opacity: 0; }
  .hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

  /* ── MOBILE DROPDOWN ─────────────────────────────────── */
  .mobile-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 20px;
    right: 20px;
    max-width: 1280px;
    margin: 0 auto;
    background: var(--surface);
    border: 2px solid var(--border-hard);
    box-shadow: 6px 6px 0 var(--border-hard);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: fadeUp 200ms var(--ease-out) both;
  }

  .mobile-link {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);
    padding: 12px 16px;
    border-radius: 10px;
    text-decoration: none;
    transition: background 150ms ease;
  }

  .mobile-link:hover { background: var(--raised); }

  .mobile-divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0;
  }

  .mobile-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    margin-top: 4px;
    text-decoration: none;
    font-size: 15px;
  }

  @media (min-width: 901px) {
    .mobile-menu { display: none; }
  }
</style>
