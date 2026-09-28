/* ==========================================================================
   The chain, drawn straight: blocks in a row, each carrying the previous
   block's hash, joined by links. On its own it grows every few seconds; the
   receipt scene drives it instead (data-chain-line="driven") and adds a
   block each time a receipt lands.
   ========================================================================== */

import { reducedMotion, whileVisible, randomHex, scramble } from './util.js';

const ROUTES = ['Direct', 'Local', 'Direct', 'Direct', 'Local'];
const KINDS = ['pdf · 2.4 MB', 'image · 612 KB', 'archive · 18 MB', 'document · 88 KB', 'video · 41 MB'];
const VISIBLE = 4;

/**
 * @param {HTMLElement} root
 * @returns {{ add: (opts?: { hash?: string, meta?: string, animate?: boolean }) => HTMLElement, slot: () => HTMLElement | null, prev: () => string }}
 */
export function initChainLine(root) {
  const track = root.querySelector('[data-chain-track]') || root;
  let index = Number(root.getAttribute('data-chain-start')) || 1024;
  let prev = randomHex(8);

  const add = ({ hash = randomHex(8), meta = '', animate = true } = {}) => {
    const el = document.createElement('div');
    el.className = `cblock${animate ? ' is-new' : ''}`;
    el.innerHTML = `
      <div class="cblock__head"><span class="cblock__idx">#${index}</span><span class="cblock__ok" aria-hidden="true"></span></div>
      <dl class="cblock__rows">
        <div><dt>prev</dt><dd><code class="cblock__prev">${prev}</code></dd></div>
        <div><dt>hash</dt><dd><code class="cblock__hash">${animate ? '········' : hash}</code></dd></div>
      </dl>
      <span class="cblock__meta">${meta || `${ROUTES[index % ROUTES.length]} · ${KINDS[index % KINDS.length]}`}</span>`;
    prev = hash;
    index += 1;
    const slot = track.querySelector('.cblock-slot');
    const before = [...track.querySelectorAll('.cblock')].pop();
    track.insertBefore(el, slot);
    if (animate) {
      scramble(el.querySelector('.cblock__hash'), hash, 650);
      requestAnimationFrame(() => el.classList.add('is-linked'));
      // Show the link: this block's prev is the previous block's hash.
      const pair = [el.querySelector('.cblock__prev'), before?.querySelector('.cblock__hash')];
      pair.forEach((c) => c?.classList.add('is-matching'));
      window.setTimeout(() => pair.forEach((c) => c?.classList.remove('is-matching')), 1600);
    } else {
      el.classList.add('is-linked', 'is-verified');
    }
    const blocks = track.querySelectorAll('.cblock');
    if (blocks.length > VISIBLE) {
      const first = blocks[0];
      first.classList.add('is-leaving');
      window.setTimeout(() => first.remove(), animate ? 520 : 0);
    }
    return el;
  };

  // The slot the next block goes into.
  if (!track.querySelector('.cblock-slot')) {
    const slot = document.createElement('div');
    slot.className = 'cblock-slot';
    slot.innerHTML = '<span>next block</span>';
    track.append(slot);
  }
  for (let i = 0; i < VISIBLE - 1; i += 1) add({ animate: false });

  const api = { add, slot: () => track.querySelector('.cblock-slot'), prev: () => prev };
  // @ts-ignore — the receipt scene reaches the driven chain through this.
  root.chainLine = api;

  if (root.dataset.chainLine === 'driven' || reducedMotion()) return api;

  let timer = 0;
  whileVisible(root, () => {
    clearInterval(timer);
    timer = window.setInterval(() => {
      const el = add();
      window.setTimeout(() => el.classList.add('is-verified'), 700);
    }, 3000);
  }, () => clearInterval(timer));
  return api;
}
