/* ==========================================================================
   Receipts: print, tear, fly, chain

   The printer feeds a receipt out line by line, stamps it verified, cuts it
   off at the perforation, and the receipt flies into the next slot of the
   chain below, where it becomes the newest block, linked to the one before
   by its hash. Then the next transfer's receipt starts printing.
   ========================================================================== */

import { reducedMotion, sleep, whileVisible, randomHex } from './util.js';

const SIZES = ['2.4 MB', '612 KB', '18.1 MB', '88 KB', '41 MB'];
const KINDS = ['pdf', 'image', 'archive', 'document', 'video'];

/** @param {HTMLElement} root */
export function initReceiptScene(root) {
  const paper = root.querySelector('[data-paper]');
  const inner = paper?.querySelector('.paper__inner');
  const printer = root.querySelector('.printer');
  const chainEl = root.querySelector('[data-chain-line]');
  if (!(paper instanceof HTMLElement) || !(inner instanceof HTMLElement) || !(chainEl instanceof HTMLElement)) return;

  buildBars(root.querySelector('[data-paper-bars]'));
  const lines = /** @type {HTMLElement[]} */ ([...inner.children]);
  const r = (k) => inner.querySelector(`[data-r="${k}"]`);
  const set = (k, v) => { const el = r(k); if (el) el.textContent = v; };

  /** @returns {any} */
  const chain = () => /** @type {any} */ (chainEl).chainLine;

  const fillReceipt = (n) => {
    const now = new Date();
    const hash = randomHex(8);
    set('idx', `#${n}`);
    set('date', `${now.getDate()} ${now.toLocaleString('en', { month: 'short' })} ${now.getFullYear()} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    const k = n % KINDS.length;
    set('files', `1 · ${KINDS[k]}`);
    set('size', SIZES[k]);
    const chunks = [38, 10, 290, 2, 656][k];
    const retries = n % 3 === 0 ? 1 : 0;
    set('chunks', `${chunks}/${chunks} verified`);
    set('retries', String(retries));
    set('health', String(retries ? 96 : 98 + (n % 2)));
    set('hash', `${hash}…${randomHex(4)}`);
    return { hash, meta: `Direct · ${KINDS[k]} · ${SIZES[k]}` };
  };

  const fullHeight = () => inner.scrollHeight;

  if (reducedMotion()) {
    fillReceipt(1027);
    paper.style.setProperty('--fed', `${fullHeight()}px`);
    paper.classList.add('is-stamped');
    return;
  }

  let run = 0;
  let n = 1027;

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    while (alive()) {
      const rec = fillReceipt(n);
      paper.classList.remove('is-stamped', 'is-cut');
      paper.getAnimations().forEach((a) => a.cancel());
      paper.style.opacity = '1';
      paper.style.setProperty('--fed', '0px');
      await sleep(500);
      if (!alive()) return;

      // Print: feed one line at a time.
      printer?.classList.add('is-printing');
      for (const line of lines) {
        const bottom = line.offsetTop + line.offsetHeight + 8;
        paper.style.setProperty('--fed', `${bottom}px`);
        await sleep(line.classList.contains('paper__bars') ? 320 : 150);
        if (!alive()) return;
      }
      paper.style.setProperty('--fed', `${fullHeight()}px`);
      printer?.classList.remove('is-printing');
      await sleep(250);
      paper.classList.add('is-stamped');
      await sleep(900);
      if (!alive()) return;

      // Tear at the perforation.
      printer?.classList.add('is-cutting');
      paper.classList.add('is-cut');
      await paper.animate(
        [{ transform: 'none' }, { transform: 'translateY(-10px) rotate(-2deg)' }],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
      ).finished.catch(() => {});
      printer?.classList.remove('is-cutting');
      if (!alive()) return;

      // Fly into the chain's next slot.
      const c = chain();
      const slot = c?.slot();
      if (slot instanceof HTMLElement) {
        slot.classList.add('is-target');
        const from = paper.getBoundingClientRect();
        const to = slot.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const s = Math.min(0.62, to.height / from.height * 1.25);
        await paper.animate(
          [
            { transform: 'translateY(-10px) rotate(-2deg)', opacity: 1 },
            { transform: `translate(${dx * 0.35}px, ${dy * 0.15 - 40}px) rotate(${dx > 0 ? 8 : -8}deg) scale(0.85)`, opacity: 1, offset: 0.4 },
            { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(${s})`, opacity: 0 },
          ],
          { duration: 1100, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', fill: 'forwards' },
        ).finished.catch(() => {});
        slot.classList.remove('is-target');
        if (!alive()) return;
        const block = c.add({ hash: rec.hash, meta: rec.meta });
        await sleep(650);
        block.classList.add('is-verified');
      }
      n += 1;
      await sleep(1600);
    }
  };

  const reset = () => {
    run += 1;
    paper.getAnimations().forEach((a) => a.cancel());
    paper.style.setProperty('--fed', '0px');
  };

  // The chain is started by its own module; wait for it before playing.
  const start = () => {
    if (chain()) void play();
    else window.setTimeout(start, 120);
  };
  whileVisible(root, start, reset, 0.35);
}

/** A barcode that looks the part. @param {Element | null} el */
function buildBars(el) {
  if (!(el instanceof HTMLElement) || el.childElementCount) return;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 46; i += 1) {
    const bar = document.createElement('i');
    bar.style.flex = `${[1, 1, 2, 3][Math.floor(rand() * 4)]}`;
    if (rand() > 0.72) bar.style.opacity = '0';
    el.append(bar);
  }
}
