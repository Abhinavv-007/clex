/* ==========================================================================
   Statement: the file crosses, nothing in between keeps it

   One scroll position drives the whole scene: the sentence lights word by
   word, the file rides the path from laptop to phone, the cloud in between
   flashes as it passes and keeps nothing, and once the file lands the last
   phrase is written by hand.
   ========================================================================== */

import { reducedMotion } from './util.js';
import { writeWord } from '../ink.js';

/** @param {HTMLElement} root */
export function initStatement(root) {
  const text = root.querySelector('[data-statement-text]');
  const journey = root.querySelector('[data-journey]');
  const path = root.querySelector('[data-journey-path]');
  const trail = root.querySelector('[data-journey-trail]');
  const file = root.querySelector('[data-journey-file]');
  const them = root.querySelector('[data-journey-them]');
  if (!(text instanceof HTMLElement) || !(journey instanceof HTMLElement)) return;

  const words = splitWords(text);
  const ink = text.querySelector('.ink-word');
  let written = false;

  const svg = path instanceof SVGPathElement ? path.ownerSVGElement : null;
  const total = path instanceof SVGPathElement ? path.getTotalLength() : 0;

  const place = (t) => {
    if (!(path instanceof SVGPathElement) || !(file instanceof HTMLElement) || !svg) return;
    const pt = path.getPointAtLength(total * t);
    const vb = svg.viewBox.baseVal;
    const box = journey.getBoundingClientRect();
    const x = (pt.x / vb.width) * box.width;
    const y = (pt.y / vb.height) * box.height;
    // A slight lift and tilt in flight, flat at either end.
    const lift = Math.sin(t * Math.PI);
    file.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${(lift * (t < 0.5 ? -3 : 3)).toFixed(2)}deg) scale(${(1 + lift * 0.06).toFixed(3)})`;
    if (trail instanceof SVGElement) trail.style.strokeDasharray = `${t.toFixed(4)} 1`;
  };

  if (reducedMotion()) {
    place(1);
    journey.classList.add('is-arrived');
    if (them) them.textContent = 'received';
    if (ink) writeWord(ink);
    return;
  }

  let frame = 0;
  let lastT = -1;
  const update = () => {
    frame = 0;
    const box = root.getBoundingClientRect();
    const travel = Math.max(1, box.height - window.innerHeight);
    const p = Math.min(1, Math.max(0, -box.top / travel));

    const lit = (p / 0.72) * (words.length + 1);
    words.forEach((w, i) => {
      w.style.opacity = (0.14 + 0.86 * Math.min(1, Math.max(0, lit - i))).toFixed(3);
    });

    const raw = Math.min(1, Math.max(0, (p - 0.1) / 0.66));
    const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    if (Math.abs(t - lastT) > 0.0005) {
      lastT = t;
      place(t);
    }
    journey.classList.toggle('is-passing', t > 0.42 && t < 0.6);
    const arrived = t >= 0.995;
    journey.classList.toggle('is-arrived', arrived);
    if (them) them.textContent = arrived ? 'received, verified' : t > 0 ? 'receiving…' : 'waiting';

    if (!written && ink && p >= 0.8) {
      written = true;
      writeWord(ink);
    }
  };

  const request = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', () => { lastT = -1; request(); }, { passive: true });
  update();
}

/**
 * Wraps each word of the sentence's plain text in a span so it can light up
 * on its own. The handwritten phrase is left as it is.
 * @param {HTMLElement} text
 */
function splitWords(text) {
  const words = [];
  for (const node of [...text.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const frag = document.createDocumentFragment();
    for (const part of (node.textContent || '').split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(document.createTextNode(' '));
      } else {
        const span = document.createElement('span');
        span.className = 'sw';
        span.textContent = part;
        words.push(span);
        frag.append(span);
      }
    }
    node.replaceWith(frag);
  }
  return words;
}
