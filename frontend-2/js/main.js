/* ============================================
   CLEX — Main Entry Point
   Global initialization for all pages
   ============================================ */

import '@clex/frontend-core/styles.css';
import { pickupToken } from '@clex/frontend-core';

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
    themeToggle.addEventListener('click', toggleTheme);
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

  let shouldCleanUrl = Boolean(errorCode);

  if (connected) {
    try {
      const token = await pickupToken();
      if (token) {
        shouldCleanUrl = true;
      } else {
        console.warn('Google Drive OAuth callback completed, but no token was picked up.');
      }
    } catch (error) {
      console.warn('Google Drive OAuth callback restore failed:', error);
      shouldCleanUrl = true;
    }
  } else if (errorCode) {
    try {
      sessionStorage.setItem('clex_gdrive_callback_error', errorCode);
    } catch {
      // ignore sessionStorage failures
    }
    console.warn(`Google Drive OAuth failed: ${errorCode}`);
  }

  if (!shouldCleanUrl) return;

  url.searchParams.delete('gdrive');
  url.searchParams.delete('error');
  const cleanedUrl = `${url.pathname}${url.search}${url.hash}`;
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
