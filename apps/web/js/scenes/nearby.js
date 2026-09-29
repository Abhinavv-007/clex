/* ==========================================================================
   Clex Link: nearby devices appear on the radar, you tap one, the file
   goes, it is verified and the Dynamic Island opens into a Live Activity
   saying so. Loops while on screen.
   ========================================================================== */

import { reducedMotion, sleep, whileVisible, tween } from './util.js';

/** @param {HTMLElement} root */
export function initNearby(root) {
  const peers = (i) => root.querySelectorAll(`[data-peer="${i}"]`);
  const screen = root.querySelector('.iphone__screen');
  const touch = root.querySelector('.iphone__touch');
  const bar = root.querySelector('.iphone__bar');
  const state = root.querySelector('[data-nearby-state]');
  const pct = root.querySelector('[data-nearby-pct]');
  const set = (el, t) => { if (el) el.textContent = t; };

  const found = (i, on) => peers(i).forEach((el) => el.classList.toggle('is-found', on));
  const reset = () => {
    [0, 1, 2].forEach((i) => found(i, false));
    root.querySelectorAll('.is-picked').forEach((el) => el.classList.remove('is-picked'));
    root.classList.remove('is-sending', 'is-done');
    if (bar instanceof HTMLElement) bar.style.setProperty('--p', '0');
    set(state, 'Waiting for Maya to accept');
    set(pct, '');
  };

  if (reducedMotion()) {
    [0, 1, 2].forEach((i) => found(i, true));
    root.classList.add('is-done');
    return;
  }

  let run = 0;
  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    reset();
    for (const i of [0, 1, 2]) {
      await sleep(i ? 650 : 900);
      if (!alive()) return;
      found(i, true);
    }
    await sleep(1000);
    if (!alive()) return;

    // Tap "Send" on Maya's phone.
    const row = root.querySelector('.iphone__peers li[data-peer="0"]');
    const btn = row?.querySelector('.iphone__send');
    if (btn && touch instanceof HTMLElement && screen) {
      const s = screen.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      touch.style.left = `${b.left - s.left + b.width / 2}px`;
      touch.style.top = `${b.top - s.top + b.height / 2}px`;
      touch.classList.remove('is-tap');
      void touch.offsetWidth;
      touch.classList.add('is-tap');
    }
    row?.classList.add('is-picked');
    await sleep(350);
    if (!alive()) return;
    root.classList.add('is-sending');
    await sleep(1300);
    if (!alive()) return;
    set(state, 'Sending over Direct+');
    await tween(2600, (t) => {
      if (!alive()) return;
      if (bar instanceof HTMLElement) bar.style.setProperty('--p', t.toFixed(3));
      set(pct, `${Math.round(t * 100)}%`);
    }, (t) => t);
    if (!alive()) return;
    set(state, 'Verified, receipt saved');
    await sleep(500);
    root.classList.add('is-done');
    await sleep(2600);
    if (!alive()) return;
    root.classList.remove('is-sending');
    await sleep(1600);
    if (alive()) void play();
  };

  whileVisible(root, () => void play(), () => { run += 1; }, 0.3);
}
