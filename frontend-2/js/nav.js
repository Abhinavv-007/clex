/* ============================================
   CLEX — Navigation Component
   Injects nav into all pages
   ============================================ */

export function initNav(activePage = '') {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  // Scroll behavior
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    if (currentScroll > 60) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });

  // Mobile menu
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('nav-mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('nav__hamburger--open');
      mobileMenu.classList.toggle('nav__mobile-menu--open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    mobileMenu.querySelectorAll('.nav__mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('nav__hamburger--open');
        mobileMenu.classList.remove('nav__mobile-menu--open');
        document.body.style.overflow = '';
      });
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
      <a href="/" class="nav__logo">
        clex<span class="nav__logo-dot"></span>
      </a>

      <div class="nav__links">
        <a href="/features.html" class="nav__link" data-page="features">Features</a>
        <a href="/how-it-works.html" class="nav__link" data-page="how-it-works">How It Works</a>
        <a href="/getting-started.html" class="nav__link" data-page="getting-started">Get Started</a>
        <a href="/faq.html" class="nav__link" data-page="faq">FAQ</a>
      </div>

      <div class="nav__actions">
        <button class="nav__theme-toggle" id="theme-toggle" aria-label="Toggle theme">☀</button>
        <a href="/workspace.html" class="btn btn--primary btn--small">Open Workspace →</a>
      </div>

      <button class="nav__hamburger" id="nav-hamburger" aria-label="Toggle menu">
        <span class="nav__hamburger-line"></span>
        <span class="nav__hamburger-line"></span>
        <span class="nav__hamburger-line"></span>
      </button>
    </div>
  </nav>

  <div class="nav__mobile-menu" id="nav-mobile-menu">
    <a href="/" class="nav__mobile-link">Home</a>
    <a href="/features.html" class="nav__mobile-link">Features</a>
    <a href="/how-it-works.html" class="nav__mobile-link">How It Works</a>
    <a href="/getting-started.html" class="nav__mobile-link">Get Started</a>
    <a href="/faq.html" class="nav__mobile-link">FAQ</a>
    <a href="/workspace.html" class="nav__mobile-link" style="color: var(--accent);">Open Workspace →</a>
  </div>
  `;
}
