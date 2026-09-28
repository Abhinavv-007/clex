/* ==========================================================================
   Clex — the pen

   Writes every handwritten word on the site. The markup from
   scripts/handwriting.mjs is the word's pen strokes in writing order; this
   draws them one after another at an even hand's pace, lifting briefly
   between strokes, the way the word would actually be written. No cursor,
   no nib, no underline: only ink.

   Without JS, or with reduced motion, the finished word is simply there.
   ========================================================================== */

import { reducedMotion } from './motion.js';

/** Pause between strokes, as a share of the word's total ink. */
const LIFT = 0.025;

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
  }, { threshold: 0.5, rootMargin: '0px 0px -6% 0px' });

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
  if (svg instanceof SVGSVGElement) write(svg, opts.speed ?? 1);
}

/** Clears a written word so it can be written again. @param {Element} word */
export function unwriteWord(word) {
  const svg = word.querySelector('svg.ink');
  if (!(svg instanceof SVGSVGElement)) return;
  svg.classList.remove('is-writing', 'is-written');
  svg.querySelectorAll('.ink__pen path').forEach((p) => {
    if (p instanceof SVGElement) {
      p.style.opacity = '';
      p.style.strokeDasharray = '';
    }
  });
}

/** @param {SVGSVGElement} svg @param {number} speed */
function write(svg, speed) {
  if (svg.classList.contains('is-writing') || svg.classList.contains('is-written')) return;
  if (reducedMotion()) {
    svg.classList.add('is-written');
    return;
  }

  const paths = /** @type {SVGPathElement[]} */ ([...svg.querySelectorAll('.ink__pen path')]);
  if (!paths.length) {
    svg.classList.add('is-written');
    return;
  }
  const lens = paths.map((p) => Math.max(1, Number(p.dataset.l) || 1));
  const ink = lens.reduce((a, b) => a + b, 0);
  const lift = ink * LIFT;
  const starts = [];
  let cursor = 0;
  lens.forEach((l, i) => {
    starts.push(cursor);
    cursor += l + (i < lens.length - 1 ? lift : 0);
  });
  const total = cursor;

  // Pace: an unhurried hand, about the same speed for every word.
  const letters = (svg.closest('.ink-word')?.querySelector('.visually-hidden')?.textContent || '').replace(/\s/g, '').length || 6;
  const dur = Math.min(3400, Math.max(900, letters * 125 + 380)) / speed;

  const drawn = new Float32Array(paths.length).fill(-1);
  svg.classList.add('is-writing');
  const t0 = performance.now();

  const frame = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const pos = total * ease(p);
    for (let i = 0; i < paths.length; i += 1) {
      const f = Math.min(1, Math.max(0, (pos - starts[i]) / lens[i]));
      if (f === drawn[i]) continue;
      drawn[i] = f;
      const el = paths[i];
      el.style.opacity = f > 0 ? '1' : '0';
      el.style.strokeDasharray = `${f.toFixed(4)} 2`;
    }
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      svg.classList.remove('is-writing');
      svg.classList.add('is-written');
      paths.forEach((el) => { el.style.opacity = ''; el.style.strokeDasharray = ''; });
    }
  };
  requestAnimationFrame(frame);
}

/** Gentle in and out, nearly even speed through the middle. */
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) * 0.35 + t * 0.65;
