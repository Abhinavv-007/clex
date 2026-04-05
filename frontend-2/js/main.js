/* ============================================
   CLEX — Main Entry Point
   Global initialization for all pages
   ============================================ */

import { initTheme, toggleTheme } from './theme.js';
import { initNav } from './nav.js';

// ── Initialize on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
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

  // Lazy load animations only when needed
  loadAnimations();
});

async function loadAnimations() {
  try {
    const { initAnimations, initFaqAccordion, initGiantSteps, initRoutingAnimation } = await import('./animations.js');

    initAnimations();

    // Page-specific animations
    const page = document.body.getAttribute('data-page');
    if (page === 'faq') {
      initFaqAccordion();
    }
    if (page === 'how-it-works') {
      initGiantSteps();
      initRoutingAnimation();
    }
  } catch (e) {
    console.warn('GSAP animations not loaded:', e);
  }
}
