<script lang="ts">
  import { onMount } from 'svelte'

  const year = new Date().getFullYear()
  let footerEl: HTMLElement
  let visible = false

  onMount(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { visible = true; obs.disconnect() } },
      { threshold: 0.2 }
    )
    obs.observe(footerEl)
  })
</script>

<footer class="footer" bind:this={footerEl}>
  <div class="footer-inner" class:footer-visible={visible}>
    <!-- Logo block -->
    <div class="footer-brand">
      <div class="footer-logo">
        <div class="footer-logo-mark">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
            <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M12 6L17 9V15L12 18L7 15V9L12 6Z" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <span class="footer-logo-text">clex</span>
      </div>
      <p class="footer-tagline">Smart file workspace.<br/>No storage. No friction.</p>
    </div>

    <!-- Nav links -->
    <nav class="footer-nav" aria-label="Footer navigation">
      <a href="/workspace" class="footer-link">Workspace</a>
      <a href="/#features" class="footer-link">Features</a>
      <a href="/#how-it-works" class="footer-link">How it works</a>
    </nav>

    <!-- Right: meta -->
    <div class="footer-meta">
      <span class="footer-badge">
        <span class="badge-dot" />
        Privacy-first
      </span>
      <span class="footer-copy">© {year} Clex</span>
    </div>
  </div>
</footer>

<style>
  .footer {
    border-top: 1px solid var(--border);
    padding: 48px 24px;
  }

  .footer-inner {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1);
  }

  .footer-inner.footer-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Brand */
  .footer-brand {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .footer-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
  }

  .footer-logo-mark {
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: var(--text-1);
    color: var(--text-inv);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.2s;
  }

  .footer-logo-mark:hover { opacity: 0.8; }

  .footer-logo-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.02em;
  }

  .footer-tagline {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.5;
  }

  /* Nav */
  .footer-nav {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .footer-link {
    font-size: 13px;
    color: var(--text-3);
    text-decoration: none;
    transition: color 0.2s;
    position: relative;
  }

  .footer-link::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 1px;
    background: var(--text-1);
    transition: width 0.25s ease;
  }

  .footer-link:hover {
    color: var(--text-1);
  }

  .footer-link:hover::after {
    width: 100%;
  }

  /* Meta */
  .footer-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .footer-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 100px;
    background: var(--raised);
    border: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-3);
    font-weight: 500;
  }

  .badge-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 6px rgba(16,185,129,0.4);
  }

  .footer-copy {
    font-size: 12px;
    color: var(--text-3);
  }

  @media (max-width: 640px) {
    .footer-inner {
      flex-direction: column;
      align-items: flex-start;
    }
    .footer-meta { align-items: flex-start; }
    .footer-nav { flex-wrap: wrap; gap: 16px; }
  }
</style>
