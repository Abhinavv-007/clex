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

  // After Google OAuth callback, pick up the token from the server-side cookie
  onMount(async () => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gdrive') === 'connected') {
      // Remove the query param from URL immediately
      history.replaceState(null, '', window.location.pathname)
      const token = await pickupToken()
      if (token) {
        uiStore.toast({ type: 'success', message: 'Google Drive connected' })
      } else {
        uiStore.toast({ type: 'error', message: 'Google Drive auth failed — try again' })
      }
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
<header class="fixed top-0 inset-x-0 z-50">
  <div class="nav-inner">
    <!-- Logo -->
    <a href="/" class="flex items-center gap-2 group" aria-label="Clex home">
      <div class="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
          <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M12 6L17 9V15L12 18L7 15V9L12 6Z" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>
      <span class="logo-text">clex</span>
    </a>

    <!-- Center nav (desktop) -->
    <nav class="nav-links" aria-label="Main navigation">
      <a href="/#features" class="nav-link">Features</a>
      <a href="/#how-it-works" class="nav-link">How it works</a>
      <a href="/workspace" class="nav-link">Workspace</a>
    </nav>

    <!-- Right controls -->
    <div class="flex items-center gap-2">
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
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 56px;
    /* Glass blur strip */
    background: var(--overlay);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }

  /* Full-width blur bg behind nav */
  header::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--overlay);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    pointer-events: none;
  }

  .nav-inner { position: relative; }

  .logo-mark {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--text-1);
    color: var(--text-inv);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.15s;
  }

  .logo-mark:hover { opacity: 0.8; }

  .logo-text {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-1);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  @media (max-width: 640px) {
    .nav-links { display: none; }
  }

  .nav-link {
    font-size: 13px;
    font-weight: 450;
    color: var(--text-2);
    padding: 5px 10px;
    border-radius: 7px;
    text-decoration: none;
    transition: color 0.15s, background 0.15s;
  }

  .nav-link:hover {
    color: var(--text-1);
    background: var(--raised);
  }

  .theme-toggle {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
