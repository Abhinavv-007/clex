/**
 * Handwriting, at build time.
 *
 * Every <span class="script">word</span> in a page becomes that word set in
 * Pinyon Script as real letter outlines, plus the plain text for screen
 * readers and search. js/ink.js then writes it in one continuous stroke:
 * the ink flows in from left to right behind a soft edge, a glowing nib rides
 * that edge along the letters, and a thin trail is drawn underneath and fades
 * once the word is done (the hero's word keeps a swash instead).
 *
 * The ink is one fixed jade-to-gold gradient, deliberately the same in light
 * and dark mode, so the handwriting reads as the same hand everywhere.
 *
 * Built here so the browser downloads no font and no font parser for the
 * effect — the letters are already paths in the HTML.
 */
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';

const FONT_PATH = new URL('../fonts/PinyonScript-Regular.ttf', import.meta.url);

/** How much larger the script sets than the text around it. */
const DEFAULT_SCALE = 1.28;
/** Room around the ink so the nib's glow and the trail aren't clipped. */
const PAD = 90;
/** Width of an x bucket when tracing the pen's path, in font units. */
const BUCKET = 36;

/** The ink. Fixed in both themes on purpose. */
export const INK_STOPS = [
  [0, '#338a64'],
  [0.5, '#4eab80'],
  [1, '#cda65e'],
];

let font;
function getFont() {
  if (!font) {
    const buf = readFileSync(FONT_PATH);
    font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
}

/** @param {string} s */
function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @param {number} n */
const em = (n) => `${Math.round(n * 1000) / 1000}em`;
/** @param {number} n */
const r0 = (n) => Math.round(n);

/**
 * Samples the outline commands into points (curves subdivided), so the pen's
 * path through the word can be estimated.
 * @param {import('opentype.js').Path} path
 */
function samplePoints(path) {
  const pts = [];
  let cx = 0;
  let cy = 0;
  for (const c of path.commands) {
    if (c.type === 'M' || c.type === 'L') {
      pts.push([c.x, c.y]);
      cx = c.x; cy = c.y;
    } else if (c.type === 'Q') {
      for (let t = 0.25; t <= 1; t += 0.25) {
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        pts.push([a * cx + b * c.x1 + d * c.x, a * cy + b * c.y1 + d * c.y]);
      }
      cx = c.x; cy = c.y;
    } else if (c.type === 'C') {
      for (let t = 0.25; t <= 1; t += 0.25) {
        const a = (1 - t) ** 3;
        const b = 3 * (1 - t) ** 2 * t;
        const e = 3 * (1 - t) * t * t;
        const d = t ** 3;
        pts.push([a * cx + b * c.x1 + e * c.x2 + d * c.x, a * cy + b * c.y1 + e * c.y2 + d * c.y]);
      }
      cx = c.x; cy = c.y;
    }
  }
  return pts;
}

/**
 * The line a pen would ride along, left to right: for each thin vertical
 * slice of the word, the middle of the ink in that slice, then smoothed.
 * @param {number[][]} pts @param {number} x0 @param {number} x1
 */
function penLine(pts, x0, x1) {
  const n = Math.max(2, Math.ceil((x1 - x0) / BUCKET));
  const buckets = Array.from({ length: n }, () => []);
  for (const [x, y] of pts) {
    const i = Math.min(n - 1, Math.max(0, Math.floor((x - x0) / BUCKET)));
    buckets[i].push(y);
  }
  let last = -400;
  const raw = buckets.map((ys) => {
    if (!ys.length) return last;
    ys.sort((a, b) => a - b);
    // The middle of the ink, weighted toward the body of the letters rather
    // than the tips of tall ascenders.
    const mid = ys[Math.floor(ys.length * 0.55)];
    last = mid;
    return mid;
  });
  const smooth = raw.map((_, i) => {
    let sum = 0;
    let k = 0;
    for (let j = i - 2; j <= i + 2; j += 1) {
      if (j < 0 || j >= raw.length) continue;
      sum += raw[j];
      k += 1;
    }
    return sum / k;
  });
  return smooth.map((y, i) => `${r0(x0 + (i + 0.5) * BUCKET)},${r0(y)}`).join(' ');
}

/**
 * @param {string} text
 * @param {{ scale?: number, className?: string, attrs?: string, uid: string, swash?: boolean }} opts
 */
export function inkWord(text, opts) {
  const f = getFont();
  const upm = f.unitsPerEm;
  const scale = opts.scale ?? DEFAULT_SCALE;
  const uid = opts.uid;

  const paths = f.getPaths(text, 0, 0, upm, { kerning: true });
  const letters = [];
  const pts = [];
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const p of paths) {
    const d = p.toPathData(0);
    if (!d) continue;
    const b = p.getBoundingBox();
    if (!Number.isFinite(b.x1)) continue;
    x1 = Math.min(x1, b.x1);
    y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2);
    y2 = Math.max(y2, b.y2);
    letters.push(`<path d="${d}"/>`);
    pts.push(...samplePoints(p));
  }
  if (!letters.length) return escapeHtml(text);

  const advance = f.getAdvanceWidth(text, upm, { kerning: true });
  const left = Math.min(0, x1) - PAD;
  const right = Math.max(advance, x2) + PAD;
  const top = Math.min(-f.ascender * 0.72, y1) - PAD;
  const bottom = Math.max(opts.swash ? 430 : 260, y2 + PAD);
  const w = right - left;
  const h = bottom - top;

  const k = scale / upm;
  // The ink may reach above and below the text around it (Pinyon's
  // ascenders are tall) but must not push the lines of a heading apart.
  const above = -top * k;
  const below = bottom * k;
  const marginTop = Math.min(0, 0.92 - above);
  const marginBottom = Math.min(0, 0.26 - below);

  const style = [
    `width:${em(w * k)}`,
    `height:${em(h * k)}`,
    `vertical-align:${em(-below)}`,
    `margin:${em(marginTop)} ${em(-0.02)} ${em(marginBottom)} ${em(left * k + 0.04)}`,
  ].join(';');

  const inkStart = r0(x1);
  const inkEnd = r0(x2);
  const span = inkEnd - inkStart;
  const underline = opts.swash
    ? `<path class="ink__swash" d="M ${r0(inkStart + 60)} 250 C ${r0(inkStart + span * 0.18)} 390, ${r0(inkStart + span * 0.42)} 360, ${r0(inkStart + span * 0.62)} 250 S ${r0(inkEnd - 120)} 90, ${r0(inkEnd + 30)} -10"/>`
    : `<path class="ink__trail" d="M ${inkStart} 150 L ${inkEnd} 150"/>`;

  const stops = INK_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');

  const cls = ['ink-word', opts.className].filter(Boolean).join(' ');
  return `<span class="${cls}"${opts.attrs ?? ''}>`
    + `<span class="visually-hidden">${escapeHtml(text)}</span>`
    + `<svg class="ink" viewBox="${r0(left)} ${r0(top)} ${r0(w)} ${r0(h)}" style="${style}" data-from="${inkStart}" data-to="${inkEnd}" data-line="${penLine(pts, inkStart, inkEnd)}" aria-hidden="true" focusable="false">`
    + '<defs>'
    + `<linearGradient id="${uid}i" gradientUnits="userSpaceOnUse" x1="${inkStart}" y1="0" x2="${inkEnd}" y2="0">${stops}</linearGradient>`
    + `<linearGradient id="${uid}e" class="ink__edge" gradientUnits="userSpaceOnUse" x1="${r0(left)}" y1="0" x2="${r0(left)}" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`
    + `<mask id="${uid}m" maskUnits="userSpaceOnUse" x="${r0(left)}" y="${r0(top)}" width="${r0(w)}" height="${r0(h)}"><rect x="${r0(left)}" y="${r0(top)}" width="${r0(w)}" height="${r0(h)}" fill="url(#${uid}e)"/></mask>`
    + '</defs>'
    + underline
    + `<g class="ink__letters" fill="url(#${uid}i)" mask="url(#${uid}m)">${letters.join('')}</g>`
    + '<g class="ink__nib"><circle class="ink__nib-glow" r="60"/><circle class="ink__nib-core" r="17"/></g>'
    + '</svg></span>';
}

/**
 * Replaces every <span class="script …" …>text</span> in the page.
 * Attributes other than class are kept (data-write, data-delay, style…);
 * `data-scale="1.5"` sets the size relative to the surrounding text and
 * `data-swash` draws a lasting swash under the word instead of a trail.
 *
 * @param {string} html
 */
export function inkify(html) {
  let count = 0;
  return html.replace(
    /<span class="script([^"]*)"([^>]*)>([^<]+)<\/span>/g,
    (_, extraClass, attrs, text) => {
      const scaleMatch = attrs.match(/\sdata-scale="([\d.]+)"/);
      const scale = scaleMatch ? Number(scaleMatch[1]) : undefined;
      const swash = /\sdata-swash\b/.test(attrs);
      let rest = attrs.replace(/\sdata-scale="[\d.]+"/, '').replace(/\sdata-swash\b(="[^"]*")?/, '');
      if (!rest.includes('data-write')) rest += ' data-write';
      count += 1;
      return inkWord(decode(text).trim(), {
        scale,
        swash,
        className: extraClass.trim() || undefined,
        attrs: rest,
        uid: `ink${count}`,
      });
    },
  );
}
