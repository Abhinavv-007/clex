/* ==========================================================================
   Clex — the pen

   Writes every handwritten word on the site in one continuous stroke: the
   ink flows in from left to right behind a crisp edge, a glowing nib rides
   that edge up and down along the letters, and a thin trail is drawn under
   the word as it goes and fades once the word is finished. The hero's word
   is signed off with a swash instead.

   Same hand, same pace, same ink on every page and in both themes. The
   markup comes from scripts/handwriting.mjs; without JS, or with reduced
   motion, the finished word is simply there.
   ========================================================================== */

import { reducedMotion } from './motion.js';

/** The soft leading edge of the ink, as a share of the word's width. */
const EDGE = 0.05;
/** Screen sizes, in CSS px, whatever size the word is set at. */
const NIB_CORE_PX = 2.6;
const NIB_GLOW_PX = 12;
const TRAIL_PX = 1.5;

export function initInk(root = document) {
  const words = [...root.querySelectorAll('.ink-word')];
  if (!words.length) return;

  if (reducedMotion()) {
    words.forEach((w) => w.querySelector('.ink')?.classList.add('is-written'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.unobserve(entry.target);
      schedule(/** @type {HTMLElement} */ (entry.target));
    }
  }, { threshold: 0.6, rootMargin: '0px 0px -4% 0px' });

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

/** Writes the word inside this element now. @param {Element} word */
export function writeWord(word) {
  const svg = word.querySelector('svg.ink');
  if (svg instanceof SVGSVGElement) write(svg);
}

/** @param {SVGSVGElement} svg */
function write(svg) {
  if (svg.classList.contains('is-writing') || svg.classList.contains('is-written')) return;
  if (reducedMotion()) {
    svg.classList.add('is-written');
    return;
  }

  const vb = svg.viewBox.baseVal;
  const rendered = svg.getBoundingClientRect().width || 1;
  const upp = vb.width / rendered; // font units per CSS pixel

  const from = Number(svg.dataset.from);
  const to = Number(svg.dataset.to);
  const span = Math.max(1, to - from);
  const feather = span * EDGE;
  const line = (svg.dataset.line || '').split(' ').map((p) => p.split(',').map(Number));

  const edge = svg.querySelector('.ink__edge');
  const nib = svg.querySelector('.ink__nib');
  nib?.querySelector('.ink__nib-core')?.setAttribute('r', String(NIB_CORE_PX * upp));
  nib?.querySelector('.ink__nib-glow')?.setAttribute('r', String(NIB_GLOW_PX * upp));
  svg.style.setProperty('--trail', String(TRAIL_PX * upp));

  const trail = svg.querySelector('.ink__trail');
  const swash = svg.querySelector('.ink__swash');
  const prime = (/** @type {Element | null} */ el) => {
    if (!(el instanceof SVGGeometryElement)) return 0;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len} ${len}`;
    el.style.strokeDashoffset = String(len);
    return len;
  };
  const trailLen = prime(trail);
  const swashLen = prime(swash);

  // Pace: about the speed of a confident hand, the same for every word.
  const letters = (svg.closest('.ink-word')?.querySelector('.visually-hidden')?.textContent || '').length || 6;
  const dur = Math.min(2800, Math.max(1000, letters * 95 + 420));
  const swashDur = swash ? 900 : 0;

  svg.classList.add('is-writing');
  const t0 = performance.now();

  const frame = (now) => {
    const t = now - t0;
    const p = Math.min(1, t / dur);
    const k = easeInOutCubic(p);
    const x = from - feather + (span + feather * 2) * k;

    edge?.setAttribute('x1', String(x - feather));
    edge?.setAttribute('x2', String(x));

    if (nib) {
      const on = p > 0 && p < 1;
      nib.classList.toggle('is-on', on);
      if (on) nib.setAttribute('transform', `translate(${x - feather * 0.35} ${yAt(line, x - feather * 0.35)})`);
    }
    if (trail instanceof SVGGeometryElement) {
      trail.style.strokeDashoffset = String(trailLen * (1 - k));
    }
    if (swash instanceof SVGGeometryElement && t > dur * 0.9) {
      const s = easeOut(Math.min(1, (t - dur * 0.9) / swashDur));
      swash.style.strokeDashoffset = String(swashLen * (1 - s));
    }

    if (t < dur * 0.9 + swashDur + 30 || p < 1) {
      requestAnimationFrame(frame);
    } else {
      svg.classList.remove('is-writing');
      svg.classList.add('is-written');
      nib?.classList.remove('is-on');
    }
  };
  requestAnimationFrame(frame);
}

/** Height of the pen's path at x, interpolated. @param {number[][]} line @param {number} x */
function yAt(line, x) {
  if (!line.length || !Number.isFinite(line[0][0])) return 0;
  if (x <= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i += 1) {
    const [bx, by] = line[i];
    if (x <= bx) {
      const [ax, ay] = line[i - 1];
      const t = (x - ax) / (bx - ax || 1);
      return ay + (by - ay) * t;
    }
  }
  return line[line.length - 1][1];
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
