/* ==========================================================================
   Clex — the ambient field

   Below the hero the page is not empty air: a light dust of jade and gold
   motes hangs behind every section, drifting slowly upward at three depths.
   Scrolling moves the page through it (the near motes faster, so it reads
   as depth), and around the pointer the motes join into a small, glowing
   constellation, the way the transfer chain joins blocks. On bone the motes
   are ink; on charcoal they glow.

   One fixed <canvas>, a hundred-odd points, one rAF loop that sleeps in a
   background tab and while the hero (which has its own stream) fills the
   screen. Not started under reduced motion.
   ========================================================================== */

import { reducedMotion } from './motion.js';

const TAU = Math.PI * 2;
/** Link motes closer than this to each other, near the pointer. */
const LINK = 118;
/** How far from the pointer the constellation reaches. */
const REACH = 190;

/**
 * @typedef {{ x: number, y: number, z: number, r: number, vx: number, vy: number, hue: 0 | 1, tw: number }} Mote
 */

export function initAmbient() {
  if (reducedMotion() || document.querySelector('canvas.ambient')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'ambient';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const small = window.matchMedia('(max-width: 700px)').matches;
  let W = 0;
  let H = 0;
  let dpr = 1;
  /** @type {Mote[]} */
  let motes = [];
  let dark = false;

  const readTone = () => {
    dark = document.documentElement.dataset.theme === 'dark';
  };

  const seed = () => {
    const count = Math.round(Math.min(150, (W * H) / (small ? 14000 : 10500)));
    motes = Array.from({ length: count }, () => {
      const z = Math.random();
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        z,
        r: 0.6 + z * 1.9,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -(0.05 + z * 0.16),
        hue: Math.random() < 0.62 ? 0 : 1,
        tw: Math.random() * TAU,
      };
    });
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    const reseed = !motes.length || Math.abs(nw - W) > 120;
    W = nw;
    H = nh;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (reseed) seed();
  };

  const pointer = { x: -9999, y: -9999, on: 0, target: 0 };
  let lastY = window.scrollY;
  let drift = 0;
  let running = false;
  let raf = 0;
  let heroCovers = true;

  const colour = (hue, a) => {
    if (dark) return hue ? `rgba(220, 184, 119, ${a})` : `rgba(143, 209, 169, ${a})`;
    return hue ? `rgba(156, 122, 54, ${a * 0.8})` : `rgba(46, 106, 79, ${a * 0.75})`;
  };

  const frame = (now) => {
    raf = 0;
    if (!running) return;
    const t = now / 1000;

    // Scrolling carries the field: near motes move more than far ones.
    const y = window.scrollY;
    drift += (y - lastY - drift) * 0.18;
    lastY = y;
    pointer.on += (pointer.target - pointer.on) * 0.08;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (const m of motes) {
      m.x += m.vx;
      m.y += m.vy - drift * (0.12 + m.z * 0.5);
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
      if (m.y > H + 10) { m.y = -10; m.x = Math.random() * W; }
      if (m.x < -10) m.x = W + 10;
      if (m.x > W + 10) m.x = -10;

      // The pointer draws the motes near it in, a little.
      if (pointer.on > 0.01) {
        const dx = pointer.x - m.x;
        const dy = pointer.y - m.y;
        const d = Math.hypot(dx, dy);
        if (d < REACH && d > 1) {
          const pull = (1 - d / REACH) * 0.25 * pointer.on;
          m.x += (dx / d) * pull;
          m.y += (dy / d) * pull;
        }
      }

      const twinkle = 0.55 + Math.sin(t * (0.8 + m.z) + m.tw) * 0.45;
      const a = (dark ? 0.2 + m.z * 0.5 : 0.16 + m.z * 0.34) * twinkle;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fillStyle = colour(m.hue, a);
      if (dark && m.z > 0.7) {
        ctx.shadowColor = colour(m.hue, 0.8);
        ctx.shadowBlur = 8;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Around the pointer, near motes link up like blocks in a chain.
    if (pointer.on > 0.02) {
      const near = motes.filter((m) => Math.hypot(m.x - pointer.x, m.y - pointer.y) < REACH);
      ctx.lineWidth = 1;
      for (let i = 0; i < near.length; i += 1) {
        for (let j = i + 1; j < near.length; j += 1) {
          const a = near[i];
          const b = near[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK) continue;
          const fade = (1 - d / LINK) * (1 - Math.hypot((a.x + b.x) / 2 - pointer.x, (a.y + b.y) / 2 - pointer.y) / REACH);
          if (fade <= 0) continue;
          ctx.strokeStyle = colour(i % 3 ? 0 : 1, fade * 0.55 * pointer.on);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    const next = !document.hidden && !heroCovers;
    if (next === running) return;
    running = next;
    canvas.classList.toggle('is-live', running);
    if (running && !raf) raf = requestAnimationFrame(frame);
  };

  readTone();
  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('clex:theme', readTone);
  document.addEventListener('visibilitychange', sync);

  // The hero has its own stream; the field takes over once it scrolls away.
  const hero = document.querySelector('.stage-head');
  if (hero) {
    new IntersectionObserver((entries) => {
      heroCovers = entries.some((e) => e.intersectionRatio > 0.85);
      sync();
    }, { threshold: [0, 0.85, 1] }).observe(hero);
  } else {
    heroCovers = false;
  }

  if (window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.target = 1;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.target = 0; });
  }

  sync();
}
