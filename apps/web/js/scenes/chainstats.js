/* ==========================================================================
   Clex — live numbers from the public chain
   ========================================================================== */

import { countUp } from './util.js';

/* ── Live chain numbers ─────────────────────────────────────────────────── */

/** @param {HTMLElement} root */
export async function initChainStats(root) {
  const base = root.getAttribute('data-chain-stats') || '';
  try {
    const res = await fetch(`${base}/chain/stats`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const stats = await res.json();
    const map = {
      sessions: stats.total_sessions,
      chains: stats.total_chains,
      completed: stats.completed_sessions,
    };
    for (const [key, value] of Object.entries(map)) {
      const el = root.querySelector(`[data-stat="${key}"]`);
      if (!(el instanceof HTMLElement) || !Number.isFinite(value)) continue;
      el.dataset.count = String(value);
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        countUp(el, value);
      }, { threshold: 0.5 });
      io.observe(el);
    }
    root.classList.add('is-live');
  } catch {
    root.classList.add('is-offline');
  }
}
