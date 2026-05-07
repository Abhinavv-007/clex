/* ============================================
   CLEX — Main Entry Point
   Global initialization for all pages
   ============================================ */

import '@clex/frontend-core/styles.css';
import { clearPendingDriveReturnTo, getPendingDriveReturnTo, markDriveAuthCallbackSeen } from '@clex/frontend-core';

import { initTheme, toggleTheme } from './theme.js';
import { initNav } from './nav.js';
import { initIslands } from './islands.js';

// ── Initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', async () => {
  // Theme
  initTheme();

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

  // Lazy load animations only when needed
  loadAnimations();
});

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
