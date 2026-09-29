/* ==========================================================================
   Clex — the rail

   Long pages carry a manifest of their own down the right edge: one small
   group of chunks per section, filling in jade as you read through it and
   turning gold once you are past it, the way a transfer fills and is
   verified. It is the page's table of contents as well: hover it to see
   every section's name, click a group to go there. The share read so far
   sits underneath.

   Built from the page's own sections, so nothing is listed twice. Only on
   screens wide enough to have a margin for it, and only once the page head
   has scrolled away. Scroll work is one rAF per frame of scrolling.
   ========================================================================== */

import '../css/rail.css';
import { reducedMotion } from './motion.js';

/** Most cells in the whole rail, so it fits a short window. */
const MAX_CELLS = 46;

export function initRail() {
  const main = document.querySelector('main');
  if (!main || document.querySelector('.rail')) return;

  const sections = /** @type {HTMLElement[]} */ ([...main.children].filter(
    (el) => el instanceof HTMLElement && /^(SECTION|HEADER)$/.test(el.tagName) && el.offsetHeight > 120,
  ));
  if (sections.length < 3) return;

  const nav = document.createElement('nav');
  nav.className = 'rail';
  nav.setAttribute('aria-label', 'On this page');
  const list = document.createElement('ol');
  list.className = 'rail__list';
  nav.append(list);
  const readout = document.createElement('p');
  readout.className = 'rail__read';
  readout.setAttribute('aria-hidden', 'true');
  nav.append(readout);

  const heights = sections.map((s) => s.offsetHeight);
  const total = heights.reduce((a, b) => a + b, 0);
  const groups = sections.map((section, i) => {
    const count = Math.max(2, Math.min(7, Math.round((heights[i] / total) * MAX_CELLS)));
    if (!section.id) section.id = `section-${i + 1}`;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'rail__group';
    link.href = `#${section.id}`;
    const name = labelFor(section, i);
    link.innerHTML = `<span class="rail__label"><span class="rail__num">${String(i + 1).padStart(2, '0')}</span>${escapeHtml(name)}</span>`
      + `<span class="rail__cells" aria-hidden="true">${'<i></i>'.repeat(count)}</span>`;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      section.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', `#${section.id}`);
    });
    item.append(link);
    list.append(item);
    return { section, link, cells: [...link.querySelectorAll('i')], filled: -1, state: '' };
  });
  document.body.append(nav);

  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    // Reading position: a line a third of the way down the window.
    const line = vh * 0.34;
    const first = sections[0].getBoundingClientRect();
    nav.classList.toggle('is-shown', first.bottom < vh * 0.55);

    let current = -1;
    groups.forEach((g, i) => {
      const box = g.section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (line - box.top) / Math.max(1, box.height)));
      const filled = Math.round(p * g.cells.length);
      if (filled !== g.filled) {
        g.cells.forEach((cell, k) => cell.classList.toggle('is-in', k < filled));
        g.filled = filled;
      }
      const state = p >= 1 ? 'done' : p > 0 ? 'now' : '';
      if (state === 'now') current = i;
      if (state !== g.state) {
        g.link.classList.toggle('is-done', state === 'done');
        g.state = state;
      }
    });
    groups.forEach((g, i) => {
      g.link.classList.toggle('is-now', i === current);
      if (i === current) g.link.setAttribute('aria-current', 'location');
      else g.link.removeAttribute('aria-current');
    });

    const doc = document.documentElement;
    const read = Math.min(1, Math.max(0, window.scrollY / Math.max(1, doc.scrollHeight - vh)));
    readout.textContent = `${Math.round(read * 100)}%`;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

/**
 * A section's short name: its own data-rail-label, its eyebrow, its
 * aria-label, or its heading, in that order.
 * @param {HTMLElement} section @param {number} i
 */
function labelFor(section, i) {
  const own = section.dataset.railLabel;
  if (own) return own;
  const eyebrow = section.querySelector('.eyebrow');
  const heading = section.querySelector('h1, h2');
  const aria = section.getAttribute('aria-label');
  // An eyebrow only names this section if it comes before the heading.
  if (eyebrow && (!heading || eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)) {
    return tidy(eyebrow.textContent);
  }
  if (aria) return tidy(aria);
  if (heading) return tidy(heading.getAttribute('aria-label') || heading.textContent);
  return `Section ${i + 1}`;
}

/** @param {string | null} text */
const tidy = (text) => (text || '').replace(/\s+/g, ' ').trim();

/** @param {string} s */
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
