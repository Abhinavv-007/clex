import { routes } from './routes.js';

/* ============================================
   CLEX — Navigation Component
   Injects nav into all pages
   ============================================ */

export function initNav(activePage = '') {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  // Scroll behaviour: the bar sits expanded at the top of the page and
  // collapses to a compact pill once you scroll away from it.
  //
  // Separate enter/exit thresholds give us hysteresis — with a single
  // threshold the bar visibly flickers when the scroll position rests
  // right on it (trackpad inertia, rubber-banding, anchor jumps).
  const SHRINK_AT = 72;
  const EXPAND_AT = 24;
  const progressBar = document.querySelector('#scroll-progress .scroll-progress__bar');

  let scrolled = false;
  let frame = 0;

  const applyScrollState = () => {
    frame = 0;
    const y = window.scrollY;

    if (!scrolled && y > SHRINK_AT) {
      scrolled = true;
      nav.classList.add('nav--scrolled');
    } else if (scrolled && y < EXPAND_AT) {
      scrolled = false;
      nav.classList.remove('nav--scrolled');
    }

    if (progressBar instanceof HTMLElement) {
      const doc = document.documentElement;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      const pct = Math.min(100, Math.max(0, (y / max) * 100));
      progressBar.style.width = `${pct}%`;
    }
  };

  // One rAF-coalesced read+write per frame instead of per scroll event.
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(applyScrollState);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // Restored scroll position (reload mid-page, back navigation) must not
  // paint an expanded bar over content.
  applyScrollState();

  // Mobile menu
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('nav__hamburger--open');
      mobileMenu.classList.toggle('nav__mobile-menu--open', isOpen);
      hamburger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    mobileMenu.querySelectorAll('.nav__mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('nav__hamburger--open');
        mobileMenu.classList.remove('nav__mobile-menu--open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      hamburger.classList.remove('nav__hamburger--open');
      mobileMenu.classList.remove('nav__mobile-menu--open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  }

  // Mark active page
  nav.querySelectorAll('.nav__link').forEach(link => {
    if (link.getAttribute('data-page') === activePage) {
      link.classList.add('nav__link--active');
    }
  });
}

export function getNavHTML(activePage = '') {
  return `
  <nav class="nav" id="main-nav">
    <div class="nav__inner">
      <a href="${routes.home}" class="nav__logo" aria-label="Clex home">
        <img src="/brand/clex-logo.png" alt="" class="nav__logo-image">
        <span class="nav__logo-wordmark">Clex</span>
      </a>

      <div class="nav__links">
        <a href="${routes.features}" class="nav__link" data-page="features">Features</a>
        <a href="${routes.vault}" class="nav__link" data-page="vault">Vault</a>
        <a href="${routes.howItWorks}" class="nav__link" data-page="how-it-works">How It Works</a>
        <a href="${routes.chain}" class="nav__link" data-page="chain">Chain</a>
        <a href="${routes.developers}" class="nav__link" data-page="developers">Developers</a>
        <a href="${routes.gettingStarted}" class="nav__link" data-page="getting-started">Get Started</a>
        <a href="${routes.faq}" class="nav__link" data-page="faq">FAQ</a>
      </div>

      <div class="nav__actions">
        <button class="nav__theme-toggle" id="theme-toggle" aria-label="Toggle theme">☀</button>
        <a href="${routes.workspace}" class="btn btn--primary btn--small">Open Workspace →</a>
      </div>

      <button class="nav__hamburger" id="nav-hamburger" aria-label="Toggle menu">
        <span class="nav__hamburger-line"></span>
        <span class="nav__hamburger-line"></span>
        <span class="nav__hamburger-line"></span>
      </button>
    </div>
  </nav>

  <div class="nav__mobile-menu" id="nav-mobile-menu">
    <a href="${routes.home}" class="nav__mobile-link">Home</a>
    <a href="${routes.features}" class="nav__mobile-link">Features</a>
    <a href="${routes.vault}" class="nav__mobile-link">Vault</a>
    <a href="${routes.howItWorks}" class="nav__mobile-link">How It Works</a>
    <a href="${routes.chain}" class="nav__mobile-link">Chain</a>
    <a href="${routes.developers}" class="nav__mobile-link">Developers</a>
    <a href="${routes.gettingStarted}" class="nav__mobile-link">Get Started</a>
    <a href="${routes.faq}" class="nav__mobile-link">FAQ</a>
    <a href="${routes.workspace}" class="nav__mobile-link" style="color: var(--accent-text);">Open Workspace →</a>
  </div>
  `;
}
