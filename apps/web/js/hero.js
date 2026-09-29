/* ==========================================================================
   Clex — landing hero extras. The headline's handwriting is js/ink.js; the
   particle stream behind it is js/stream.js and the chunk
   manifest around it js/manifest.js. This is the workspace's rise.
   ========================================================================== */

import { reducedMotion } from './motion.js';

export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  initWorkspaceRise();
}

/**
 * The workspace frame starts slightly tilted back and small, and settles
 * flat as it scrolls into view — the app rising up to meet you.
 */
function initWorkspaceRise() {
  const frame = document.querySelector('[data-rise]');
  if (!(frame instanceof HTMLElement) || reducedMotion()) return;

  let ticking = false;
  const settle = () => {
    frame.style.setProperty('--rise', '1');
    frame.classList.add('is-settled');
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
  const update = () => {
    ticking = false;
    const box = frame.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the frame's top is at the bottom of the viewport, 1 once it has
    // travelled 65% of the viewport height. It rises once and then stays
    // flat: a transform on the frame would re-anchor any position: fixed
    // element inside the app (modals, toasts) to the frame.
    const p = Math.min(1, Math.max(0, (vh - box.top) / (vh * 0.65)));
    if (p >= 1 || box.top < 0) {
      settle();
      return;
    }
    const e = 1 - Math.pow(1 - p, 3);
    frame.style.setProperty('--rise', e.toFixed(4));
  };
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // Anyone who interacts with the app gets it flat immediately.
  frame.addEventListener('pointerdown', settle, { once: true });
  frame.addEventListener('focusin', settle, { once: true });
  update();
}
