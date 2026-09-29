/* ==========================================================================
   Clex — entry point, shared by every page
   ========================================================================== */

import '@clex/frontend-core/styles.css';
// Deep imports only: the package barrel re-exports the whole app (qrcode,
// firebase, the transfer stack, IndexedDB), and importing it here would put
// all of that in the entry chunk of every page.

import { initTheme } from './theme.js';
import { initNav, initWorkspaceLinks } from './nav.js';
import { initMotion, initServiceStatus } from './motion.js';
import { initIslands } from './islands.js';
import { initStorageNotice } from './storage-notice.js';
import { initInk } from './ink.js';

const page = document.body.dataset.page || '';

initTheme();

document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initWorkspaceLinks();
  initMotion();
  initInk();
  initServiceStatus();
  initStorageNotice();

  // Decoration loads after the page is interactive and never blocks it.
  // The particle stream runs behind the headline (where WebGL is missing
  // the page head simply goes without it) and the chunk manifest fills the
  // margins around it.
  if (document.querySelector('canvas[data-stream]')) {
    import('./stream.js').then((m) => m.initStream());
  }
  if (document.querySelector('canvas[data-manifest]')) {
    import('./manifest.js').then((m) => m.initManifest());
  }
  if (page === 'home') {
    import('./hero.js').then((m) => m.initHero());
  }
  // The section rail, on the pages people read rather than use.
  if (['home', 'features', 'how-it-works', 'chain', 'developers', 'getting-started', 'faq'].includes(page)) {
    import('./rail.js').then((m) => m.initRail());
  }
  import('./scenes/index.js').then((m) => {
    if (document.querySelector(m.SCENE_SELECTOR)) m.initScenes();
  });

  await initIslands(page);
  await initPage(page);
});

/** @param {string} name */
async function initPage(name) {
  try {
    if (name === 'developers') {
      const { initApiStatus, initApiPlayground } = await import('./api-playground.js');
      void initApiStatus();
      initApiPlayground();
      const { initDeveloperAccess } = await import('./developer-access.js');
      await initDeveloperAccess();
    } else if (name === 'faq') {
      const { initFaq } = await import('./faq.js');
      initFaq();
    } else if (['privacy', 'terms', 'cookies'].includes(name)) {
      const { initLegal } = await import('./legal.js');
      initLegal();
    } else if (name === 'share') {
      const { initShare } = await import('./share.js');
      await initShare();
    }
  } catch (err) {
    console.warn(`Page script for "${name}" did not load:`, err);
  }
}
