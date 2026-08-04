/* ============================================
   CLEX — Main Entry Point
   Global initialization for all pages
   ============================================ */

import '@clex/frontend-core/styles.css';
import { clearPendingDriveReturnTo, getPendingDriveReturnTo, markDriveAuthCallbackSeen } from '@clex/frontend-core';

import { initTheme, toggleTheme } from './theme.js';
import { initNav } from './nav.js';
import { initIslands } from './islands.js';
import { initSectionTheme } from './section-theme.js';
import { initHeroEffects } from './hero-effects.js';
import { initSiteEnhance } from './site-enhance.js';
import { initImmersive } from './immersive.js';
import { initCinematic } from './cinematic.js';

// ── Initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', async () => {
  // Prevent first-paint transition flicker.
  document.body.classList.add('preload');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.body.classList.remove('preload'));
  });

  // Theme
  initTheme();

  // Inject site-wide scaffolding (scroll progress) before nav reads anything.
  injectGlobalScaffolding();
  normalizeSharedFooter();
  normalizeHeadingPunctuation();
  initSiteEnhance();

  // Theme toggle button
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', (e) => toggleTheme(e));
  }

  // Navigation
  const activePage = document.body.getAttribute('data-page') || '';
  initNav(activePage);

  await handleGoogleDriveOAuthCallback();
  await initIslands();
  await initPageEnhancements(activePage);

  // Section-driven theme morph + hero interactive effects
  initSectionTheme();
  initHeroEffects();
  initImmersive();
  initCinematic();

  // Lazy load animations only when needed
  loadAnimations();
});

/**
 * Inject site-wide markup that should appear on every page.
 * - (Scroll progress strip removed by request.)
 * Idempotent: skips when an element already exists.
 */
function injectGlobalScaffolding() {
  // Strip any pre-existing scroll-progress markup so it never renders.
  document.querySelectorAll('#scroll-progress, .clex-scroll-progress').forEach((el) => el.remove());
}

function normalizeSharedFooter() {
  const footer = document.querySelector('footer');
  if (!footer) return;
  if (footer.classList.contains('footer--v2')) return;
  footer.outerHTML = getSharedFooterHTML();
}

function normalizeHeadingPunctuation() {
  // Pass 1: walk text in major typography blocks, strip a trailing period
  // (we still allow punctuation that isn't a period like "?", "!", "+").
  const selectors = [
    'h1', 'h2', 'h3',
    '.page-hero__title',
    '.page-hero__eyebrow',
    '.section__title',
    '.section__title--mixed',
    '.cta-strip__title',
    '.cta-final h2',
    '.dpc-title',
    '.banner__text',
    '.banner--statement',
    '.footer__tagline',
    '.footer__glyph',
    '.bento__title',
    '.card__title',
    '.giant-step__title',
  ];
  document.querySelectorAll(selectors.join(',')).forEach((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.textContent) {
        node.textContent = node.textContent.replace(/([A-Za-z\)\+])\.(\s*)$/g, '$1$2');
      }
      node = walker.nextNode();
    }
  });

  // Pass 2: scrub italic-accents + their cursive friends. They are inline
  // ends-of-headings, so the trailing period almost always reads wrong.
  document.querySelectorAll('.italic-accent, .hero__title-word--italic, .text-accent, .chain-hero__title-accent')
    .forEach((el) => {
      // Whole-element textContent strip (handles cases where . is the last
      // glyph in the run regardless of whitespace/entities).
      const t = (el.textContent || '').replace(/\.\s*$/g, '').trim();
      if (t && t !== el.textContent) {
        el.textContent = t;
      }
    });
}

function getSharedFooterHTML() {
  return `
  <footer class="footer footer--v2">
    <div class="container footer__container">
      <div class="footer__hero">
        <a href="/" class="footer__wordmark" aria-label="Clex home">Clex</a>
        <p class="footer__tagline">
          Send files <em class="italic-accent">stay private</em>
        </p>
      </div>

      <div class="footer__cols">
        <div class="footer__col">
          <h4 class="footer__col-title">Product</h4>
          <a href="/features" class="footer__link">Features</a>
          <a href="/vault" class="footer__link">Vault</a>
          <a href="/how-it-works" class="footer__link">How It Works</a>
          <a href="/workspace" class="footer__link">Workspace</a>
          <a href="/chain" class="footer__link">Chain</a>
        </div>
        <div class="footer__col">
          <h4 class="footer__col-title">Resources</h4>
          <a href="/getting-started" class="footer__link">Getting Started</a>
          <a href="/developers" class="footer__link">Developers</a>
          <a href="/faq" class="footer__link">FAQ</a>
          <a href="mailto:hello@clex.in" class="footer__link">Contact</a>
        </div>
        <div class="footer__col">
          <h4 class="footer__col-title">Legal</h4>
          <a href="/privacy" class="footer__link">Privacy Policy</a>
          <a href="/terms" class="footer__link">Terms of Service</a>
        </div>
        <div class="footer__col footer__col--meta">
          <h4 class="footer__col-title">Built by</h4>
          <a href="https://abhnv.in" target="_blank" rel="noopener noreferrer" class="footer__author">
            <span class="footer__author-avatar">A</span>
            <span class="footer__author-text">
              <span class="footer__author-name">Abhinav</span>
              <span class="footer__author-meta">abhnv.in</span>
            </span>
          </a>
          <div class="footer__socials">
            <a class="footer__social" href="https://www.linkedin.com/in/abhnv8/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.27 2.38 4.27 5.47v6.27ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"/></svg>
            </a>
            <a class="footer__social" href="https://x.com/Abhnv8" target="_blank" rel="noopener noreferrer" aria-label="X">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a class="footer__social" href="https://github.com/Abhinavv-007/clex" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.18c0 .31.21.66.79.55 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"/></svg>
            </a>
            <a class="footer__social" href="mailto:abhnv@abhnv.in" aria-label="Email">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.5 6.75A2.25 2.25 0 0 1 5.75 4.5h12.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25H5.75a2.25 2.25 0 0 1-2.25-2.25V6.75Z"/><path d="m4.25 7.5 6.75 4.9a1.75 1.75 0 0 0 2 0L19.75 7.5" stroke-linecap="round"/></svg>
            </a>
          </div>
        </div>
      </div>

      <div class="footer__glyph" aria-hidden="true">
        SEND FAST <em class="italic-accent">stay&nbsp;private</em>
      </div>

      <div class="footer__bottom">
        <span class="footer__copyright">© 2026 Clex · Privacy-first</span>
        <div class="footer__legal">
          <a href="/privacy" class="footer__legal-link">Privacy</a>
          <a href="/terms" class="footer__legal-link">Terms</a>
          <a href="https://github.com/Abhinavv-007/clex" target="_blank" rel="noopener noreferrer" class="footer__legal-link">Open Source</a>
        </div>
      </div>
    </div>
  </footer>
  `;
}

async function handleGoogleDriveOAuthCallback() {
  const url = new URL(window.location.href);
  const connected = url.searchParams.get('gdrive') === 'connected';
  const errorCode = url.searchParams.get('error');

  if (!connected && !errorCode) return;

  markDriveAuthCallbackSeen();

  if (errorCode) {
    try {
      sessionStorage.setItem('clex_gdrive_callback_error', errorCode);
    } catch {
      // ignore sessionStorage failures
    }
    console.warn(`Google Drive OAuth failed: ${errorCode}`);
  }

  url.searchParams.delete('gdrive');
  url.searchParams.delete('error');
  const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;

  const returnTo = getPendingDriveReturnTo();
  if (returnTo) {
    clearPendingDriveReturnTo();
    try {
      const targetUrl = new URL(returnTo, window.location.origin);
      targetUrl.searchParams.delete('gdrive');
      targetUrl.searchParams.delete('error');
      const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      if (targetPath !== cleanedUrl) {
        window.location.replace(targetPath);
        return;
      }
    } catch {
      // fall through to local URL cleanup
    }
  }

  window.history.replaceState({}, '', cleanedUrl);
}

/** @param {string} page */
async function initPageEnhancements(page) {
  if (page !== 'developers') return;

  try {
    const { initDeveloperAccess } = await import('./developer-access.js');
    await initDeveloperAccess();
  } catch (e) {
    console.warn('Developer access controls not loaded:', e);
  }
}

async function loadAnimations() {
  try {
    const { initAnimations, initFaqAccordion, initGiantSteps, initRoutingAnimation } = await import('./animations.js');

    initAnimations();

    // Page-specific animations
    const page = document.body.getAttribute('data-page');

    // Always initialize routing animation if the elements are present (e.g. index and how-it-works)
    initRoutingAnimation();

    if (page === 'faq') {
      initFaqAccordion();
    }
    if (page === 'how-it-works') {
      initGiantSteps();
    }
  } catch (e) {
    console.warn('GSAP animations not loaded:', e);
  }
}
