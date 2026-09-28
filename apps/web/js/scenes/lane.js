/* ==========================================================================
   Direct+ lane: every chunk accounted for

   A file of 48 chunks crosses from the sender's grid to the receiver's.
   Up to eight are in flight at once, each on its own track; every arrival
   sends an ACK back and lights the chunk on both sides. One chunk is lost on
   the way and resent, one arrives damaged, fails its hash and is asked for
   again. Halfway through the transfer pauses and resumes from where it
   stopped. When the last chunk is verified the receipt prints. Then it runs
   again, only while on screen.
   ========================================================================== */

import { reducedMotion, sleep, whileVisible, typeInto } from './util.js';

const TOTAL = 48;
const COLS = 8;
const ROWS = 6;
const WINDOW = 8;
const LOST = 13;
const DAMAGED = 34;
const PAUSE_AT = 24;
const HASH = '9f2c71ab e04d5c18 a6e30b7f 4d92e41a';

const C = {
  jade: '#8fd1a9',
  jadeDeep: '#2f6f52',
  gold: '#dcb877',
  bone: 'rgba(241, 237, 229, ',
  red: '#ef8a73',
};

/** @param {HTMLElement} root */
export function initLane(root) {
  const canvas = root.querySelector('[data-lane-canvas]');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const out = {
    acked: root.querySelector('[data-lane-acked]'),
    flight: root.querySelector('[data-lane-flight]'),
    retries: root.querySelector('[data-lane-retries]'),
    health: root.querySelector('[data-lane-health]'),
    gauge: root.querySelector('[data-lane-gauge]'),
    status: root.querySelector('[data-lane-status]'),
    hash: root.querySelector('[data-lane-hash]'),
  };
  const set = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

  let W = 0;
  let H = 0;
  let dpr = 1;
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = box.width;
    H = box.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };

  /** Geometry, recomputed each frame from the canvas size. */
  const geo = () => {
    const pad = Math.max(12, W * 0.02);
    const gridW = Math.min(W * 0.25, 300);
    const cell = Math.min((gridW - (COLS - 1) * 5) / COLS, (H - pad * 2 - (ROWS - 1) * 5) / ROWS);
    const gw = cell * COLS + (COLS - 1) * 5;
    const gh = cell * ROWS + (ROWS - 1) * 5;
    const top = (H - gh) / 2;
    const left = pad;
    const right = W - pad - gw;
    const laneX0 = left + gw + W * 0.04;
    const laneX1 = right - W * 0.04;
    return { cell, gw, gh, top, left, right, laneX0, laneX1 };
  };
  const cellXY = (g, i, side) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x0 = side === 'send' ? g.left : g.right;
    return [x0 + col * (g.cell + 5), g.top + row * (g.cell + 5)];
  };
  const trackY = (g, k) => g.top + (g.gh * (k + 0.5)) / WINDOW;

  /** @type {{ send: string[], recv: string[], flash: number[], flights: any[], acks: any[], debris: any[], retries: number, acked: number, paused: boolean, health: number }} */
  let S;
  const reset = () => {
    S = {
      send: Array(TOTAL).fill('queued'),
      recv: Array(TOTAL).fill('empty'),
      flash: Array(TOTAL).fill(0),
      flights: [],
      acks: [],
      debris: [],
      retries: 0,
      acked: 0,
      paused: false,
      health: 100,
    };
  };
  reset();

  const draw = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = geo();

    // Tracks and the return line.
    ctx.lineWidth = 1;
    for (let k = 0; k < WINDOW; k += 1) {
      const y = trackY(g, k);
      ctx.strokeStyle = `${C.bone}0.06)`;
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(g.laneX0, y);
      ctx.lineTo(g.laneX1, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Grids.
    for (const side of ['send', 'recv']) {
      for (let i = 0; i < TOTAL; i += 1) {
        const [x, y] = cellXY(g, i, side);
        const st = side === 'send' ? S.send[i] : S.recv[i];
        const flash = Math.max(0, 1 - (now - S.flash[i]) / 700);
        roundRect(ctx, x, y, g.cell, g.cell, Math.min(6, g.cell * 0.22));
        if (st === 'acked' || st === 'ok') {
          ctx.fillStyle = side === 'recv' ? C.jade : 'rgba(143, 209, 169, 0.55)';
          ctx.shadowColor = 'rgba(143, 209, 169, 0.7)';
          ctx.shadowBlur = side === 'recv' ? 6 + flash * 18 : 0;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (st === 'queued') {
          ctx.fillStyle = `${C.bone}0.16)`;
          ctx.fill();
        } else if (st === 'sent') {
          ctx.strokeStyle = `${C.bone}0.28)`;
          ctx.stroke();
        } else if (st === 'retry') {
          ctx.fillStyle = 'rgba(220, 184, 119, 0.28)';
          ctx.fill();
          ctx.strokeStyle = C.gold;
          ctx.stroke();
        } else if (st === 'bad' || st === 'lost') {
          ctx.fillStyle = `rgba(239, 138, 115, ${0.25 + flash * 0.5})`;
          ctx.fill();
          ctx.strokeStyle = C.red;
          ctx.stroke();
        } else {
          ctx.strokeStyle = `${C.bone}0.1)`;
          ctx.stroke();
        }
        if (side === 'recv' && st === 'ok' && g.cell > 14) tick(ctx, x + g.cell / 2, y + g.cell / 2, g.cell * 0.22, '#0d1912');
      }
    }

    // Chunks in flight, with a short glowing wake.
    for (const f of S.flights) {
      const p = Math.min(1, (now - f.t0) / f.dur);
      const y = trackY(g, f.track);
      const x = g.laneX0 + (g.laneX1 - g.laneX0) * p;
      const s = Math.max(8, g.cell * 0.72);
      const lost = f.fate === 'lost' && p > 0.55;
      if (lost) continue;
      const grad = ctx.createLinearGradient(x - 70, y, x, y);
      const hue = f.retry ? 'rgba(220, 184, 119,' : 'rgba(143, 209, 169,';
      grad.addColorStop(0, `${hue}0)`);
      grad.addColorStop(1, `${hue}0.45)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.max(g.laneX0, x - 70), y);
      ctx.lineTo(x - s / 2, y);
      ctx.stroke();
      roundRect(ctx, x - s / 2, y - s / 2, s, s, 4);
      ctx.fillStyle = f.retry ? C.gold : '#e9f7ee';
      ctx.shadowColor = f.retry ? 'rgba(220, 184, 119, 0.9)' : 'rgba(143, 209, 169, 0.9)';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Lost chunks tumbling out of the lane.
    for (const d of S.debris) {
      const t = (now - d.t0) / 900;
      if (t > 1) continue;
      const s = Math.max(8, g.cell * 0.72) * (1 - t * 0.4);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(d.x, trackY(g, d.track) + t * t * 60);
      ctx.rotate(t * 1.6);
      roundRect(ctx, -s / 2, -s / 2, s, s, 3);
      ctx.fillStyle = C.red;
      ctx.fill();
      ctx.restore();
    }
    S.debris = S.debris.filter((d) => now - d.t0 < 900);

    // ACKs (and one NACK) running back to the sender.
    const ackY = g.top + g.gh + Math.min(14, (H - g.top - g.gh) * 0.5);
    ctx.strokeStyle = `${C.bone}0.08)`;
    ctx.beginPath();
    ctx.moveTo(g.laneX0, ackY);
    ctx.lineTo(g.laneX1, ackY);
    ctx.stroke();
    for (const a of S.acks) {
      const p = Math.min(1, (now - a.t0) / a.dur);
      const x = g.laneX1 - (g.laneX1 - g.laneX0) * p;
      ctx.fillStyle = a.ok ? C.jade : C.red;
      ctx.shadowColor = a.ok ? 'rgba(143, 209, 169, 0.9)' : 'rgba(239, 138, 115, 0.9)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, ackY, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  const updateStats = () => {
    set(out.acked, `${S.acked}/${TOTAL}`);
    set(out.flight, String(S.flights.length));
    set(out.retries, String(S.retries));
    set(out.health, S.acked ? String(Math.round(S.health)) : '—');
    if (out.gauge instanceof SVGElement) out.gauge.style.strokeDasharray = `${(S.acked ? S.health : 0) / 100} 1`;
  };

  let run = 0;
  let raf = 0;
  let on = false;

  const frame = (now) => {
    raf = 0;
    if (!on) return;
    step(now);
    draw(now);
    updateStats();
    raf = requestAnimationFrame(frame);
  };

  /** Advances flights and acks; the transfer logic lives here. */
  const step = (now) => {
    for (const f of [...S.flights]) {
      const p = (now - f.t0) / f.dur;
      if (f.fate === 'lost' && p > 0.55 && !f.gone) {
        f.gone = true;
        const g = geo();
        S.debris.push({ x: g.laneX0 + (g.laneX1 - g.laneX0) * 0.55, track: f.track, t0: now });
        S.flights.splice(S.flights.indexOf(f), 1);
        S.send[f.i] = 'lost';
        S.flash[f.i] = now;
        S.retries += 1;
        S.health -= 1.5;
        later(700, () => { S.send[f.i] = 'retry'; queue.unshift({ i: f.i, retry: true }); });
        continue;
      }
      if (p < 1) continue;
      S.flights.splice(S.flights.indexOf(f), 1);
      S.flash[f.i] = now;
      if (f.fate === 'bad') {
        S.recv[f.i] = 'bad';
        S.retries += 1;
        S.health -= 1.5;
        S.acks.push({ t0: now, dur: 650, ok: false, i: f.i });
      } else {
        S.recv[f.i] = 'ok';
        S.acks.push({ t0: now, dur: 650, ok: true, i: f.i });
      }
    }
    for (const a of [...S.acks]) {
      if (now - a.t0 < a.dur) continue;
      S.acks.splice(S.acks.indexOf(a), 1);
      if (a.ok) {
        S.send[a.i] = 'acked';
        S.acked += 1;
      } else {
        S.send[a.i] = 'retry';
        queue.unshift({ i: a.i, retry: true });
      }
    }
  };

  /** @type {{ i: number, retry: boolean }[]} */
  let queue = [];
  const timers = new Set();
  const later = (ms, fn) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };

  const play = async () => {
    const id = ++run;
    const alive = () => id === run && on;
    reset();
    queue = Array.from({ length: TOTAL }, (_, i) => ({ i, retry: false }));
    root.classList.remove('is-complete');
    set(out.hash, '');
    set(out.status, 'Streaming');
    await sleep(500);
    let tracks = 0;
    let pausedOnce = false;
    while (alive() && S.acked < TOTAL) {
      if (!pausedOnce && S.acked >= PAUSE_AT) {
        pausedOnce = true;
        set(out.status, `Paused · ${S.acked} of ${TOTAL} kept`);
        root.classList.add('is-paused');
        while (alive() && S.flights.length) await sleep(60);
        await sleep(1300);
        if (!alive()) return;
        root.classList.remove('is-paused');
        set(out.status, `Resumed from chunk ${S.acked + 1}`);
        later(1800, () => set(out.status, 'Streaming'));
      }
      if (S.flights.length < WINDOW && queue.length) {
        const next = /** @type {{ i: number, retry: boolean }} */ (queue.shift());
        S.send[next.i] = 'sent';
        const fate = next.retry ? 'ok' : next.i === LOST ? 'lost' : next.i === DAMAGED ? 'bad' : 'ok';
        const used = new Set(S.flights.map((f) => f.track));
        let track = tracks++ % WINDOW;
        while (used.has(track)) track = (track + 1) % WINDOW;
        S.flights.push({ i: next.i, t0: performance.now(), dur: 880 + Math.random() * 260, track, fate, retry: next.retry });
        await sleep(95);
      } else {
        await sleep(40);
      }
    }
    if (!alive()) return;
    while (alive() && (S.flights.length || S.acks.length)) await sleep(60);
    set(out.status, 'Verifying root hash');
    await sleep(700);
    if (!alive()) return;
    S.health = 97;
    set(out.status, 'Verified');
    root.classList.add('is-complete');
    await typeInto(out.hash, HASH, 18, alive);
    await sleep(4200);
    if (alive()) void play();
  };

  const finished = () => {
    reset();
    S.send.fill('acked');
    S.recv.fill('ok');
    S.acked = TOTAL;
    S.retries = 2;
    S.health = 97;
    root.classList.add('is-complete');
    set(out.status, 'Verified');
    set(out.hash, HASH);
    resize();
    draw(performance.now() + 10000);
    updateStats();
  };

  new ResizeObserver(() => {
    resize();
    if (!on) draw(performance.now() + 10000);
  }).observe(canvas);

  if (reducedMotion()) {
    finished();
    return;
  }
  resize();
  draw(performance.now());
  whileVisible(root, () => {
    on = true;
    if (!raf) raf = requestAnimationFrame(frame);
    void play();
  }, () => {
    on = false;
    run += 1;
    timers.forEach(clearTimeout);
    timers.clear();
  }, 0.3);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tick(ctx, x, y, s, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, s * 0.38);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s * 0.25, y + s * 0.75);
  ctx.lineTo(x + s, y - s * 0.7);
  ctx.stroke();
  ctx.lineCap = 'butt';
}
