/* ==========================================================================
   Receipts: print, tear, fly, chain

   The printer feeds a receipt out line by line, stamps it verified, cuts it
   off at the perforation (flecks of paper fall), and the receipt takes off:
   it rises, banks over in an arc with a comet trail behind it, and dives
   into the next slot of the chain below, squashing to the slot's shape so
   it becomes the newest block, linked to the one before by its hash. Sparks
   where it lands. Then the next transfer's receipt starts printing.
   ========================================================================== */

import { reducedMotion, sleep, whileVisible, randomHex } from './util.js';

const SIZES = ['2.4 MB', '612 KB', '18.1 MB', '88 KB', '41 MB'];
const KINDS = ['pdf', 'image', 'archive', 'document', 'video'];

/** @param {HTMLElement} root */
export function initReceiptScene(root) {
  const paper = root.querySelector('[data-paper]');
  const inner = paper?.querySelector('.paper__inner');
  const printer = root.querySelector('.printer');
  const chainEl = root.querySelector('[data-chain-line]');
  if (!(paper instanceof HTMLElement) || !(inner instanceof HTMLElement) || !(chainEl instanceof HTMLElement)) return;

  buildBars(root.querySelector('[data-paper-bars]'));
  const lines = /** @type {HTMLElement[]} */ ([...inner.children]);
  const r = (k) => inner.querySelector(`[data-r="${k}"]`);
  const set = (k, v) => { const el = r(k); if (el) el.textContent = v; };

  /** @returns {any} */
  const chain = () => /** @type {any} */ (chainEl).chainLine;

  const fillReceipt = (n) => {
    const now = new Date();
    const hash = randomHex(8);
    set('idx', `#${n}`);
    set('date', `${now.getDate()} ${now.toLocaleString('en', { month: 'short' })} ${now.getFullYear()} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    const k = n % KINDS.length;
    set('files', `1 · ${KINDS[k]}`);
    set('size', SIZES[k]);
    const chunks = [38, 10, 290, 2, 656][k];
    const retries = n % 3 === 0 ? 1 : 0;
    set('chunks', `${chunks}/${chunks} verified`);
    set('retries', String(retries));
    set('health', String(retries ? 96 : 98 + (n % 2)));
    set('hash', `${hash}…${randomHex(4)}`);
    return { hash, meta: `Direct · ${KINDS[k]} · ${SIZES[k]}` };
  };

  const fullHeight = () => inner.scrollHeight;

  if (reducedMotion()) {
    fillReceipt(1027);
    paper.style.setProperty('--fed', `${fullHeight()}px`);
    paper.classList.add('is-stamped');
    return;
  }

  let run = 0;
  let n = 1027;

  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    while (alive()) {
      const rec = fillReceipt(n);
      paper.classList.remove('is-stamped', 'is-cut');
      paper.getAnimations().forEach((a) => a.cancel());
      paper.style.opacity = '1';
      paper.style.setProperty('--fed', '0px');
      await sleep(500);
      if (!alive()) return;

      // Print: feed one line at a time.
      printer?.classList.add('is-printing');
      for (const line of lines) {
        const bottom = line.offsetTop + line.offsetHeight + 8;
        paper.style.setProperty('--fed', `${bottom}px`);
        await sleep(line.classList.contains('paper__bars') ? 320 : 150);
        if (!alive()) return;
      }
      paper.style.setProperty('--fed', `${fullHeight()}px`);
      printer?.classList.remove('is-printing');
      await sleep(250);
      paper.classList.add('is-stamped');
      await sleep(900);
      if (!alive()) return;

      // Tear at the perforation: the cutter flashes, flecks of paper fall.
      printer?.classList.add('is-cutting');
      paper.classList.add('is-cut');
      flecks(root, printer);
      await paper.animate(
        [{ transform: 'none' }, { transform: 'translateY(-14px) rotate(-2.5deg)' }],
        { duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
      ).finished.catch(() => {});
      printer?.classList.remove('is-cutting');
      if (!alive()) return;

      // Fly into the chain's next slot and become the block.
      const c = chain();
      const slot = c?.slot();
      if (slot instanceof HTMLElement) {
        slot.classList.add('is-target');
        await fly(root, paper, slot, () => {
          if (!alive()) return;
          const block = c.add({ hash: rec.hash, meta: rec.meta });
          block.classList.add('is-landed');
          sparks(root, slot);
          window.setTimeout(() => block.classList.add('is-verified'), 650);
        });
        slot.classList.remove('is-target');
        if (!alive()) return;
      }
      n += 1;
      await sleep(1600);
    }
  };

  const reset = () => {
    run += 1;
    paper.getAnimations().forEach((a) => a.cancel());
    paper.style.setProperty('--fed', '0px');
  };

  // The chain is started by its own module; wait for it before playing.
  const start = () => {
    if (chain()) void play();
    else window.setTimeout(start, 120);
  };
  whileVisible(root, start, reset, 0.35);
}

/** Flight time, ms. */
const FLIGHT = 1650;
/** How many poses the flight is sampled into. */
const POSES = 48;

/**
 * The receipt's flight: up off the printer, banking over in an arc, and down
 * into the slot, turning in 3D as it goes and squashing to the slot's own
 * shape on arrival so that it becomes the block. A comet trail follows it.
 *
 * @param {HTMLElement} stage
 * @param {HTMLElement} paper
 * @param {HTMLElement} slot
 * @param {() => void} onLand called as it touches down
 */
async function fly(stage, paper, slot, onLand) {
  const from = paper.getBoundingClientRect();
  const to = slot.getBoundingClientRect();
  const box = stage.getBoundingClientRect();
  const lift = -14;
  // Centre to centre, measured from where the torn paper now hangs.
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const side = dx >= 0 ? 1 : -1;

  // One cubic Bézier for the path: rise, bank over, dive into the slot.
  const P = [
    [0, lift],
    [-side * 70, lift - 210],
    [dx + side * 60, dy - 250],
    [dx, dy],
  ];
  const at = (t) => {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;

  const frames = [];
  for (let i = 0; i <= POSES; i += 1) {
    const k = i / POSES;
    const t = ease(k);
    const [x, y] = at(t);
    const [x2, y2] = at(Math.min(1, t + 0.02));
    const heading = Math.atan2(y2 - y, x2 - x) * (180 / Math.PI);
    // Bank with the turn, flutter a little, settle flat at the end.
    const settle = Math.min(1, (1 - t) * 3);
    const tilt = Math.sin(t * Math.PI) * 52;
    const roll = (heading - 90 * Math.sign(y2 - y || 1)) * 0.08 * settle + Math.sin(t * Math.PI * 5) * 7 * settle - 2.5 * (1 - t);
    const spin = Math.sin(t * Math.PI * 2) * 18 * side * settle;
    const grow = t < 0.3 ? 1 + t * 0.25 : 1.075 - (t - 0.3) * 0.1;
    const w = t < 0.7 ? grow : grow + ((t - 0.7) / 0.3) ** 1.6 * (sx - grow);
    const h = t < 0.7 ? grow : grow + ((t - 0.7) / 0.3) ** 1.6 * (sy - grow);
    frames.push({
      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) perspective(900px) rotateX(${tilt.toFixed(1)}deg) rotateY(${spin.toFixed(1)}deg) rotateZ(${roll.toFixed(1)}deg) scale(${w.toFixed(3)}, ${h.toFixed(3)})`,
      filter: `drop-shadow(0 ${(12 + Math.sin(t * Math.PI) * 26).toFixed(1)}px ${(18 + Math.sin(t * Math.PI) * 22).toFixed(1)}px rgba(40, 32, 18, ${(0.18 + Math.sin(t * Math.PI) * 0.1).toFixed(2)}))`,
      opacity: k < 0.93 ? 1 : 1 - (k - 0.93) / 0.07,
      offset: k,
    });
  }

  // The trail, in the stage's coordinates.
  const ox = from.left + from.width / 2 - box.left;
  const oy = from.top + from.height / 2 - box.top;
  const trail = trailFor(stage, P.map(([x, y]) => [x + ox, y + oy]));

  paper.style.transformOrigin = '50% 50%';
  const flight = paper.animate(frames, { duration: FLIGHT, easing: 'linear', fill: 'forwards' });
  trail?.run(FLIGHT);
  let landed = false;
  const land = window.setTimeout(() => { landed = true; onLand(); }, FLIGHT * 0.9);
  await flight.finished.catch(() => {});
  if (!landed) {
    window.clearTimeout(land);
  }
  paper.style.transformOrigin = '';
}

/**
 * A comet trail along the flight path, drawn in an SVG laid over the stage.
 * @param {HTMLElement} stage
 * @param {number[][]} P the path's control points in stage coordinates
 */
function trailFor(stage, P) {
  let svg = stage.querySelector('svg.receipt-trail');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'receipt-trail');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<defs><linearGradient id="receipt-trail-ink" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color: var(--gold); stop-opacity: 0"/><stop offset="0.6" style="stop-color: var(--gold)"/><stop offset="1" style="stop-color: var(--jade)"/></linearGradient></defs><path class="receipt-trail__glow"/><path class="receipt-trail__line"/>';
    stage.append(svg);
  }
  const d = `M${P[0][0]} ${P[0][1]} C${P[1][0]} ${P[1][1]} ${P[2][0]} ${P[2][1]} ${P[3][0]} ${P[3][1]}`;
  const paths = [...svg.querySelectorAll('path')];
  paths.forEach((p) => p.setAttribute('d', d));
  const len = /** @type {SVGPathElement} */ (paths[0]).getTotalLength();
  const tail = Math.min(220, len * 0.4);
  return {
    run(duration) {
      paths.forEach((p) => {
        p.style.strokeDasharray = `${tail} ${len + tail}`;
        p.animate(
          [
            { strokeDashoffset: tail, opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { strokeDashoffset: -len, opacity: 0 },
          ],
          { duration: duration * 1.05, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' },
        );
      });
    },
  };
}

/**
 * Flecks of paper dropping from the cutter.
 * @param {HTMLElement} stage @param {Element | null} printer
 */
function flecks(stage, printer) {
  if (!(printer instanceof HTMLElement)) return;
  const box = stage.getBoundingClientRect();
  const p = printer.getBoundingClientRect();
  for (let i = 0; i < 9; i += 1) {
    const bit = document.createElement('i');
    bit.className = 'receipt-fleck';
    bit.style.left = `${p.left - box.left + p.width * (0.22 + Math.random() * 0.56)}px`;
    bit.style.top = `${p.top - box.top + 4}px`;
    stage.append(bit);
    const drift = (Math.random() - 0.5) * 70;
    const fall = 40 + Math.random() * 60;
    bit.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${drift}px, ${fall}px) rotate(${(Math.random() - 0.5) * 540}deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(0.3, 0.1, 0.6, 1)', fill: 'forwards' },
    ).finished.then(() => bit.remove(), () => bit.remove());
  }
}

/**
 * Sparks where the receipt lands.
 * @param {HTMLElement} stage @param {HTMLElement} slot
 */
function sparks(stage, slot) {
  const box = stage.getBoundingClientRect();
  const r = slot.getBoundingClientRect();
  const cx = r.left - box.left + r.width / 2;
  const cy = r.top - box.top + r.height / 2;
  for (let i = 0; i < 14; i += 1) {
    const s = document.createElement('i');
    s.className = `receipt-spark${i % 3 === 0 ? ' receipt-spark--gold' : ''}`;
    s.style.left = `${cx}px`;
    s.style.top = `${cy}px`;
    stage.append(s);
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const d = 50 + Math.random() * 60;
    s.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d * 0.6}px)) scale(0.2)`, opacity: 0 },
      ],
      { duration: 650 + Math.random() * 350, easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)', fill: 'forwards' },
    ).finished.then(() => s.remove(), () => s.remove());
  }
}

/** A barcode that looks the part. @param {Element | null} el */
function buildBars(el) {
  if (!(el instanceof HTMLElement) || el.childElementCount) return;
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 46; i += 1) {
    const bar = document.createElement('i');
    bar.style.flex = `${[1, 1, 2, 3][Math.floor(rand() * 4)]}`;
    if (rand() > 0.72) bar.style.opacity = '0';
    el.append(bar);
  }
}
