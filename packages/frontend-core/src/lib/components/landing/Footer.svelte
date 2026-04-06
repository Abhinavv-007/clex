<script lang="ts">
  import { onMount } from 'svelte'
  import { siteRoutes as defaultSiteRoutes, type SiteRoutes } from '$utils'

  export let routes: SiteRoutes = defaultSiteRoutes

  const year = new Date().getFullYear()
  $: navGroups = [
    {
      label: 'Product',
      links: [
        { href: routes.workspace, label: 'Workspace' },
        { href: routes.features, label: 'Features' },
        { href: routes.howItWorks, label: 'How it works' },
        { href: routes.gettingStarted, label: 'Getting started' },
      ],
    },
    {
      label: 'Transfer',
      links: [
        { href: routes.howItWorks, label: 'Direct P2P' },
        { href: routes.howItWorks, label: 'Local network' },
        { href: routes.howItWorks, label: 'Google Drive' },
        { href: routes.receive, label: 'Receive files' },
      ],
    },
    {
      label: 'Tools',
      links: [
        { href: routes.features, label: 'Image compression' },
        { href: routes.features, label: 'PDF operations' },
        { href: routes.features, label: 'DOCX → PDF' },
        { href: routes.features, label: 'ZIP bundling' },
      ],
    },
    {
      label: 'Legal & Help',
      links: [
        { href: routes.faq, label: 'FAQ' },
        { href: routes.privacy, label: 'Privacy policy' },
        { href: routes.terms, label: 'Terms of service' },
        { href: routes.gettingStarted, label: 'Help & guide' },
      ],
    },
  ]

  let visible = false
  let footerEl: HTMLElement

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.08 }
    )
    if (footerEl) obs.observe(footerEl)
    return () => obs.disconnect()
  })
</script>

<footer class="footer" bind:this={footerEl}>
  <div class="footer-inner">

    <!-- Brand column -->
    <div class="footer-brand reveal" class:is-visible={visible}>
      <a href={routes.home} class="brand-logo">
        <span class="brand-mark" aria-hidden="true">
          <img src="/brand/clex-logo.png" alt="" class="brand-mark-image" />
        </span>
        <span class="brand-name">clex</span>
      </a>

      <p class="brand-tagline">
        Prepare files and share them from one place —
        direct P2P, local network, or Google Drive.
      </p>

      <div class="brand-badges">
        <span class="footer-badge">
          <span class="badge-dot" style="background: var(--green)" />
          Privacy-first
        </span>
        <span class="footer-badge">
          <span class="badge-dot" style="background: var(--accent)" />
          No accounts
        </span>
      </div>
    </div>

    <!-- Nav groups -->
    {#each navGroups as group, i}
      <div class="footer-nav-group reveal reveal-{i + 2}" class:is-visible={visible}>
        <h3 class="nav-group-label">{group.label}</h3>
        <nav>
          {#each group.links as link}
            <a href={link.href} class="footer-nav-link">{link.label}</a>
          {/each}
        </nav>
      </div>
    {/each}

  </div>

  <!-- Bottom bar -->
  <div class="footer-bottom reveal reveal-5" class:is-visible={visible}>
    <div class="bottom-inner">
      <div class="bottom-left">
        <span class="font-mono text-2xs text-text-3">© {year} Clex. All rights reserved.</span>
        <span class="bottom-sep">·</span>
        <span class="font-mono text-2xs text-text-3">Built for the open web.</span>
      </div>
      <div class="bottom-right">
        <a href={routes.privacy} class="bottom-link">Privacy</a>
        <a href={routes.terms} class="bottom-link">Terms</a>
        <a href={routes.faq} class="bottom-link">FAQ</a>
      </div>
    </div>
  </div>
</footer>

<style>
  .footer {
    border-top: 2px solid var(--border-hard);
    background: var(--surface);
  }

  .footer-inner {
    display: grid;
    grid-template-columns: 1.6fr repeat(4, 1fr);
    gap: 40px;
    max-width: 1280px;
    margin: 0 auto;
    padding: 56px 24px 48px;
  }

  @media (max-width: 1100px) {
    .footer-inner {
      grid-template-columns: 1fr 1fr;
      gap: 40px 32px;
    }
  }

  @media (max-width: 640px) {
    .footer-inner {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }

  /* ── BRAND ───────────────────────────────────────── */
  .footer-brand {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    width: fit-content;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .brand-mark-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text-1);
    line-height: 1;
  }

  .brand-tagline {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-2);
    max-width: 28ch;
  }

  .brand-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .footer-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 12px;
    border-radius: 7px;
    border: 1.5px solid var(--border-hard);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--border-hard);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-2);
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ── NAV GROUPS ──────────────────────────────────── */
  .footer-nav-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .nav-group-label {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .footer-nav-link {
    font-size: 14px;
    color: var(--text-2);
    text-decoration: none;
    padding: 4px 0;
    transition: color 150ms ease, transform 150ms ease;
    display: inline-block;
  }

  .footer-nav-link:hover {
    color: var(--text-1);
    transform: translateX(4px);
  }

  /* ── BOTTOM BAR ──────────────────────────────────── */
  .footer-bottom {
    border-top: 2px solid var(--border);
    padding: 20px 24px;
  }

  .bottom-inner {
    max-width: 1280px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .bottom-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .bottom-sep { color: var(--border-strong); }

  .bottom-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .bottom-link {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    text-decoration: none;
    transition: color 150ms ease;
  }

  .bottom-link:hover { color: var(--text-1); }
</style>
