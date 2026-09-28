/* ==========================================================================
   Clex — the circuit field

   The mark has gold circuit traces running through its stones. This draws
   the same traces behind the hero and the page heads: bundles of parallel
   lines come in from the edges, bend at 45°, and stop short of the headline,
   which sits where the chip would be. Small packets travel along them toward
   it — files arriving — and a pad pulses when one lands. Near the pointer
   the traces catch the light.

   One <canvas data-field>, one rAF loop that only runs while the canvas is
   on screen and the tab is visible. Reduced motion gets the drawn traces and
   nothing that moves.
   ========================================================================== */

import { reducedMotion } from './motion.js';

const TAU = Math.PI * 2;

export function initFields() {
  document.querySelectorAll('canvas[data-field]').forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) createField(canvas);
  });
}

/**
 * @typedef {{ pts: number[][], lens: number[], total: number, delay: number }} Line
 * @typedef {{ line: Line, d: number, speed: number, hue: 'jade' | 'gold' }} Packet
 * @typedef {{ x: number, y: number, t: number }} Pulse
 */

/** @param {HTMLCanvasElement} canvas */
function createField(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const variant = canvas.dataset.field || 'hero';
  const intensity = variant === 'soft' ? 0.6 : 1;
  const still = reducedMotion();

  let W = 0;
  let H = 0;
  let dpr = 1;
  /** @type {Line[]} */
  let lines = [];
  /** @type {Packet[]} */
  let packets = [];
  /** @type {Pulse[]} */
  let pulses = [];
  let colors = readColors();
  let born = performance.now();
  let lastSpawn = 0;
  let running = false;
  let visible = false;
  let frame = 0;
  let last = 0;
  const pointer = { x: -9999, y: -9999, a: 0, target: 0 };

  /** Pre-rendered layers: the traces at rest, and the same traces lit. */
  const base = document.createElement('canvas');
  const lit = document.createElement('canvas');
  const scratch = document.createElement('canvas');

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    return {
      line: s.getPropertyValue('--gold-line').trim() || 'rgba(156,122,54,.42)',
      gold: s.getPropertyValue('--gold').trim() || '#9c7a36',
      jade: s.getPropertyValue('--jade').trim() || '#2e6a4f',
    };
  }

  function layout() {
    const box = canvas.getBoundingClientRect();
    const nextW = Math.round(box.width);
    const nextH = Math.round(box.height);
    if (!nextW || !nextH) return false;
    // Phones resize the viewport height as the URL bar shows and hides;
    // that must not regenerate the whole field.
    if (Math.abs(nextW - W) < 2 && Math.abs(nextH - H) < 120 && lines.length) return false;
    W = nextW;
    H = nextH;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, base, lit, scratch]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    lines = generate(W, H, variant);
    packets = [];
    pulses = [];
    born = performance.now();
    return true;
  }

  function paintLayers() {
    paintLines(base, colors.line, 1, 1);
    paintLines(lit, colors.gold, 1.2, 1);
  }

  /**
   * @param {HTMLCanvasElement} target
   * @param {string} stroke
   * @param {number} width
   * @param {number} progress 0..1 draw-in progress (per line, staggered)
   */
  function paintLines(target, stroke, width, progress) {
    const g = target.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = stroke;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const line of lines) {
      const p = Math.max(0, Math.min(1, (progress * 1.6) - line.delay));
      if (p <= 0) continue;
      drawPartial(g, line, line.total * easeOut(p));
      if (p >= 1) {
        const end = line.pts[line.pts.length - 1];
        g.beginPath();
        g.arc(end[0], end[1], 2.4, 0, TAU);
        g.stroke();
      }
    }
  }

  function render(now) {
    const dt = Math.min(64, now - last || 16);
    last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw-in over the first moments, then the cached layer.
    const intro = still ? 1 : Math.min(1, (now - born) / 1900);
    if (intro < 1) {
      paintLines(base, colors.line, 1, intro);
    } else if (!base.dataset.ready) {
      paintLayers();
      base.dataset.ready = '1';
    }
    ctx.globalAlpha = intensity;
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = 1;

    // Pointer light: the lit traces, masked to a soft circle.
    pointer.a += (pointer.target - pointer.a) * 0.08;
    if (intro >= 1 && pointer.a > 0.01) {
      const s = scratch.getContext('2d');
      if (s) {
        s.setTransform(1, 0, 0, 1, 0, 0);
        s.globalCompositeOperation = 'source-over';
        s.clearRect(0, 0, scratch.width, scratch.height);
        s.drawImage(lit, 0, 0);
        s.globalCompositeOperation = 'destination-in';
        const r = 170 * dpr;
        const grad = s.createRadialGradient(pointer.x * dpr, pointer.y * dpr, 0, pointer.x * dpr, pointer.y * dpr, r);
        grad.addColorStop(0, `rgba(0,0,0,${pointer.a})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        s.fillStyle = grad;
        s.fillRect(0, 0, scratch.width, scratch.height);
        ctx.drawImage(scratch, 0, 0);
      }
    }

    if (!still && intro >= 0.6) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stepPackets(now, dt);
      drawPulses(now);
    }
  }

  function stepPackets(now, dt) {
    const max = variant === 'soft' ? 3 : (W < 700 ? 4 : 8);
    const every = variant === 'soft' ? 1500 : 650;
    if (packets.length < max && now - lastSpawn > every * (0.6 + Math.random() * 0.8)) {
      lastSpawn = now;
      const line = lines[(Math.random() * lines.length) | 0];
      if (line) {
        packets.push({
          line,
          d: 0,
          speed: 90 + Math.random() * 120,
          hue: Math.random() < 0.72 ? 'jade' : 'gold',
        });
      }
    }

    for (let i = packets.length - 1; i >= 0; i -= 1) {
      const p = packets[i];
      p.d += (p.speed * dt) / 1000;
      if (p.d >= p.line.total) {
        const end = p.line.pts[p.line.pts.length - 1];
        pulses.push({ x: end[0], y: end[1], t: now });
        packets.splice(i, 1);
        continue;
      }
      const color = p.hue === 'jade' ? colors.jade : colors.gold;
      // Tail: fading beads behind the head.
      for (let k = 0; k < 9; k += 1) {
        const back = p.d - k * 5;
        if (back < 0) break;
        const [x, y] = pointAt(p.line, back);
        ctx.globalAlpha = (1 - k / 9) * 0.55 * intensity;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 - k * 0.1, 0, TAU);
        ctx.fill();
      }
      const [hx, hy] = pointAt(p.line, p.d);
      ctx.globalAlpha = intensity;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(hx, hy, 2.1, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function drawPulses(now) {
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      const pulse = pulses[i];
      const t = (now - pulse.t) / 700;
      if (t >= 1) {
        pulses.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = (1 - t) * 0.8 * intensity;
      ctx.strokeStyle = colors.jade;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pulse.x, pulse.y, 2.4 + easeOut(t) * 10, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    frame = 0;
    if (!running) return;
    render(now);
    frame = requestAnimationFrame(loop);
  }

  function setRunning(next) {
    if (next === running) return;
    running = next;
    if (running && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }

  const sync = () => setRunning(visible && !document.hidden && !(still && base.dataset.ready));

  layout();
  // Draw once immediately so there is no empty frame.
  render(performance.now());

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  }).observe(canvas);
  document.addEventListener('visibilitychange', sync);

  new ResizeObserver(() => {
    if (layout()) {
      delete base.dataset.ready;
      if (still) {
        paintLayers();
        base.dataset.ready = '1';
        render(performance.now());
      }
      sync();
    }
  }).observe(canvas);

  window.addEventListener('clex:theme', () => {
    // The theme's custom properties have changed by the next frame.
    requestAnimationFrame(() => {
      colors = readColors();
      paintLayers();
      base.dataset.ready = '1';
      if (!running) render(performance.now());
    });
  });

  if (!still && window.matchMedia('(hover: hover)').matches) {
    const host = canvas.parentElement || canvas;
    host.addEventListener('pointermove', (event) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
      pointer.target = 1;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { pointer.target = 0; });
  }

  if (still) {
    paintLayers();
    base.dataset.ready = '1';
    render(performance.now());
  }
}

/* ── Geometry ───────────────────────────────────────────────────────────── */

/**
 * Bundles enter from the left and right edges, run in, step diagonally
 * toward the middle band, and end before the central column. A few more
 * rise from the bottom edge. Every bend is 45°, like a board.
 *
 * @param {number} W @param {number} H @param {string} variant
 * @returns {Line[]}
 */
function generate(W, H, variant) {
  const rand = seeded(W * 31 + H * 7 + (variant === 'soft' ? 5 : 0));
  /** @type {number[][][]} */
  const paths = [];
  const narrow = W < 700;
  const perSide = variant === 'soft' ? (narrow ? 2 : 3) : (narrow ? 3 : 5);
  const gap = 7;
  const clear = narrow ? W * 0.5 : Math.min(W * 0.42, 560); // central column kept clear

  for (const side of [-1, 1]) {
    const edge = side < 0 ? -8 : W + 8;
    const slots = spread(perSide, H * 0.1, H * 0.92, rand);
    for (const y0 of slots) {
      const n = 2 + ((rand() * 3) | 0);
      const run1 = W * (0.04 + rand() * 0.1);
      const toward = y0 < H * 0.5 ? 1 : -1;
      const diag = 18 + rand() * 60;
      const stop = (W - clear) / 2 - 20 - rand() * (narrow ? 20 : 120);
      for (let k = 0; k < n; k += 1) {
        const off = k * gap * toward * -1;
        const x1 = edge - side * run1;
        const x2 = x1 - side * diag;
        const y1 = y0 + off;
        const y2 = y1 + toward * diag;
        // Inner lines of the bundle stop a little earlier, like the mark.
        const endX = side < 0 ? stop - k * gap * 1.6 : W - stop + k * gap * 1.6;
        if ((side < 0 && endX <= x2 + 10) || (side > 0 && endX >= x2 - 10)) continue;
        paths.push([[edge, y1], [x1, y1], [x2, y2], [endX, y2]]);
      }
    }
  }

  const risers = variant === 'soft' ? 1 : (narrow ? 1 : 3);
  for (let i = 0; i < risers; i += 1) {
    const x0 = W * (0.12 + rand() * 0.76);
    if (Math.abs(x0 - W / 2) < clear * 0.45) continue;
    const up = H * (0.12 + rand() * 0.16);
    const dir = x0 < W / 2 ? 1 : -1;
    const diag = 20 + rand() * 40;
    for (let k = 0; k < 2 + ((rand() * 2) | 0); k += 1) {
      const x = x0 + k * gap;
      paths.push([[x, H + 8], [x, H - up], [x + dir * diag, H - up - diag], [x + dir * diag, H - up - diag - 24 - k * 10]]);
    }
  }

  return paths.map((pts, i) => {
    const lens = [];
    let total = 0;
    for (let j = 1; j < pts.length; j += 1) {
      const len = Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
      lens.push(len);
      total += len;
    }
    return { pts, lens, total, delay: (i / paths.length) * 0.6 };
  });
}

/** Evenly spread n values in [a, b] with a little jitter. */
function spread(n, a, b, rand) {
  const out = [];
  const step = (b - a) / n;
  for (let i = 0; i < n; i += 1) out.push(a + step * (i + 0.2 + rand() * 0.6));
  return out;
}

/** @param {Line} line @param {number} d */
function pointAt(line, d) {
  let rest = d;
  for (let i = 0; i < line.lens.length; i += 1) {
    const len = line.lens[i];
    if (rest <= len) {
      const t = len ? rest / len : 0;
      const a = line.pts[i];
      const b = line.pts[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    rest -= len;
  }
  return line.pts[line.pts.length - 1];
}

/** @param {CanvasRenderingContext2D} g @param {Line} line @param {number} upTo */
function drawPartial(g, line, upTo) {
  g.beginPath();
  g.moveTo(line.pts[0][0], line.pts[0][1]);
  let rest = upTo;
  for (let i = 0; i < line.lens.length; i += 1) {
    const len = line.lens[i];
    const b = line.pts[i + 1];
    if (rest >= len) {
      g.lineTo(b[0], b[1]);
      rest -= len;
    } else {
      const a = line.pts[i];
      const t = len ? rest / len : 0;
      g.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      break;
    }
  }
  g.stroke();
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/** Deterministic so a resize of the same width redraws the same board. */
function seeded(seed) {
  let s = Math.floor(seed) % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
