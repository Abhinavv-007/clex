<script lang="ts">
  const year = new Date().getFullYear()
</script>

<footer class="footer">
  <div class="footer-inner">
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
    padding: 40px 24px;
  }

  .footer-inner {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
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
  }

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
    transition: color 0.15s;
  }

  .footer-link:hover { color: var(--text-1); }

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
    padding: 3px 10px;
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
    background: #22c55e;
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
