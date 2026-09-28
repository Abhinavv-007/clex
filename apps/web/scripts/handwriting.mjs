/**
 * Handwriting, at build time.
 *
 * Every <span class="script">word</span> in a page becomes that word written
 * with a pen: Sacramento, a monoline script, is traced down to the centre
 * line of each letter (scripts/skeleton.mjs) and the page gets those lines as
 * SVG strokes, in the order a hand would draw them, plus the plain text for
 * screen readers and search. js/ink.js then draws the strokes one after
 * another at an even pace, the way the word would be written, with no cursor
 * or nib: just the ink appearing.
 *
 * Because the letters are strokes, the weight is ours to choose. They are
 * set a little heavier than the font so they read well at every size. The
 * ink is a jade-to-gold gradient taken from theme tokens, so it stays
 * readable on bone and on charcoal alike.
 *
 * Built here so the browser downloads no font and no font parser for the
 * effect: the strokes are already paths in the HTML.
 */
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { penStrokes } from './skeleton.mjs';

const FONT_PATH = new URL('../fonts/Sacramento-Regular.ttf', import.meta.url);

/** How much larger the script sets than the text around it. */
const DEFAULT_SCALE = 1.6;
/** Pen weight relative to the font's own stroke. */
const WEIGHT = 1.32;

let font;
function getFont() {
  if (!font) {
    const buf = readFileSync(FONT_PATH);
    font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
}

/** Tracing a word is the slow part; each distinct word is traced once. */
const traced = new Map();
function trace(text) {
  if (!traced.has(text)) {
    const f = getFont();
    const path = f.getPath(text, 0, 0, f.unitsPerEm, { kerning: true });
    traced.set(text, penStrokes(path.commands));
  }
  return traced.get(text);
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
 * @param {string} text
 * @param {{ scale?: number, className?: string, attrs?: string, uid: string }} opts
 */
export function inkWord(text, opts) {
  const f = getFont();
  const upm = f.unitsPerEm;
  const scale = opts.scale ?? DEFAULT_SCALE;
  const { strokes, width, box } = trace(text);
  if (!strokes.length) return escapeHtml(text);

  const pen = width * WEIGHT;
  const pad = pen;
  const left = Math.min(0, box.x1) - pad;
  const right = Math.max(f.getAdvanceWidth(text, upm, { kerning: true }), box.x2) + pad;
  const top = Math.min(-upm * 0.5, box.y1) - pad;
  const bottom = Math.max(upm * 0.12, box.y2 + pad);
  const w = right - left;
  const h = bottom - top;

  const k = scale / upm;
  // Ascenders and descenders may reach past the text around it but must not
  // push the lines of a heading apart.
  const above = -top * k;
  const below = bottom * k;
  const marginTop = Math.min(0, 1.08 - above);
  const marginBottom = Math.min(0, 0.42 - below);
  // The ink's own edges, which reach past the letters' outlines by the extra
  // pen weight, are what should sit next to the words around it.
  const spill = (pen - width) / 2;
  const marginLeft = (left - (box.x1 - spill)) * k + 0.05;
  const marginRight = ((box.x2 + spill) - right) * k + 0.03;

  const style = [
    `width:${em(w * k)}`,
    `height:${em(h * k)}`,
    `vertical-align:${em(-below)}`,
    `margin:${em(marginTop)} ${em(marginRight)} ${em(marginBottom)} ${em(marginLeft)}`,
  ].join(';');

  const paths = strokes
    .map((s) => `<path d="${s.d}" pathLength="1" data-l="${r0(s.length)}"/>`)
    .join('');

  const cls = ['ink-word', opts.className].filter(Boolean).join(' ');
  return `<span class="${cls}"${opts.attrs ?? ''}>`
    + `<span class="visually-hidden">${escapeHtml(text)}</span>`
    + `<svg class="ink" viewBox="${r0(left)} ${r0(top)} ${r0(w)} ${r0(h)}" style="${style}" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="${opts.uid}i" gradientUnits="userSpaceOnUse" x1="${r0(box.x1)}" y1="0" x2="${r0(box.x2)}" y2="0">`
    + '<stop offset="0" class="ink__a"/><stop offset="0.55" class="ink__b"/><stop offset="1" class="ink__c"/>'
    + '</linearGradient></defs>'
    + `<g class="ink__pen" stroke="url(#${opts.uid}i)" stroke-width="${r0(pen)}">${paths}</g>`
    + '</svg></span>';
}

/**
 * Replaces every <span class="script …" …>text</span> in the page.
 * Attributes other than class are kept (data-write, data-delay, style…), and
 * `data-scale="1.5"` sets the size relative to the surrounding text.
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
      let rest = attrs.replace(/\sdata-scale="[\d.]+"/, '').replace(/\sdata-swash\b(="[^"]*")?/, '');
      if (!rest.includes('data-write')) rest += ' data-write';
      count += 1;
      return inkWord(decode(text).trim(), {
        scale,
        className: extraClass.trim() || undefined,
        attrs: rest,
        uid: `ink${count}`,
      });
    },
  );
}
