/* ==========================================================================
   Clex — the pen

   Writes every handwritten word on the site, the way Apple writes "hello".
   The markup from scripts/handwriting.mjs is the word in Norican, a joined script, with
   the pen's path as a mask; the pen (frontend-core/hand/pen.js) draws that
   path on in one smooth pass when the word comes into view, and then the
   word just stays.

   Without JS, or with reduced motion, the finished word is simply there.
   ========================================================================== */

import { writeInk, unwriteInk } from '@clex/frontend-core/hand/pen';
import { reducedMotion } from './motion.js';

export function initInk(root = document) {
  const words = [...root.querySelectorAll('.ink-word')];
  if (!words.length) return;

  if (reducedMotion() || !('IntersectionObserver' in window)) {
    words.forEach((w) => w.querySelector('.ink')?.classList.add('is-written'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      schedule(/** @type {HTMLElement} */ (entry.target));
    }
  }, { threshold: 0.6, rootMargin: '0px 0px -8% 0px' });

  for (const word of words) {
    const mode = word.getAttribute('data-write');
    if (mode === 'now') schedule(/** @type {HTMLElement} */ (word));
    else if (mode !== 'manual') io.observe(word);
  }
}

/** @param {HTMLElement} word */
function schedule(word) {
  const delay = Number(word.dataset.delay || 0);
  window.setTimeout(() => writeWord(word), delay);
}

/**
 * Writes the word inside this element now.
 * @param {Element} word
 * @param {{ speed?: number }} [opts] speed > 1 writes faster
 */
export function writeWord(word, opts = {}) {
  const svg = word.querySelector('svg.ink');
  if (svg instanceof SVGSVGElement) writeInk(svg, opts);
}

/** Clears a written word so it can be written again. @param {Element} word */
export function unwriteWord(word) {
  const svg = word.querySelector('svg.ink');
  if (svg instanceof SVGSVGElement) unwriteInk(svg);
}
