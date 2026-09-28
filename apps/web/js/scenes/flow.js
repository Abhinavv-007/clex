/* ==========================================================================
   Flow: drop → prepare → share → verify

   The steps scroll past; the stage beside them (sticky) shows one scene per
   step. The stage's data-step attribute is the whole state and CSS plays
   each scene (css/scenes/flow*.css). This only picks the step, runs the two
   counters, and lays out the QR once.
   ========================================================================== */

import { reducedMotion, countUp } from './util.js';

/** @param {HTMLElement} root */
export function initFlow(root) {
  const stage = root.querySelector('[data-flow-stage]');
  const steps = [...root.querySelectorAll('[data-flow-step]')];
  if (!(stage instanceof HTMLElement) || !steps.length) return;

  stage.dataset.count = String(steps.length);
  buildQr(stage.querySelector('[data-flow-qr]'));

  const size = stage.querySelector('[data-flow-size]');
  const pct = stage.querySelector('[data-flow-pct]');
  let current = 0;
  let timers = [];

  const setStep = (n) => {
    if (n === current) return;
    current = n;
    stage.dataset.step = String(n);
    steps.forEach((s) => s.classList.toggle('is-active', Number(s.getAttribute('data-flow-step')) === n));
    timers.forEach(clearTimeout);
    timers = [];

    if (size instanceof HTMLElement) {
      size.textContent = '4.2 MB';
      if (n === 2) timers.push(window.setTimeout(() => shrink(size, 4200, 612), 900));
    }
    if (pct instanceof HTMLElement) {
      pct.textContent = '0%';
      if (n === 3) {
        timers.push(window.setTimeout(() => {
          pct.dataset.from = '0';
          pct.dataset.suffix = '%';
          countUp(pct, 100);
        }, 900));
      }
    }
  };

  if (reducedMotion()) {
    setStep(steps.length);
    steps.forEach((s) => s.classList.add('is-active'));
    if (size) size.textContent = '612 KB';
    if (pct) pct.textContent = '100%';
    return;
  }

  // A step is active while it crosses the middle band of the viewport. On
  // narrow screens the stage sits pinned above the text, so the band moves
  // down to where the text is actually read.
  const narrow = window.matchMedia('(max-width: 899px)').matches;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) setStep(Number(entry.target.getAttribute('data-flow-step')));
    }
  }, { rootMargin: narrow ? '-70% 0px -22% 0px' : '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
  setStep(1);
}

/** Size in KB, shown as MB or KB. @param {HTMLElement} el */
function shrink(el, fromKb, toKb) {
  const start = performance.now();
  const dur = 1400;
  const fmt = (kb) => (kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${Math.round(kb)} KB`);
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    el.textContent = fmt(fromKb + (toKb - fromKb) * e);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * A 21×21 code that looks the part: three finder squares, timing lines and
 * a seeded scatter. It appears cell by cell when the share scene plays.
 * @param {Element | null} el
 */
function buildQr(el) {
  if (!(el instanceof HTMLElement) || el.childElementCount) return;
  const N = 21;
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const finder = (x, y, ox, oy) => {
    const dx = x - ox;
    const dy = y - oy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
    return ring !== 2;
  };
  const frag = document.createDocumentFragment();
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const f = finder(x, y, 0, 0) ?? finder(x, y, N - 7, 0) ?? finder(x, y, 0, N - 7);
      const quiet = (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
      let on;
      if (f !== null) on = f;
      else if (quiet) on = false;
      else if (y === 6 || x === 6) on = (x + y) % 2 === 0;
      else on = rand() > 0.52;
      const cell = document.createElement('i');
      if (!on) cell.className = 'is-off';
      cell.style.setProperty('--d', `${Math.round(rand() * 700)}ms`);
      frag.append(cell);
    }
  }
  el.append(frag);
}
