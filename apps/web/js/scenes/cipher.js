/* ==========================================================================
   Clex — a Vault note that encrypts itself, and back
   ========================================================================== */

import { reducedMotion, sleep, whileVisible } from './util.js';

/* ── Cipher: a note that encrypts itself ────────────────────────────────
   The plaintext scrambles into ciphertext left to right, holds, and comes
   back. It is what Vault does before a note is written to the device. */

const CIPHER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789+/=';

/** @param {HTMLElement} root */
export function initCipher(root) {
  const target = root.querySelector('[data-cipher-text]');
  const state = root.querySelector('[data-cipher-state]');
  if (!(target instanceof HTMLElement)) return;
  const plain = target.textContent || '';
  const cipher = [...plain].map((ch) => (ch === ' ' || ch === '\n' ? ch : CIPHER_CHARS[(Math.random() * CIPHER_CHARS.length) | 0])).join('');
  let run = 0;

  if (reducedMotion()) return;

  const morph = async (from, to, alive) => {
    const len = Math.max(from.length, to.length);
    for (let edge = 0; edge <= len + 6; edge += 2) {
      if (!alive()) return;
      let s = '';
      for (let i = 0; i < len; i += 1) {
        const a = to[i] ?? '';
        if (a === ' ' || a === '\n') s += a;
        else if (i < edge - 6) s += a;
        else if (i < edge) s += CIPHER_CHARS[(Math.random() * CIPHER_CHARS.length) | 0];
        else s += from[i] ?? '';
      }
      target.textContent = s;
      await sleep(28);
    }
    target.textContent = to;
  };

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    target.textContent = plain;
    root.dataset.state = 'plain';
    await sleep(1600);
    while (alive()) {
      root.dataset.state = 'locking';
      if (state) state.textContent = 'Encrypting…';
      await morph(plain, cipher, alive);
      if (!alive()) return;
      root.dataset.state = 'locked';
      if (state) state.textContent = 'AES-GCM · on this device';
      await sleep(2400);
      if (!alive()) return;
      root.dataset.state = 'unlocking';
      if (state) state.textContent = 'Unlocking…';
      await morph(cipher, plain, alive);
      if (!alive()) return;
      root.dataset.state = 'plain';
      if (state) state.textContent = 'Only you can read this';
      await sleep(2600);
    }
  };

  whileVisible(root, () => void play(), () => {
    run += 1;
    target.textContent = plain;
    root.dataset.state = 'plain';
  });
}
