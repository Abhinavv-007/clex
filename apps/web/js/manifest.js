/* ==========================================================================
   Clex — the manifest

   The backdrop of the hero and the page heads. A file on its way through
   Clex is a list of chunks, and this is that list drawn as a field of cells:
   a quiet grid at rest, and every few seconds a file arriving in it. Its
   chunks land in order, each one lighting as it is acknowledged; a few go
   missing and are asked for again; when the last one is in, the file is
   checked end to end and turns gold, with its name and chunk count written
   above it, and then it clears. It is what Direct+ does on every transfer,
   at the pace of a background.

   Cells behind the headline, the copy and the buttons stay empty, so the
   field only lives in the margins and never under text. Nothing follows the
   pointer. One 2D canvas: the resting grid is drawn once per resize and
   each frame redraws only the files in flight. It sleeps off screen and in
   background tabs, and under reduced motion it is one still frame.
   ========================================================================== */

import { reducedMotion } from './motion.js';

/** Files that pass through. */
const FILES = [
  'holiday.heic', 'contract-signed.pdf', 'demo-final.mov', 'thesis-v7.docx',
  'photos-sept.zip', 'track-03.wav', 'invoice-0142.pdf', 'brand-kit.fig',
  'scan-0914.pdf', 'keynote.key', 'dataset.csv', 'build-arm64.dmg',
];

const ARRIVE_MS = 320;
const VERIFY_MS = 650;
const HOLD_MS = 2300;
const FADE_MS = 1100;
const LABEL = '500 10.5px "Geist Mono", ui-monospace, monospace';

/**
 * @typedef {{ c0: number, r0: number, w: number, h: number, n: number,
 *   name: string, t0: number, at: Float32Array, lost: Uint8Array,
 *   retry: Float32Array, done: number, end: number }} File
 */

export function initManifest() {
  document.querySelectorAll('canvas[data-manifest]').forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) createManifest(canvas);
  });
}

/** @param {HTMLCanvasElement} canvas */
function createManifest(canvas) {
  const ctx = canvas.getContext('2d');
  const stage = canvas.parentElement;
  if (!ctx || !stage) return;

  const soft = canvas.dataset.manifest === 'soft';
  const still = reducedMotion();
  const rand = mulberry(soft ? 11 : 5);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let pitch = 22;
  let size = 15;
  let cols = 0;
  let rows = 0;
  let ox = 0;
  let oy = 0;
  /** How much room each cell has, 0 under text to 1 in open margin. */
  let room = new Float32Array(0);
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  /** @type {Record<string, string>} */
  let ink = {};
  let dark = false;
  /** @type {File[]} */
  let files = [];
  let nextSpawn = 0;
  let running = false;
  let visible = true;
  let raf = 0;

  const cellX = (c) => ox + c * pitch;
  const cellY = (r) => oy + r * pitch;

  const readInk = () => {
    dark = document.documentElement.dataset.theme === 'dark';
    const css = getComputedStyle(stage);
    const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    ink = {
      line: dark ? '241, 237, 229' : '28, 27, 24',
      jade: rgb(pick('--jade', '#2e6a4f')),
      jadeHi: rgb(pick('--jade-hi', '#3f8a67')),
      gold: rgb(pick('--gold', '#9c7a36')),
      rose: rgb(pick('--rose', '#c06c55')),
      text: rgb(pick('--ink-3', '#6b665c')),
    };
  };

  /** Where the text is, so the field can stay out from under it. */
  const measureRoom = () => {
    const box = canvas.getBoundingClientRect();
    const content = stage.querySelector('.hero__inner, .page-head__inner');
    const rects = content
      ? [...content.children].map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height)
      : [];
    const pad = 14;
    const reach = soft ? 140 : 180;
    const top = soft ? 96 : 104; // under the floating nav
    room = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = cellX(c) + size / 2 + box.left;
        const y = cellY(r) + size / 2 + box.top;
        let d = Infinity;
        for (const t of rects) {
          const dx = Math.max(t.left - pad - x, 0, x - t.right - pad);
          const dy = Math.max(t.top - pad - y, 0, y - t.bottom - pad);
          d = Math.min(d, Math.hypot(dx, dy));
        }
        const lx = x - box.left;
        const ly = y - box.top;
        const edge = smooth(top, top + 70, ly) * smooth(H, H - 56, ly) * smooth(0, 36, lx) * smooth(W, W - 36, lx);
        room[r * cols + c] = smooth(0, reach, d) * edge;
      }
    }
  };

  /** The grid at rest: hairline cells, fading out toward the text. */
  const drawBase = () => {
    if (!bctx) return;
    base.width = canvas.width;
    base.height = canvas.height;
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);
    bctx.lineWidth = 1;
    const rest = dark ? 0.06 : 0.068;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const k = room[r * cols + c];
        if (k < 0.02) continue;
        bctx.strokeStyle = `rgba(${ink.line}, ${(rest * k).toFixed(3)})`;
        cell(bctx, cellX(c) + 0.5, cellY(r) + 0.5, size - 1, 1);
        bctx.stroke();
      }
    }
  };

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(box.width));
    H = Math.max(1, Math.round(box.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const small = W < 700;
    pitch = small ? 17 : 22;
    size = small ? 12 : 15;
    const grid = `${cols}x${rows}`;
    cols = Math.ceil(W / pitch) + 1;
    rows = Math.ceil(H / pitch) + 1;
    ox = Math.round((W - (cols - 1) * pitch - size) / 2);
    oy = Math.round((H - (rows - 1) * pitch - size) / 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    measureRoom();
    drawBase();
    // Files placed on a different grid would sit in the wrong cells.
    if (grid !== `${cols}x${rows}`) files = [];
  };

  /** Finds open margin for a new file and schedules its chunks. */
  const spawn = (now) => {
    const small = W < 700;
    const name = FILES[Math.floor(rand() * FILES.length)];
    ctx.font = LABEL;
    const labelCells = Math.ceil((ctx.measureText(`${name}  000/000  verified`).width + 6) / pitch);
    const w = Math.max(labelCells, Math.round((small ? 5 : 7) + rand() * (small ? 4 : 8)));
    const h = Math.round((small ? 2 : 3) + rand() * (small ? 2 : 3));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const c0 = 1 + Math.floor(rand() * Math.max(1, cols - w - 2));
      const r0 = 2 + Math.floor(rand() * Math.max(1, rows - h - 3));
      if (!open(c0, r0 - 1, w, h + 1)) continue;
      if (files.some((f) => c0 < f.c0 + f.w + 3 && f.c0 < c0 + w + 3 && r0 - 1 < f.r0 + f.h + 2 && f.r0 - 1 < r0 + h + 2)) continue;
      const n = w * h;
      const span = Math.min(3600, 1300 + n * 34 + rand() * 500);
      const step = span / n;
      const at = new Float32Array(n);
      const lost = new Uint8Array(n);
      const retry = new Float32Array(n);
      let last = 0;
      for (let i = 0; i < n; i += 1) {
        at[i] = 380 + i * step + rand() * step * 2.2;
        lost[i] = rand() < 0.05 ? 1 : 0;
        last = Math.max(last, at[i]);
      }
      // Missing chunks are asked for again once the first pass is through.
      let k = 0;
      for (let i = 0; i < n; i += 1) {
        if (!lost[i]) continue;
        retry[i] = last + 280 + k * 140;
        last = Math.max(last, retry[i]);
        k += 1;
      }
      const done = last + ARRIVE_MS;
      files.push({ c0, r0, w, h, n, name, t0: now, at, lost, retry, done, end: done + VERIFY_MS + HOLD_MS + FADE_MS });
      return true;
    }
    return false;
  };

  /** Is every cell of this block in open margin? */
  const open = (c0, r0, w, h) => {
    if (c0 < 0 || r0 < 0 || c0 + w > cols || r0 + h > rows) return false;
    for (let r = r0; r < r0 + h; r += 1) {
      for (let c = c0; c < c0 + w; c += 1) {
        if (room[r * cols + c] < 0.6) return false;
      }
    }
    return true;
  };

  /** @param {File} f @param {number} now */
  const drawFile = (f, now) => {
    const t = now - f.t0;
    const fade = 1 - clamp01((t - (f.end - FADE_MS)) / FADE_MS);
    const appear = clamp01(t / 400);
    let received = 0;

    for (let i = 0; i < f.n; i += 1) {
      const c = f.c0 + (i % f.w);
      const r = f.r0 + Math.floor(i / f.w);
      const k = room[r * cols + c] * fade;
      const x = cellX(c);
      const y = cellY(r);
      // The file's footprint appears before its chunks do.
      if (appear > 0) {
        ctx.strokeStyle = `rgba(${ink.line}, ${((dark ? 0.12 : 0.14) * appear * k).toFixed(3)})`;
        cell(ctx, x + 0.5, y + 0.5, size - 1, 1);
        ctx.stroke();
      }

      const arrive = f.lost[i] ? f.retry[i] : f.at[i];
      if (f.lost[i] && t >= f.at[i] && t < f.retry[i]) {
        // Went missing: a red flash, then an outline waiting for the retry.
        const p = clamp01((t - f.at[i]) / 600);
        ctx.fillStyle = `rgba(${ink.rose}, ${((0.75 - p * 0.6) * k).toFixed(3)})`;
        cell(ctx, x, y, size, 1);
        ctx.fill();
        ctx.strokeStyle = `rgba(${ink.rose}, ${(0.7 * k).toFixed(3)})`;
        cell(ctx, x + 0.5, y + 0.5, size - 1, 1);
        ctx.stroke();
        continue;
      }
      if (t < arrive) continue;
      received += 1;

      // Landing: it drops in slightly large and bright, then settles.
      const p = clamp01((t - arrive) / ARRIVE_MS);
      const s = 1 + (1 - easeOut(p)) * 0.28;
      const verifyAt = f.done + ((i % f.w) / f.w) * (VERIFY_MS * 0.8);
      const v = clamp01((t - verifyAt) / 420);
      let colour = p < 1 ? ink.jadeHi : ink.jade;
      let a = (dark ? 0.5 : 0.42) + (1 - p) * 0.45;
      if (v > 0) {
        colour = ink.gold;
        a = (dark ? 0.46 : 0.4) + (1 - easeOut(v)) * 0.45;
      }
      ctx.fillStyle = `rgba(${colour}, ${(a * k).toFixed(3)})`;
      cell(ctx, x + (size - size * s) / 2, y + (size - size * s) / 2, size * s, s);
      ctx.fill();
    }

    // The manifest line: name, then chunks counted in, then verified.
    const verified = t >= f.done + VERIFY_MS * 0.8;
    const la = appear * fade * room[(f.r0 - 1) * cols + f.c0];
    if (la > 0.01) {
      ctx.font = LABEL;
      ctx.textBaseline = 'alphabetic';
      const x = cellX(f.c0);
      const y = cellY(f.r0) - 7;
      ctx.fillStyle = `rgba(${ink.text}, ${(0.95 * la).toFixed(3)})`;
      ctx.fillText(f.name, x, y);
      const after = x + ctx.measureText(`${f.name}  `).width;
      const count = `${String(received).padStart(String(f.n).length, '0')}/${f.n}`;
      ctx.fillStyle = `rgba(${verified ? ink.gold : ink.jade}, ${la.toFixed(3)})`;
      ctx.fillText(verified ? `${f.n}/${f.n}  verified` : count, after, y);
    }
  };

  const draw = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    files = files.filter((f) => now - f.t0 < f.end);
    const most = W < 700 ? 2 : soft ? 2 : 3;
    if (!still && now >= nextSpawn && files.length < most) {
      spawn(now);
      nextSpawn = now + 1400 + rand() * 1800;
    }
    ctx.lineWidth = 1;
    for (const f of files) drawFile(f, now);
  };

  /** Reduced motion: one file verified and one on its way, held still. */
  const drawStill = () => {
    const now = 100000;
    files = [];
    if (spawn(now - 5200)) {
      const f = files[0];
      f.t0 = now - (f.done + VERIFY_MS + 400);
    }
    if (spawn(now)) {
      const f = files[files.length - 1];
      f.t0 = now - f.done * 0.55;
    }
    draw(now);
  };

  const loop = (now) => {
    raf = 0;
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  };

  const sync = () => {
    const next = visible && !document.hidden && !still;
    if (next === running) return;
    running = next;
    if (running && !raf) raf = requestAnimationFrame(loop);
  };

  const refresh = () => {
    resize();
    if (still) drawStill();
    else if (!running) draw(performance.now());
  };

  readInk();
  resize();
  nextSpawn = performance.now() + (soft ? 500 : 900);
  if (still) drawStill();
  canvas.classList.add('is-live');

  let pending = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(refresh);
  }).observe(stage);
  // The headline's size depends on the heading font.
  document.fonts?.ready.then(refresh);
  // Copy that rises into place ends up a little higher than it started.
  window.setTimeout(refresh, 1600);

  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('clex:theme', () => {
    readInk();
    drawBase();
    if (still) drawStill();
    else if (!running) draw(performance.now());
  });
  // When the headline's word is written, a file comes in right behind it.
  stage.addEventListener('clex:ink-written', () => {
    nextSpawn = Math.min(nextSpawn, performance.now() + 120);
  });

  sync();
}

/** A rounded cell. */
function cell(ctx, x, y, s, scale) {
  const r = 3 * scale;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, s, s, r);
  else ctx.rect(x, y, s, s);
}

/** '#2e6a4f' or 'rgb(46 106 79)' → '46, 106, 79' */
function rgb(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
  }
  const nums = value.match(/[\d.]+/g);
  return nums && nums.length >= 3 ? nums.slice(0, 3).join(', ') : '128, 128, 128';
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
