/* ==========================================================================
   Routes: each diagram draws itself once, the first time it is seen, and
   then its handwritten notes are written in.
   ========================================================================== */

import { reducedMotion } from './util.js';
import { writeWord } from '../ink.js';

/** @param {HTMLElement} root */
export function initRoutes(root) {
  const cards = [...root.querySelectorAll('.route')];
  const finish = (card) => {
    card.classList.add('is-drawn');
    card.querySelectorAll('.route__note .ink-word').forEach((word, i) => {
      window.setTimeout(() => writeWord(word), reducedMotion() ? 0 : 1100 + i * 900);
    });
  };
  if (reducedMotion()) {
    cards.forEach(finish);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      finish(/** @type {HTMLElement} */ (entry.target));
    }
  }, { threshold: 0.45 });
  cards.forEach((c) => io.observe(c));
}
