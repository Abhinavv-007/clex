/* ==========================================================================
   Clex — scenes

   The illustrations that explain the product by doing it. Each one is plain
   markup marked with a data attribute; this module drives it only while it is
   on screen. With reduced motion every scene is shown in its finished state.
   ========================================================================== */

import { reducedMotion, countUp } from './motion.js';
import { writeWord } from './ink.js';

export function initScenes() {
  document.querySelectorAll('[data-flow]').forEach((el) => initFlow(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('[data-chunks]').forEach((el) => initChunks(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('[data-cipher]').forEach((el) => initCipher(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('[data-chain-demo]').forEach((el) => initChainDemo(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('[data-terminal]').forEach((el) => initTerminal(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('[data-chain-stats]').forEach((el) => initChainStats(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('[data-scrub]').forEach((el) => initScrub(/** @type {HTMLElement} */ (el)));
  document.querySelectorAll('canvas[data-globe]').forEach((el) => initGlobe(/** @type {HTMLCanvasElement} */ (el)));
  document.querySelectorAll('.stage').forEach((el) => initTilt(/** @type {HTMLElement} */ (el)));
}

/* ── Statement: words light up as you scroll ─────────────────────────────
   The section is tall and its line is pinned; scrolling through it lights
   the words one by one, and the handwritten phrase at the end is written
   once everything before it is lit. */

/** @param {HTMLElement} root */
function initScrub(root) {
  const text = root.querySelector('[data-scrub-text]');
  if (!(text instanceof HTMLElement)) return;

  const words = [];
  for (const node of [...text.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const frag = document.createDocumentFragment();
    for (const part of (node.textContent || '').split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(document.createTextNode(' '));
      } else {
        const span = document.createElement('span');
        span.className = 'sw';
        span.textContent = part;
        words.push(span);
        frag.append(span);
      }
    }
    node.replaceWith(frag);
  }
  const ink = text.querySelector('.ink-word');
  let written = false;

  if (reducedMotion()) {
    if (ink) writeWord(ink);
    return;
  }

  let frame = 0;
  const update = () => {
    frame = 0;
    const box = root.getBoundingClientRect();
    const travel = Math.max(1, box.height - window.innerHeight);
    const p = Math.min(1, Math.max(0, -box.top / travel));
    const lit = p * (words.length + 3);
    words.forEach((w, i) => {
      const o = 0.13 + 0.87 * Math.min(1, Math.max(0, lit - i));
      w.style.opacity = o.toFixed(3);
    });
    if (!written && ink && lit >= words.length + 0.5) {
      written = true;
      writeWord(ink);
    }
  };
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(update);
  }, { passive: true });
  update();
}

/* ── Tilt: the flow stage leans toward the pointer ───────────────────── */

/** @param {HTMLElement} el */
function initTilt(el) {
  if (reducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
  el.addEventListener('pointermove', (event) => {
    const box = el.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    el.style.setProperty('--ty', `${(x * 7).toFixed(2)}deg`);
    el.style.setProperty('--tx', `${(-y * 6).toFixed(2)}deg`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--ty', '0deg');
    el.style.setProperty('--tx', '0deg');
  });
}

/* ── Globe: the Direct route, across the world ──────────────────────────
   A dotted globe sways gently. Two browsers light up on it; a STUN server
   in orbit answers a brief hello from each, then an arc rises between them
   and packets run along it — the data never visits the server. */

/** @param {HTMLCanvasElement} canvas */
function initGlobe(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const still = reducedMotion();

  const N = window.matchMedia('(max-width: 700px)').matches ? 700 : 1200;
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i += 1) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  const ll = (lat, lon) => {
    const a = (lat * Math.PI) / 180;
    const b = (lon * Math.PI) / 180;
    return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
  };
  const A = ll(14, -46);
  const B = ll(24, 44);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let colors = read();
  function read() {
    const st = getComputedStyle(canvas);
    return { ink: st.getPropertyValue('--ink-3').trim() || '#6b665c', mono: st.getPropertyValue('--font-mono').trim() || 'monospace' };
  }
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = box.width;
    H = box.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };

  const rotate = ([x, y, z], ry, rx) => {
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const cx = Math.cos(rx);
    const sx = Math.sin(rx);
    return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
  };
  const slerp = (a, b, t) => {
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const om = Math.acos(Math.min(1, Math.max(-1, dot)));
    const so = Math.sin(om) || 1;
    const k1 = Math.sin((1 - t) * om) / so;
    const k2 = Math.sin(t * om) / so;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  };

  const draw = (now) => {
    const t = still ? 2 : now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // A big dome rising from the bottom edge: a horizon, not a marble.
    const R = Math.min(W * 0.46, H * 0.72);
    const cx = W / 2;
    const cy = H * 0.5 + R * 0.62;
    const ry = Math.sin(t * 0.22) * 0.28;
    const rx = -0.22;
    const proj = (p) => [cx + p[0] * R, cy - p[1] * R, p[2]];

    // Sphere of dots, the far side barely there.
    for (const p of pts) {
      const q = rotate(p, ry, rx);
      const [x, y, z] = proj(q);
      const a = z > 0 ? 0.18 + z * 0.5 : 0.06;
      ctx.globalAlpha = a;
      ctx.fillStyle = colors.ink;
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    const pa = proj(rotate(A, ry, rx));
    const pb = proj(rotate(B, ry, rx));

    // The STUN hello: a short exchange with a server in orbit, each cycle.
    const cycle = (t % 6) / 6;
    const stun = [cx, Math.max(22, cy - R * 1.2)];
    if (cycle < 0.28) {
      const k = Math.sin((cycle / 0.28) * Math.PI);
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = `rgba(199, 160, 89, ${0.6 * k})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(stun[0], stun[1]);
      ctx.moveTo(pb[0], pb[1]);
      ctx.lineTo(stun[0], stun[1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(199, 160, 89, 0.9)';
    ctx.beginPath();
    ctx.arc(stun[0], stun[1], 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `9px ${colors.mono}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.ink;
    ctx.fillText('STUN', stun[0], stun[1] - 8);

    // The arc between the two browsers, lifted off the surface.
    const arc = [];
    for (let i = 0; i <= 48; i += 1) {
      const s = i / 48;
      const g = slerp(A, B, s);
      const lift = 1 + Math.sin(s * Math.PI) * 0.32;
      arc.push(proj(rotate([g[0] * lift, g[1] * lift, g[2] * lift], ry, rx)));
    }
    const grad = ctx.createLinearGradient(pa[0], pa[1], pb[0], pb[1]);
    grad.addColorStop(0, '#46a077');
    grad.addColorStop(1, '#c7a059');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(70, 160, 119, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    arc.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();

    // Packets riding the arc.
    for (let k = 0; k < 3; k += 1) {
      const s = ((t * 0.45 + k / 3) % 1);
      const i = Math.floor(s * 48);
      const [x, y] = arc[i];
      ctx.fillStyle = '#e9fbef';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // The two browsers.
    for (const [p, label] of [[pa, 'you'], [pb, 'them']]) {
      const pulse = (t * 0.8) % 1;
      ctx.strokeStyle = `rgba(70, 160, 119, ${1 - pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#46a077';
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.ink;
      ctx.fillText(label.toUpperCase(), p[0], p[1] + 20);
    }
  };

  let raf = 0;
  let on = false;
  const loop = (now) => {
    raf = 0;
    if (!on) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  resize();
  draw(performance.now());
  new ResizeObserver(() => { resize(); draw(performance.now()); }).observe(canvas);
  window.addEventListener('clex:theme', () => requestAnimationFrame(() => { colors = read(); draw(performance.now()); }));
  if (still) return;
  whileVisible(canvas, () => {
    on = true;
    if (!raf) raf = requestAnimationFrame(loop);
  }, () => { on = false; }, 0.1);
}

/**
 * Runs `start` while the element is on screen and `stop` when it leaves.
 * @param {Element} el @param {() => void} start @param {() => void} stop
 */
function whileVisible(el, start, stop, threshold = 0.25) {
  let on = false;
  const set = (next) => {
    if (next === on) return;
    on = next;
    if (on) start();
    else stop();
  };
  const io = new IntersectionObserver((entries) => {
    set(entries.some((e) => e.isIntersecting) && !document.hidden);
  }, { threshold });
  io.observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) set(false);
    else {
      const box = el.getBoundingClientRect();
      set(box.bottom > 0 && box.top < window.innerHeight);
    }
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── Flow: drop → prepare → share → verify ──────────────────────────────
   The steps scroll past; the stage beside them (sticky) acts each one out.
   The stage's data-step attribute is the whole state; CSS choreographs it. */

/** @param {HTMLElement} root */
function initFlow(root) {
  const stage = root.querySelector('[data-flow-stage]');
  const steps = [...root.querySelectorAll('[data-flow-step]')];
  if (!(stage instanceof HTMLElement) || !steps.length) return;

  const size = stage.querySelector('[data-flow-size]');
  const pct = stage.querySelector('[data-flow-pct]');
  let current = 0;

  const setStep = (n) => {
    if (n === current) return;
    const prev = current;
    current = n;
    stage.dataset.step = String(n);
    steps.forEach((s) => s.classList.toggle('is-active', Number(s.getAttribute('data-flow-step')) === n));

    if (size instanceof HTMLElement) {
      if (n >= 2 && prev < 2) {
        size.dataset.from = '4.2';
        size.dataset.decimals = '0';
        animateSize(size, 4200, 612);
      } else if (n < 2) {
        size.textContent = '4.2 MB';
      }
    }
    if (pct instanceof HTMLElement) {
      if (n >= 3 && prev < 3) {
        pct.dataset.from = '0';
        pct.dataset.suffix = '%';
        countUp(pct, 100);
      } else if (n < 3) {
        pct.textContent = '0%';
      }
    }
  };

  if (reducedMotion()) {
    setStep(steps.length);
    steps.forEach((s) => s.classList.add('is-active'));
    return;
  }

  // A step is active while it crosses the middle band of the viewport. On
  // narrow screens the stage sits pinned above the text, so the band moves
  // down to where the text is actually read.
  const narrow = window.matchMedia('(max-width: 899px)').matches;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) setStep(Number(entry.target.getAttribute('data-flow-step')));
    }
  }, { rootMargin: narrow ? '-70% 0px -22% 0px' : '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
  setStep(1);
}

/** Size in KB, shown as MB or KB. @param {HTMLElement} el */
function animateSize(el, fromKb, toKb) {
  const start = performance.now();
  const dur = 1300;
  const fmt = (kb) => (kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${Math.round(kb)} KB`);
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(fromKb + (toKb - fromKb) * e);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── Chunk map: Direct+ in miniature ────────────────────────────────────
   A file is 48 chunks. Up to 8 are in flight at once; each is acked as it
   lands. Two are lost on the way and retried. When the last one is verified,
   the receipt prints. Then it starts over. */

/** @param {HTMLElement} root */
function initChunks(root) {
  const grid = root.querySelector('[data-chunks-grid]');
  if (!(grid instanceof HTMLElement)) return;
  const total = Number(root.getAttribute('data-chunks')) || 48;
  const out = {
    done: root.querySelector('[data-chunks-done]'),
    retries: root.querySelector('[data-chunks-retries]'),
    health: root.querySelector('[data-chunks-health]'),
    bar: root.querySelector('[data-chunks-bar]'),
    receipt: root.querySelector('[data-chunks-receipt]'),
    hash: root.querySelector('[data-chunks-hash]'),
  };

  grid.textContent = '';
  const cells = Array.from({ length: total }, (_, i) => {
    const cell = document.createElement('span');
    cell.className = 'chunk';
    cell.style.setProperty('--i', String(i));
    grid.append(cell);
    return cell;
  });

  const HASH = '9f2c 71ab e04d 5c18 · a6e3 0b7f 4d92 e41a';
  let run = 0;

  const setText = (el, text) => { if (el) el.textContent = text; };

  const finishState = () => {
    cells.forEach((c) => { c.className = 'chunk is-acked'; });
    setText(out.done, `${total}/${total}`);
    setText(out.retries, '2');
    setText(out.health, '97');
    if (out.bar instanceof HTMLElement) out.bar.style.setProperty('--p', '1');
    root.classList.add('is-complete');
    setText(out.hash, HASH);
  };

  if (reducedMotion()) {
    finishState();
    return;
  }

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;

    root.classList.remove('is-complete');
    cells.forEach((c) => { c.className = 'chunk'; });
    setText(out.done, `0/${total}`);
    setText(out.retries, '0');
    setText(out.health, '—');
    setText(out.hash, '');
    if (out.bar instanceof HTMLElement) out.bar.style.setProperty('--p', '0');
    await sleep(500);

    const lost = new Set([Math.floor(total * 0.3), Math.floor(total * 0.68)]);
    let acked = 0;
    let retries = 0;
    let next = 0;
    /** @type {number[]} */
    const retryQueue = [];
    const WINDOW = 8;
    let inFlight = 0;

    const send = async (i, retry = false) => {
      inFlight += 1;
      cells[i].className = `chunk is-flight${retry ? ' is-retry' : ''}`;
      await sleep(260 + Math.random() * 380);
      if (!alive()) return;
      inFlight -= 1;
      if (!retry && lost.has(i)) {
        cells[i].className = 'chunk is-lost';
        retries += 1;
        setText(out.retries, String(retries));
        setTimeout(() => retryQueue.push(i), 520);
        return;
      }
      cells[i].className = 'chunk is-acked';
      acked += 1;
      setText(out.done, `${acked}/${total}`);
      setText(out.health, String(Math.max(90, 100 - retries * 1.5 - Math.round(Math.random() * 1))));
      if (out.bar instanceof HTMLElement) out.bar.style.setProperty('--p', String(acked / total));
    };

    while (acked < total && alive()) {
      while (inFlight < WINDOW && (retryQueue.length || next < total)) {
        if (retryQueue.length) void send(/** @type {number} */ (retryQueue.shift()), true);
        else void send(next++);
        await sleep(55);
        if (!alive()) return;
      }
      await sleep(60);
    }
    if (!alive()) return;

    setText(out.health, '97');
    await sleep(350);
    if (!alive()) return;
    root.classList.add('is-complete');
    await typeInto(out.hash, HASH, 22, alive);
    await sleep(3800);
    if (alive()) void play();
  };

  whileVisible(root, () => void play(), () => { run += 1; }, 0.35);
}

/**
 * @param {Element | null} el @param {string} text @param {number} speed
 * @param {() => boolean} alive
 */
async function typeInto(el, text, speed, alive) {
  if (!el) return;
  el.textContent = '';
  for (const ch of text) {
    if (!alive()) return;
    el.textContent += ch;
    await sleep(speed);
  }
}

/* ── Cipher: a note that encrypts itself ────────────────────────────────
   The plaintext scrambles into ciphertext left to right, holds, and comes
   back. It is what Vault does before a note is written to the device. */

const CIPHER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789+/=';

/** @param {HTMLElement} root */
function initCipher(root) {
  const target = root.querySelector('[data-cipher-text]');
  const state = root.querySelector('[data-cipher-state]');
  if (!(target instanceof HTMLElement)) return;
  const plain = target.textContent || '';
  const cipher = [...plain].map((ch) => (ch === ' ' || ch === '\n' ? ch : CIPHER_CHARS[(Math.random() * CIPHER_CHARS.length) | 0])).join('');
  let run = 0;

  if (reducedMotion()) return;

  const morph = async (from, to, alive) => {
    const len = Math.max(from.length, to.length);
    for (let edge = 0; edge <= len + 6; edge += 2) {
      if (!alive()) return;
      let s = '';
      for (let i = 0; i < len; i += 1) {
        const a = to[i] ?? '';
        if (a === ' ' || a === '\n') s += a;
        else if (i < edge - 6) s += a;
        else if (i < edge) s += CIPHER_CHARS[(Math.random() * CIPHER_CHARS.length) | 0];
        else s += from[i] ?? '';
      }
      target.textContent = s;
      await sleep(28);
    }
    target.textContent = to;
  };

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    target.textContent = plain;
    root.dataset.state = 'plain';
    await sleep(1600);
    while (alive()) {
      root.dataset.state = 'locking';
      if (state) state.textContent = 'Encrypting…';
      await morph(plain, cipher, alive);
      if (!alive()) return;
      root.dataset.state = 'locked';
      if (state) state.textContent = 'AES-GCM · on this device';
      await sleep(2400);
      if (!alive()) return;
      root.dataset.state = 'unlocking';
      if (state) state.textContent = 'Unlocking…';
      await morph(cipher, plain, alive);
      if (!alive()) return;
      root.dataset.state = 'plain';
      if (state) state.textContent = 'Only you can read this';
      await sleep(2600);
    }
  };

  whileVisible(root, () => void play(), () => {
    run += 1;
    target.textContent = plain;
    root.dataset.state = 'plain';
  });
}

/* ── Chain: records linking up ──────────────────────────────────────────
   A new record slides in every few seconds carrying the previous record's
   hash; the link between them draws itself. */

/** @param {HTMLElement} root */
function initChainDemo(root) {
  const track = root.querySelector('[data-chain-track]');
  if (!(track instanceof HTMLElement)) return;
  const routes = ['Direct', 'Local', 'Direct', 'Direct', 'Local'];
  const kinds = ['pdf · 2.4 MB', 'image · 612 KB', 'archive · 18 MB', 'document · 88 KB', 'video · 41 MB'];
  let index = 1024;
  let prev = randomHex(8);
  let timer = 0;

  const block = (animate) => {
    const hash = randomHex(8);
    const el = document.createElement('div');
    el.className = `chain-block${animate ? ' is-new' : ''}`;
    el.innerHTML = `
      <span class="chain-block__idx">#${index}</span>
      <span class="chain-block__row"><span>prev</span><code>${prev}</code></span>
      <span class="chain-block__row"><span>hash</span><code data-hash>${animate ? '········' : hash}</code></span>
      <span class="chain-block__meta">${routes[index % routes.length]} · ${kinds[index % kinds.length]}</span>`;
    prev = hash;
    index += 1;
    track.append(el);
    if (animate) {
      const code = el.querySelector('[data-hash]');
      scramble(code, hash, 700);
    }
    while (track.children.length > 4) track.firstElementChild?.remove();
  };

  for (let i = 0; i < 3; i += 1) block(false);
  if (reducedMotion()) return;

  whileVisible(root, () => {
    clearInterval(timer);
    timer = window.setInterval(() => block(true), 2800);
  }, () => clearInterval(timer));
}

/** @param {Element | null} el @param {string} final @param {number} ms */
function scramble(el, final, ms) {
  if (!el) return;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const fixed = Math.floor(final.length * t);
    el.textContent = final.slice(0, fixed) + randomHex(final.length - fixed);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function randomHex(n) {
  let s = '';
  for (let i = 0; i < n; i += 1) s += '0123456789abcdef'[(Math.random() * 16) | 0];
  return s;
}

/* ── Terminal ───────────────────────────────────────────────────────────
   <div data-terminal>
     <script type="application/json" data-terminal-script>[…]</script>
   Each entry is { cmd } (typed) or { out, tone } (printed). */

/** @param {HTMLElement} root */
function initTerminal(root) {
  const body = root.querySelector('[data-terminal-body]');
  const scriptEl = root.querySelector('[data-terminal-script]');
  if (!(body instanceof HTMLElement) || !scriptEl) return;
  /** @type {{ cmd?: string, out?: string, tone?: string, wait?: number }[]} */
  let lines = [];
  try { lines = JSON.parse(scriptEl.textContent || '[]'); } catch { return; }
  let run = 0;

  const render = (line, text) => {
    const row = document.createElement('div');
    row.className = line.cmd !== undefined ? 'term__line term__line--cmd' : `term__line term__out term__out--${line.tone || 'plain'}`;
    row.textContent = text;
    body.append(row);
    return row;
  };

  const finished = () => {
    body.textContent = '';
    lines.forEach((l) => render(l, l.cmd ?? l.out ?? ''));
  };

  if (reducedMotion()) {
    finished();
    return;
  }

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    body.textContent = '';
    for (const line of lines) {
      if (!alive()) return;
      if (line.cmd !== undefined) {
        const row = render(line, '');
        row.classList.add('is-typing');
        for (const ch of line.cmd) {
          if (!alive()) return;
          row.textContent += ch;
          await sleep(34 + Math.random() * 46);
        }
        row.classList.remove('is-typing');
        await sleep(380);
      } else {
        const row = render(line, line.out || '');
        row.classList.add('is-new');
        await sleep(line.wait ?? 420);
      }
    }
    await sleep(5200);
    if (alive()) void play();
  };

  whileVisible(root, () => void play(), () => { run += 1; finished(); }, 0.4);
}

/* ── Live chain numbers ─────────────────────────────────────────────────── */

/** @param {HTMLElement} root */
async function initChainStats(root) {
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
