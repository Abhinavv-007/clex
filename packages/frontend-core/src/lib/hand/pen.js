/**
 * The pen: draws on a handwritten word built by apps/web/scripts/handwriting.mjs.
 *
 * Like Apple's "hello": the word is written in one smooth, unhurried pass,
 * stroke after stroke along the pen's path, and then it simply stays. No
 * cursor, no glint, nothing that keeps moving.
 */

/** Pen speed, in font units per millisecond. "control" takes about 1.9 s. */
const SPEED = 5.4;
const MIN_MS = 900;
const MAX_MS = 3200;
/** A pen lift between strokes, in font units of travel. */
const LIFT = 110;

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {SVGSVGElement} svg
 * @param {{ speed?: number, onDone?: () => void }} [opts] speed > 1 writes faster
 */
export function writeInk(svg, opts = {}) {
  if (svg.classList.contains('is-writing') || svg.classList.contains('is-written')) return;
  const paths = /** @type {SVGPathElement[]} */ ([...svg.querySelectorAll('.ink__pen path')]);
  if (!paths.length || reduced()) {
    finish(svg, paths);
    opts.onDone?.();
    return;
  }

  // One timeline: every stroke's length plus a short lift between them.
  const lens = paths.map((p) => Math.max(1, Number(p.dataset.l) || 1));
  /** @type {number[]} */
  const starts = [];
  let cursor = 0;
  lens.forEach((l, i) => {
    starts.push(cursor);
    cursor += l + (i < lens.length - 1 ? LIFT : 0);
  });
  const total = cursor;
  const ms = Math.min(MAX_MS, Math.max(MIN_MS, total / SPEED)) / (opts.speed ?? 1);

  const drawn = new Float32Array(paths.length).fill(-1);
  svg.classList.add('is-writing');
  const t0 = performance.now();

  /** @param {number} now */
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / ms);
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
      return;
    }
    finish(svg, paths);
    svg.dispatchEvent(new CustomEvent('clex:ink-written', { bubbles: true }));
    opts.onDone?.();
  };
  requestAnimationFrame(frame);
}

/** @param {SVGSVGElement} svg @param {SVGPathElement[]} paths */
function finish(svg, paths) {
  svg.classList.remove('is-writing');
  svg.classList.add('is-written');
  paths.forEach((el) => {
    el.style.opacity = '';
    el.style.strokeDasharray = '';
  });
}

/** Clears a written word so it can be written again. @param {SVGSVGElement} svg */
export function unwriteInk(svg) {
  svg.classList.remove('is-writing', 'is-written');
  svg.querySelectorAll('.ink__pen path').forEach((el) => {
    if (el instanceof SVGElement) {
      el.style.opacity = '';
      el.style.strokeDasharray = '';
    }
  });
}

/** Eases in and out a little, and runs at an even pace in between. */
const ease = (/** @type {number} */ t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) * 0.3 + t * 0.7;
