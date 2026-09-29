/**
 * Handwriting, at build time.
 *
 * Every <span class="script">word</span> becomes that word set in an
 * elegant high-contrast italic and written on, stroke by stroke, the way
 * Apple writes "hello": one smooth pass of the pen, then it simply stays.
 *
 * The letters are Bodoni Moda Italic (Indestructible Type, SIL OFL), so the
 * shapes are exact. To write them on, the word's outline is traced down to
 * the line a pen would follow through it (scripts/skeleton.mjs); that line,
 * stroked wide enough to cover the heaviest part of a letter, is a mask over
 * the letters, and js/ink.js grows it along its length. What you see is the
 * typeface itself appearing in writing order.
 *
 * Built here so the browser downloads no font and no parser for the effect:
 * the letters and their pen path are already SVG in the HTML. The same
 * markup feeds the apps (words.json, written by scripts/hand-words.mjs).
 */
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { penStrokes } from './skeleton.mjs';

const FONT_PATH = new URL('../fonts/BodoniModa-Italic.ttf', import.meta.url);

/** Size relative to the surrounding text. */
const DEFAULT_SCALE = 1.3;
/** The mask's pen, as a share of the heaviest stroke in the word: wide
 *  enough to uncover every edge, narrow enough not to run ahead. */
const MASK = 1.3;

let font;
function getFont() {
  if (!font) {
    const buf = readFileSync(FONT_PATH);
    font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return font;
}

/** Tracing a phrase is the slow part; each distinct phrase is traced once. */
const traced = new Map();
function trace(text) {
  if (!traced.has(text)) {
    const f = getFont();
    const path = f.getPath(text, 0, 0, f.unitsPerEm, { kerning: true });
    const pen = penStrokes(path.commands, { pxPerStroke: 12, coarse: 1.8 });
    traced.set(text, { outline: path.toPathData(0), ...pen });
  }
  return traced.get(text);
}

/** @param {string} s */
function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&rsquo;|’/g, "'")
    .replace(/&quot;/g, '"');
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  const { outline, strokes, width, maxWidth, box } = trace(text);
  if (!strokes.length) return escapeHtml(text);

  const pad = maxWidth;
  const left = box.x1 - pad;
  const top = Math.min(box.y1, -upm * 0.5) - pad;
  const right = box.x2 + pad;
  const bottom = Math.max(box.y2, upm * 0.1) + pad;
  const w = right - left;
  const h = bottom - top;

  const k = scale / upm;
  // Loops and descenders may reach past the line but must not push the lines
  // of a heading apart, so the box is pulled back by negative margins.
  const above = -top * k;
  const below = bottom * k;
  const style = [
    `width:${em(w * k)}`,
    `height:${em(h * k)}`,
    `vertical-align:${em(-below)}`,
    `margin:${em(Math.min(0, 0.95 - above))} ${em(-pad * k + 0.04)} ${em(Math.min(0, 0.28 - below))} ${em(-pad * k + 0.08)}`,
  ].join(';');

  const id = opts.uid;
  const pen = strokes
    .map((s) => `<path d="${s.d}" pathLength="1" data-l="${r0(s.length)}"/>`)
    .join('');

  const cls = ['ink-word', opts.className].filter(Boolean).join(' ');
  return `<span class="${cls}"${opts.attrs ?? ''}>`
    + `<span class="visually-hidden">${escapeHtml(text)}</span>`
    + `<svg class="ink" viewBox="${r0(left)} ${r0(top)} ${r0(w)} ${r0(h)}" style="${style}" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="${r0(box.x1)}" y1="0" x2="${r0(box.x2)}" y2="0">`
    + '<stop offset="0" class="ink__a"/><stop offset="0.55" class="ink__b"/><stop offset="1" class="ink__c"/>'
    + '</linearGradient>'
    + `<mask id="${id}m" maskUnits="userSpaceOnUse" x="${r0(left)}" y="${r0(top)}" width="${r0(w)}" height="${r0(h)}">`
    + `<g class="ink__pen" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="${r0(Math.max(width * 2, maxWidth * MASK))}">${pen}</g>`
    + '</mask></defs>'
    + `<path class="ink__letters" d="${outline}" fill="url(#${id}g)" mask="url(#${id}m)"/>`
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
