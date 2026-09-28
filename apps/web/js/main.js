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
  if (document.querySelector('canvas[data-field]')) {
    import('./field.js').then((m) => m.initFields());
  }
  if (document.querySelector('canvas[data-stream]')) {
    // The WebGL stream; where WebGL is missing, the 2D circuit field instead.
    import('./stream.js').then(async (m) => {
      if (m.initStream()) return;
      const canvas = document.querySelector('canvas[data-stream]');
      canvas?.setAttribute('data-field', 'hero');
      canvas?.classList.add('is-live');
      (await import('./field.js')).initFields();
    });
  }
  if (page === 'home') {
    import('./hero.js').then((m) => m.initHero());
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
