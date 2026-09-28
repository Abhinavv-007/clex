/* ==========================================================================
   Clex — helpers shared by the scenes
   ========================================================================== */

export { reducedMotion, countUp } from '../motion.js';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `start` while the element is on screen and `stop` when it leaves.
 * @param {Element} el @param {() => void} start @param {() => void} stop
 */
export function whileVisible(el, start, stop, threshold = 0.25) {
  let on = false;
  const set = (next) => {
    if (next === on) return;
    on = next;
    if (on) start();
    else stop();
  };
  const io = new IntersectionObserver((entries) => {
    set(entries.some((e) => e.isIntersecting) && !document.hidden);
  }, { threshold });
  io.observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) set(false);
    else {
      const box = el.getBoundingClientRect();
      set(box.bottom > 0 && box.top < window.innerHeight);
    }
  });
}

/** @param {number} n */
export function randomHex(n) {
  let s = '';
  for (let i = 0; i < n; i += 1) s += '0123456789abcdef'[(Math.random() * 16) | 0];
  return s;
}

/** Scrambles an element's text into its final value. @param {Element | null} el @param {string} final @param {number} ms */
export function scramble(el, final, ms) {
  if (!el) return;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const fixed = Math.floor(final.length * t);
    el.textContent = final.slice(0, fixed) + randomHex(final.length - fixed);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * @param {Element | null} el @param {string} text @param {number} speed
 * @param {() => boolean} alive
 */
export async function typeInto(el, text, speed, alive) {
  if (!el) return;
  el.textContent = '';
  for (const ch of text) {
    if (!alive()) return;
    el.textContent += ch;
    await sleep(speed);
  }
}

/** Calls fn with a 0..1 progress over `ms`, eased. Resolves at the end. */
export function tween(ms, fn, ease = (t) => 1 - Math.pow(1 - t, 3)) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      fn(ease(t));
      if (t < 1) requestAnimationFrame(tick);
      else resolve(undefined);
    };
    requestAnimationFrame(tick);
  });
}
