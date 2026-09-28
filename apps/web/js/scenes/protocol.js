/* ==========================================================================
   How a transfer stays whole: as each protocol step crosses the middle of
   the viewport, the sequence diagram shows every stage up to it and draws
   the new stage's messages. The edge case illustrations play once each,
   when they come into view.
   ========================================================================== */

import { reducedMotion } from './util.js';

/** @param {HTMLElement} root */
export function initProtocol(root) {
  const diagram = root.querySelector('[data-protocol-diagram]');
  const steps = [...root.querySelectorAll('[data-proto-step]')];
  const stages = diagram ? [...diagram.querySelectorAll('.seq__stage')] : [];
  initEdges();
  if (!(diagram instanceof HTMLElement) || !steps.length) return;

  const show = (n) => {
    diagram.dataset.step = String(n);
    stages.forEach((g) => g.classList.toggle('is-shown', Number(g.getAttribute('data-s')) <= n));
    steps.forEach((s) => {
      const k = Number(s.getAttribute('data-proto-step'));
      s.classList.toggle('is-active', k === n);
      s.classList.toggle('is-done', k < n);
    });
  };

  if (reducedMotion() || window.matchMedia('(max-width: 899px)').matches) {
    show(steps.length);
    return;
  }

  let current = 0;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const n = Number(entry.target.getAttribute('data-proto-step'));
      if (n !== current) {
        current = n;
        show(n);
      }
    }
  }, { rootMargin: '-42% 0px -48% 0px' });
  steps.forEach((s) => io.observe(s));
  show(1);
}

function initEdges() {
  const edges = document.querySelectorAll('[data-edge]');
  if (!edges.length) return;
  if (reducedMotion()) {
    edges.forEach((e) => e.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { threshold: 0.45 });
  edges.forEach((e) => io.observe(e));
}
