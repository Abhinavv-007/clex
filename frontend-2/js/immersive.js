/* ============================================================
   CLEX — Immersive Layer (cursor spotlight, counters, blobs)
   Wired in main.js. Idempotent + reduced-motion aware.
   ============================================================ */

const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function initImmersive() {
  injectAmbientBlobs();
  if (REDUCED()) return;
  trackCursorSpotlight();
  initCursorFollower();
  trackNavSpotlight();
  initLiveTransferCard();
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

function initCursorFollower() {
  if (!window.matchMedia?.('(pointer: fine)').matches || window.innerWidth < 900) return;
  if (document.querySelector('.clex-cursor-follower')) return;

  const dot = document.createElement('div');
  dot.className = 'clex-cursor-follower';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);
  document.body.classList.add('clex-cursor-active');

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let tx = x;
  let ty = y;
  let raf = 0;

  const tick = () => {
    x += (tx - x) * 0.28;
    y += (ty - y) * 0.28;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    dot.classList.add('clex-cursor-follower--visible');
    if (!raf) tick();
  }, { passive: true });

  window.addEventListener('pointerdown', () => {
    dot.classList.add('clex-cursor-follower--down');
    window.setTimeout(() => dot.classList.remove('clex-cursor-follower--down'), 140);
  }, { passive: true });

  document.addEventListener('pointerover', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    dot.classList.toggle(
      'clex-cursor-follower--hot',
      Boolean(target?.closest('a, button, input, textarea, select, [role="button"], .data-stream__row'))
    );
  }, { passive: true });
}

function initLiveTransferCard() {
  document.querySelectorAll('.data-stream').forEach((card) => {
    const rows = Array.from(card.querySelectorAll('.data-stream__row')).filter((row) => {
      return !(row instanceof HTMLElement) || window.getComputedStyle(row).display !== 'none';
    });
    if (!rows.length) return;

    let active = 0;
    let interval = 0;
    const setActive = (index) => {
      active = (index + rows.length) % rows.length;
      rows.forEach((row, rowIndex) => {
        row.classList.toggle('data-stream__row--active', rowIndex === active);
        row.classList.toggle('data-stream__row--complete', rowIndex < active);
      });
      const progress = ((active + 1) / rows.length) * 100;
      if (card instanceof HTMLElement) {
        card.style.setProperty('--stream-progress', `${progress}%`);
        card.dataset.phase = rows[active]?.querySelector('.data-stream__tag')?.textContent?.trim() || '';
      }
    };

    const play = () => {
      window.clearInterval(interval);
      interval = window.setInterval(() => setActive(active + 1), 1500);
    };

    rows.forEach((row, index) => {
      row.addEventListener('pointerenter', () => setActive(index), { passive: true });
      row.addEventListener('click', () => {
        setActive(index);
        play();
      });
    });

    setActive(0);
    play();
  });
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
