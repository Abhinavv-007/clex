/* ============================================================
   CLEX — Immersive Layer (cursor spotlight, counters, blobs)
   Wired in main.js. Idempotent + reduced-motion aware.
   ============================================================ */

const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function initImmersive() {
  injectAmbientBlobs();
  if (REDUCED()) return;
  trackCursorSpotlight();
  trackNavSpotlight();
  initRevealObserver();
  initAnimatedCounters();
}

function injectAmbientBlobs() {
  if (document.querySelector('.creem-ambient-blobs')) return;
  const wrap = document.createElement('div');
  wrap.className = 'creem-ambient-blobs';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<span></span><span></span><span></span>';
  document.body.appendChild(wrap);
}

function trackCursorSpotlight() {
  if (!window.matchMedia?.('(pointer: fine)').matches || window.innerWidth < 900) return;
  let raf = 0;
  let last = 0;
  let pending = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const apply = () => {
    raf = 0;
    document.documentElement.style.setProperty('--cursor-x', `${pending.x}px`);
    document.documentElement.style.setProperty('--cursor-y', `${pending.y}px`);
  };
  window.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - last < 34) return;
    last = now;
    pending = { x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  apply();
}

function trackNavSpotlight() {
  const inner = document.querySelector('.nav__inner');
  if (!inner) return;
  let raf = 0;
  let pending = { x: 0, y: 0 };
  const apply = () => {
    raf = 0;
    inner.style.setProperty('--nav-x', `${pending.x}px`);
    inner.style.setProperty('--nav-y', `${pending.y}px`);
  };
  inner.addEventListener('pointermove', (e) => {
    const r = inner.getBoundingClientRect();
    pending = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
}

function initRevealObserver() {
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('has-reveal-observer');
  const targets = document.querySelectorAll('.reveal, .reveal-right, .reveal-scale, [data-reveal]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  targets.forEach((el) => io.observe(el));
}

function initAnimatedCounters() {
  const counters = document.querySelectorAll('[data-count-to]');
  if (!counters.length || !('IntersectionObserver' in window)) return;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const animate = (el) => {
    const target = parseFloat(el.dataset.countTo || '0');
    const decimals = parseInt(el.dataset.countDecimals || '0', 10);
    const suffix = el.dataset.countSuffix || '';
    const prefix = el.dataset.countPrefix || '';
    const dur = 900;
    const start = performance.now();
    const finalText = `${prefix}${target.toFixed(decimals)}${suffix}`;
    if (el instanceof HTMLElement) {
      el.style.minWidth = `${Math.max(finalText.length, el.textContent?.length || 0)}ch`;
    }
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const v = target * ease(t);
      el.textContent = t === 1 ? finalText : `${prefix}${v.toFixed(decimals)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach((el) => io.observe(el));
}
