<script lang="ts">
  import '../app.css'
  import Background from '$lib/components/ui/Background.svelte'
  import Cursor from '$lib/components/ui/Cursor.svelte'
  import Toast from '$lib/components/ui/Toast.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ReceiveModal from '$lib/components/sharing/ReceiveModal.svelte'
  import { uiStore } from '$stores/ui'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { theme } from '$lib/theme'
  import { pickupToken } from '$transfer/gdrive'

  function getOAuthErrorMessage(code: string): string {
    switch (code) {
      case 'oauth_not_configured':
        return 'Google Drive is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in apps/web/.env, then restart pnpm dev.'
      case 'oauth_denied':
        return 'Google Drive authorization was cancelled.'
      case 'state_mismatch':
        return 'Google Drive auth state check failed. Please try again.'
      case 'no_code':
        return 'Google Drive did not return an authorization code.'
      case 'token_exchange_failed':
        return 'Google Drive token exchange failed. Check your Google OAuth redirect URI and client secret.'
      case 'no_access_token':
        return 'Google Drive did not return an access token.'
      default:
        return 'Google Drive auth failed. Please try again.'
    }
  }

  // After Google OAuth callback, pick up the token from the server-side cookie
  onMount(async () => {
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
  })

  $: isWorkspace = $page.url.pathname.startsWith('/workspace') || $page.url.pathname.startsWith('/receive')
  $: isDark = $theme === 'dark'
</script>

<!-- Background -->
<Background />

<!-- Cursor -->
<Cursor />

<!-- ── Navigation ─────────────────────────────────────────────────────── -->
<header class="site-header fixed top-0 inset-x-0 z-50">
  <div class="nav-inner">
    <!-- Logo -->
    <a href="/" class="nav-brand" aria-label="Clex home">
      <div class="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M12 6L17 9V15L12 18L7 15V9L12 6Z" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>
      <div class="logo-copy">
        <span class="logo-text">clex</span>
        <span class="logo-sub">File motion workspace</span>
      </div>
    </a>

    <!-- Center nav (desktop) -->
    <nav class="nav-links" aria-label="Main navigation">
      <a href="/#features" class="nav-link">Features</a>
      <a href="/#how-it-works" class="nav-link">How it works</a>
      <a href="/workspace" class="nav-link">Workspace</a>
    </nav>

    <!-- Right controls -->
    <div class="nav-actions">
      <!-- Theme toggle -->
      <button
        class="btn-icon theme-toggle"
        on:click={() => theme.toggle()}
        aria-label="Toggle theme"
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {#if isDark}
          <!-- Sun -->
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 1.5v1M7.5 12.5v1M1.5 7.5h-1M14.5 7.5h-1M3.1 3.1l-.7-.7M13.1 3.1l-.7-.7M3.1 11.9l-.7.7M13.1 11.9l-.7.7M7.5 4.5a3 3 0 100 6 3 3 0 000-6z"
              stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        {:else}
          <!-- Moon -->
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M2.9 1.4A6 6 0 0013.5 8.5a6 6 0 01-8.5-8.5 6.1 6.1 0 00-2.1 1.4z"
              stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </button>

      <!-- Receive files button (workspace mode) -->
      {#if isWorkspace}
        <button
          class="btn-ghost text-xs"
          on:click={() => uiStore.openModal('receive')}
        >
          Receive files
        </button>
        <a href="/" class="btn-secondary text-xs">← Home</a>
      {:else}
        <a href="/workspace" class="btn-primary text-xs">
          Open workspace
        </a>
      {/if}
    </div>
  </div>
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
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    max-width: 1320px;
    margin: 12px auto 0;
    padding: 0 18px;
    height: 62px;
    width: calc(100% - 24px);
    border-radius: 22px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(7, 10, 17, 0.58);
    backdrop-filter: blur(24px) saturate(1.25);
    -webkit-backdrop-filter: blur(24px) saturate(1.25);
    box-shadow:
      0 18px 50px rgba(0, 0, 0, 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  :global(:not(.dark)) .nav-inner {
    background: rgba(255, 255, 255, 0.72);
    border-color: rgba(255, 255, 255, 0.44);
    box-shadow:
      0 18px 48px rgba(10, 22, 45, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
  }

  .site-header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(5, 7, 13, 0.42), transparent 88%);
    pointer-events: none;
  }

  .nav-inner { position: relative; }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    min-width: 0;
  }

  .logo-mark {
    width: 36px;
    height: 36px;
    border-radius: 14px;
    background: linear-gradient(135deg, #bff3ff 0%, #24bcff 100%);
    color: #04131d;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16px 32px rgba(33, 187, 255, 0.22);
    transition: transform 180ms var(--ease-out), box-shadow 180ms ease;
  }

  .nav-brand:hover .logo-mark {
    transform: translateY(-1px);
    box-shadow: 0 18px 36px rgba(33, 187, 255, 0.3);
  }

  .logo-copy {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .logo-text {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .logo-sub {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.2;
    white-space: nowrap;
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
  }

  :global(:not(.dark)) .nav-links {
    border-color: rgba(12, 19, 34, 0.08);
    background: rgba(12, 19, 34, 0.03);
  }

  @media (max-width: 760px) {
    .nav-links { display: none; }
  }

  .nav-link {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-2);
    padding: 10px 14px;
    border-radius: 999px;
    text-decoration: none;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease;
    border: 1px solid transparent;
  }

  .nav-link:hover {
    color: var(--text-1);
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(53, 212, 255, 0.14);
  }

  :global(:not(.dark)) .nav-link:hover {
    background: rgba(255, 255, 255, 0.68);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .theme-toggle {
    width: 38px;
    height: 38px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 760px) {
    .nav-inner {
      margin-top: 10px;
      padding: 0 12px;
      width: calc(100% - 16px);
    }

    .logo-sub {
      display: none;
    }
  }
</style>
