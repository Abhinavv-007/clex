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
  initMagneticTilt();
  initCursorFollower();
  initMascotEyes();
  initChunkGridStagger();
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
  let raf = 0;
  let pending = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const apply = () => {
    raf = 0;
    document.documentElement.style.setProperty('--cursor-x', `${pending.x}px`);
    document.documentElement.style.setProperty('--cursor-y', `${pending.y}px`);
  };
  window.addEventListener('pointermove', (e) => {
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
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const v = target * ease(t);
      el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Pulse glow on the host cell when count completes
        const host = el.closest('.stat-orb, .creem-counter__cell, .bento__cell') || el;
        host.classList.add('pulse-glow');
        setTimeout(() => host.classList.remove('pulse-glow'), 700);
      }
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

function initMagneticTilt() {
  const cards = document.querySelectorAll('.bento__cell, .peer-node, .creem-stack__card');
  cards.forEach((card) => {
    if (!(card instanceof HTMLElement)) return;
    const max = 6;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width - 0.5;
      const cy = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${-cy * max}deg) rotateY(${cx * max}deg) translateZ(0)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ---------- Custom cursor follower (12px circle, mix-blend-mode) ---------- */
function initCursorFollower() {
  // Skip on touch devices
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;
  if (document.querySelector('.clex-cursor-follower')) return;

  const dot = document.createElement('div');
  dot.className = 'clex-cursor-follower';
  dot.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dot);

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let curX = mouseX;
  let curY = mouseY;
  let raf = 0;
  let active = false;

  const tick = () => {
    raf = 0;
    curX += (mouseX - curX) * 0.18;
    curY += (mouseY - curY) * 0.18;
    dot.style.transform = `translate3d(${curX - 6}px, ${curY - 6}px, 0)`;
    if (Math.abs(mouseX - curX) > 0.4 || Math.abs(mouseY - curY) > 0.4) {
      raf = requestAnimationFrame(tick);
    }
  };

  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!active) {
      active = true;
      dot.classList.add('is-active');
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    active = false;
    dot.classList.remove('is-active');
  });

  // Grow on interactive elements
  const hotSelector = 'a, button, .btn, .pill-btn, .card, .bento__cell, [role="button"]';
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest(hotSelector)) {
      dot.classList.add('is-hot');
    }
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest(hotSelector)) {
      dot.classList.remove('is-hot');
    }
  });
}

/* ---------- Mascot eyes track cursor ---------- */
function initMascotEyes() {
  const pupils = document.querySelectorAll('.hero__mascot-pupil');
  if (!pupils.length) return;
  const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  if (!fine) return;

  let raf = 0;
  let pendingX = 0;
  let pendingY = 0;

  const apply = () => {
    raf = 0;
    pupils.forEach((p) => {
      if (!(p instanceof HTMLElement)) return;
      p.style.setProperty('--pupil-x', `${pendingX}px`);
      p.style.setProperty('--pupil-y', `${pendingY}px`);
      p.style.transform = `translate(${pendingX}px, ${pendingY}px)`;
    });
  };

  window.addEventListener('pointermove', (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx; // -1..1
    const dy = (e.clientY - cy) / cy;
    pendingX = Math.max(-4, Math.min(4, dx * 4));
    pendingY = Math.max(-4, Math.min(4, dy * 4));
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
}

/* ---------- Chunk grid wave stagger via --row / --col CSS vars ---------- */
function initChunkGridStagger() {
  const grids = document.querySelectorAll('.chunk-grid');
  grids.forEach((grid) => {
    if (!(grid instanceof HTMLElement)) return;
    const cells = grid.querySelectorAll('.chunk-grid__cell');
    if (!cells.length) return;

    const computeCols = () => {
      const styles = getComputedStyle(grid);
      const colsTemplate = styles.gridTemplateColumns || '';
      const colCount = colsTemplate.split(' ').filter(Boolean).length || 8;
      cells.forEach((cell, i) => {
        if (!(cell instanceof HTMLElement)) return;
        const row = Math.floor(i / colCount);
        const col = i % colCount;
        cell.style.setProperty('--row', String(row));
        cell.style.setProperty('--col', String(col));
      });
    };

    computeCols();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => computeCols());
      ro.observe(grid);
    }
  });
}
