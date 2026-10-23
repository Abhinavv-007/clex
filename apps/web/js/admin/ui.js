/* ==========================================================================
   /admin — building blocks

   Everything the console renders comes from the workers, and some of it
   (file names, key labels, user agents) was typed by strangers. So nothing is
   ever assembled as an HTML string: `h()` builds nodes and every value lands
   as text. Icons are the only markup, and they are constants in this file.
   ========================================================================== */

/**
 * @param {string} tag `tag.class.class`
 * @param {Record<string, any> | null} [attrs]
 * @param {...any} children strings, numbers, nodes, arrays, or null/false to skip
 */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') el.className = [el.className, value].filter(Boolean).join(' ');
      else if (key === 'dataset') Object.assign(el.dataset, value);
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key === 'text') el.textContent = String(value);
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @param {string} tag @param {Record<string, string | number>} [attrs] */
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Icons, as path data drawn with a 1.7 stroke on a 24 grid. */
const ICONS = {
  key: 'M8 19a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm3-7 8-8m-3 3 3 3m-6 0 2 2',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c.9-3.9 3.7-6 7-6s6.1 2.1 7 6',
  lock: 'M5 10.5h14v10H5zM8 10.5V8a4 4 0 0 1 8 0v2.5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  cross: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 8v5m0 3.5v.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  swap: 'M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5',
  shield: 'M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-2.5Z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm9.5 3-4.8-4.8',
  file: 'M7 3.5h6.5L18 8v11.5A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4M13.5 3.5V8H18',
  external: 'M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10',
  copy: 'M9 9h10.5v10.5H9zM15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H9',
};

/** @param {keyof typeof ICONS} name */
export function icon(name, size = 16) {
  const svg = s('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  svg.append(s('path', { d: ICONS[name] }));
  return svg;
}

// ── Formatting ─────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat();

export function num(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return nf.format(Number(n));
}

export function compact(n) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n));
}

export function bytes(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  if (v < 0) return 'Unlimited';
  if (v < 1024) return `${v} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) { x /= 1024; i += 1; }
  return `${x >= 100 ? Math.round(x) : x.toFixed(1)} ${units[i]}`;
}

/** Accepts seconds or milliseconds since the epoch. */
export function toMs(t) {
  const v = Number(t);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v < 1e12 ? v * 1000 : v;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function ago(t) {
  const ms = toMs(t);
  if (ms === null) return '—';
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return diff < 0 ? 'just now' : 'in a moment';
  const steps = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [604800, 'day'], [2629800, 'week'], [31557600, 'month'], [Infinity, 'year']];
  const divs = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2629800, year: 31557600 };
  for (const [limit, unit] of steps) {
    if (abs < limit) return rtf.format(Math.round(diff / divs[unit]), unit);
  }
  return '—';
}

export function when(t) {
  const ms = toMs(t);
  if (ms === null) return '—';
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** A relative time with the absolute one as its tooltip. */
export function time(t) {
  const ms = toMs(t);
  return h('time.adm-time', { datetime: ms ? new Date(ms).toISOString() : undefined, title: when(t) }, ago(t));
}

export function duration(ms) {
  const v = Number(ms);
  if (!Number.isFinite(v)) return '—';
  if (v < 1000) return `${Math.round(v)} ms`;
  if (v < 60_000) return `${(v / 1000).toFixed(1)} s`;
  if (v < 3_600_000) return `${Math.round(v / 60_000)} min`;
  if (v < 86_400_000) return `${(v / 3_600_000).toFixed(1)} h`;
  return `${(v / 86_400_000).toFixed(1)} d`;
}

export function rate(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v < 0 ? 'Unlimited' : `${num(v)}/min`;
}

export function short(str, head = 8, tail = 4) {
  const v = String(str ?? '');
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

/** A user agent, reduced to "Browser on OS". */
export function device(ua) {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|wget|python|node|go-http/i.test(ua) ? 'Script' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

// ── Small components ───────────────────────────────────────────────────────

/** @param {string} text @param {'ok'|'warn'|'danger'|'gold'|'moon'|''} [tone] */
export function pill(text, tone = '', plain = false) {
  return h(`span.adm-pill${tone ? `.adm-pill--${tone}` : ''}${plain ? '.adm-pill--plain' : ''}`, null, text);
}

const STATUS_TONES = {
  active: 'ok', completed: 'ok', success: 'ok', up: 'ok', live: 'ok', connected: 'ok',
  expired: '', revoked: 'danger', cancelled: 'warn', failed: 'danger', failure: 'danger', locked: 'danger',
  abandoned: 'warn', created: 'moon', registered: 'moon', waiting_peer: 'moon', connecting: 'moon', transferring: 'gold',
  anonymous: 'gold', account: 'moon', opened: '', unread: 'ok',
};

export function statusPill(status) {
  const key = String(status || '').toLowerCase();
  return pill(key.replace(/_/g, ' ') || '—', STATUS_TONES[key] ?? '');
}

export function copyChip(value, label = value) {
  const chip = h('button.adm-copy', { type: 'button', title: `Copy ${value}` }, icon('copy', 12), h('span', null, label));
  chip.addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      toast('Copied to the clipboard');
    } catch {
      toast('Could not copy', 'error');
    }
  });
  return chip;
}

export function empty(title, text = '') {
  return h('div.adm-empty', null, h('b', null, title), text ? h('span', null, text) : null);
}

export function loading(rows = 4) {
  return h('div.adm-panel__body', null,
    Array.from({ length: rows }, (_, i) => h('div.adm-skeleton.shimmer', { style: { width: `${90 - i * 12}%`, marginBottom: '12px' } })));
}

export function errorBox(err, retry) {
  return h('div.adm-empty', null,
    h('b', null, 'Could not load this'),
    h('span', null, err?.message || String(err)),
    retry ? h('button.btn.btn--ghost.btn--sm', { type: 'button', onclick: retry, style: { marginTop: '8px' } }, 'Try again') : null);
}

/**
 * @param {{ title: string, sub?: string, actions?: any, body: any, foot?: any, flush?: boolean, className?: string }} p
 */
export function panel({ title, sub, actions, body, foot, flush = false, className = '' }) {
  return h(`section.adm-panel${className ? `.${className}` : ''}`, null,
    h('header.adm-panel__head', null,
      h('div', null, h('h2.adm-panel__title', null, title), sub ? h('p.adm-panel__sub', null, sub) : null),
      actions ?? null),
    h(`div.adm-panel__body${flush ? '.adm-panel__body--flush' : ''}`, null, body),
    foot ? h('footer.adm-panel__foot', null, foot) : null);
}

/**
 * @param {{ label: string, value: any, hint?: any, tone?: string, href?: string }} t
 */
export function tile({ label, value, hint, tone, href }) {
  const tag = href ? 'a' : 'article';
  return h(`${tag}.adm-tile${tone ? `.adm-tile--${tone}` : ''}`, href ? { href } : null,
    h('span.adm-tile__label', null, label),
    h('span.adm-tile__value', null, value),
    hint ? h('span.adm-tile__hint', null, hint) : null);
}

export function kv(pairs) {
  const dl = h('dl.adm-kv');
  for (const [k, v] of pairs) {
    if (v === undefined) continue;
    dl.append(h('dt', null, k), h('dd', null, v ?? '—'));
  }
  return dl;
}

/**
 * @template T
 * @param {{ columns: { label: string, cell: (row: T) => any, className?: string }[], rows: T[], onRow?: (row: T) => void, emptyText?: string }} p
 */
export function table({ columns, rows, onRow, emptyText = 'Nothing here yet' }) {
  if (!rows.length) return empty(emptyText);
  const thead = h('thead', null, h('tr', null, columns.map((c) => h('th', { class: c.className, scope: 'col' }, c.label))));
  const tbody = h('tbody', null, rows.map((row) => {
    const tr = h('tr', onRow ? { 'data-href': '1', tabindex: '0' } : null,
      columns.map((c) => h('td', { class: c.className }, c.cell(row))));
    if (onRow) {
      tr.addEventListener('click', (e) => {
        if (/** @type {HTMLElement} */ (e.target).closest('button, a, input, select')) return;
        onRow(row);
      });
      tr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target === tr) onRow(row);
      });
    }
    return tr;
  }));
  return h('div.adm-table-wrap', null, h('table.adm-table', null, thead, tbody));
}

/**
 * Pagination footer for a list endpoint that returns { total, limit, offset }.
 * @param {{ total: number, limit: number, offset: number }} page @param {(offset: number) => void} go
 */
export function pager(page, go) {
  const from = page.total ? page.offset + 1 : 0;
  const to = Math.min(page.total, page.offset + page.limit);
  return [
    h('span', null, `${num(from)}–${num(to)} of ${num(page.total)}`),
    h('div.adm-pager', null,
      h('button.btn.btn--ghost.btn--xs', { type: 'button', disabled: page.offset <= 0, onclick: () => go(Math.max(0, page.offset - page.limit)) }, 'Previous'),
      h('button.btn.btn--ghost.btn--xs', { type: 'button', disabled: to >= page.total, onclick: () => go(page.offset + page.limit) }, 'Next')),
  ];
}

/** A pill-tab filter, using the site's .tabs component. */
export function tabs(options, current, onChange, label = 'Filter') {
  const pillEl = h('span.tabs__pill', { 'aria-hidden': 'true' });
  const wrap = h('div.tabs', { role: 'tablist', 'aria-label': label }, pillEl);
  for (const [value, text] of options) {
    const btn = h('button.tabs__btn', { type: 'button', role: 'tab', 'aria-selected': String(value === current) }, text);
    btn.addEventListener('click', () => onChange(value));
    wrap.append(btn);
  }
  requestAnimationFrame(() => placePill(wrap));
  return wrap;
}

export function placePill(wrap) {
  const active = wrap.querySelector('[aria-selected="true"]');
  const pillEl = wrap.querySelector('.tabs__pill');
  if (!(active instanceof HTMLElement) || !(pillEl instanceof HTMLElement)) return;
  pillEl.style.setProperty('--pill-w', `${active.offsetWidth}px`);
  pillEl.style.setProperty('--pill-x', `${active.offsetLeft - 3}px`);
}

export function select(options, current, onChange, label) {
  const el = h('select.adm-select', { 'aria-label': label },
    options.map(([value, text]) => h('option', { value, selected: value === current }, text)));
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

/** A search box that reports after the operator pauses typing. */
export function searchBox(value, onSearch, placeholder = 'Search…') {
  const input = h('input.input', { type: 'search', value, placeholder, 'aria-label': placeholder, 'data-search': '1', autocomplete: 'off', spellcheck: 'false' });
  let t = 0;
  input.addEventListener('input', () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => onSearch(input.value.trim()), 280);
  });
  return h('label.adm-search', null, icon('search', 16), input, h('kbd', null, '/'));
}

/** Runs an action on a button, showing it busy, and reports the outcome. */
export async function busy(button, fn, done) {
  button.classList.add('is-busy');
  button.disabled = true;
  try {
    const result = await fn();
    if (done) toast(typeof done === 'function' ? done(result) : done);
    return result;
  } catch (err) {
    toast(err?.message || 'That did not work', 'error');
    return undefined;
  } finally {
    button.classList.remove('is-busy');
    button.disabled = false;
  }
}

// ── Toasts ─────────────────────────────────────────────────────────────────

export function toast(text, kind = 'ok') {
  const region = document.getElementById('adm-toasts');
  if (!region) return;
  const el = h(`div.adm-toast${kind === 'error' ? '.adm-toast--error' : ''}`, { role: kind === 'error' ? 'alert' : 'status' },
    h('span.adm-toast__dot', { 'aria-hidden': 'true' }), h('span', null, text));
  region.append(el);
  window.setTimeout(() => {
    el.classList.add('is-leaving');
    window.setTimeout(() => el.remove(), 260);
  }, kind === 'error' ? 6000 : 3200);
}

// ── Dialogs ────────────────────────────────────────────────────────────────

/**
 * A modal built on <dialog>. Resolves to the form's values, or null.
 * @param {{ title: string, text?: string, fields?: { name: string, label: string, value?: string, type?: string, placeholder?: string, options?: [string, string][], required?: boolean, hint?: string }[], confirm?: string, danger?: boolean, typeToConfirm?: string }} p
 * @returns {Promise<Record<string, string> | null>}
 */
export function dialog({ title, text, fields = [], confirm = 'Confirm', danger = false, typeToConfirm }) {
  const dlg = /** @type {HTMLDialogElement} */ (document.getElementById('adm-dialog'));
  dlg.replaceChildren();
  const inputs = fields.map((f) => {
    const control = f.options
      ? h('select.adm-select', { name: f.name, style: { width: '100%' } }, f.options.map(([v, t]) => h('option', { value: v, selected: v === f.value }, t)))
      : h('input.input', { name: f.name, type: f.type || 'text', value: f.value ?? '', placeholder: f.placeholder, required: f.required, autocomplete: 'off', spellcheck: 'false' });
    return h('label', null, h('span.adm-label', null, f.label), control, f.hint ? h('small.adm-dim', null, f.hint) : null);
  });
  const confirmInput = typeToConfirm
    ? h('input.input', { name: '__confirm', placeholder: typeToConfirm, autocomplete: 'off', spellcheck: 'false', 'aria-label': `Type ${typeToConfirm} to confirm` })
    : null;
  const ok = h(`button.btn.${danger ? 'btn--danger' : 'btn--primary'}`, { type: 'submit', value: 'ok' }, confirm);
  const form = h('form', { method: 'dialog' },
    h('h2', { id: 'adm-dialog-title' }, title),
    text ? h('p', null, text) : null,
    inputs.length ? h(inputs.length > 1 ? 'div.adm-fields' : 'div', null, inputs) : null,
    confirmInput ? h('label', null, h('span.adm-label', null, `Type “${typeToConfirm}” to confirm`), confirmInput) : null,
    h('div.adm-dialog__actions', null,
      h('button.btn.btn--ghost', { type: 'submit', value: 'cancel', formnovalidate: true }, 'Cancel'),
      ok));
  dlg.append(form);

  if (confirmInput) {
    ok.disabled = true;
    confirmInput.addEventListener('input', () => { ok.disabled = confirmInput.value.trim() !== typeToConfirm; });
  }

  return new Promise((resolve) => {
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return resolve(null);
      const data = Object.fromEntries(new FormData(form).entries());
      delete data.__confirm;
      resolve(/** @type {Record<string, string>} */ (data));
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
    (confirmInput || form.querySelector('input, select') || ok).focus();
  });
}

// ── Drawer ─────────────────────────────────────────────────────────────────

let drawerReturn = null;

export function openDrawer(title, body) {
  const drawer = document.getElementById('adm-drawer');
  if (!drawer) return;
  drawerReturn = document.activeElement;
  document.getElementById('adm-drawer-title').textContent = title;
  document.getElementById('adm-drawer-body').replaceChildren(body);
  drawer.hidden = false;
  drawer.querySelector('[data-drawer-close]')?.focus();
}

export function closeDrawer() {
  const drawer = document.getElementById('adm-drawer');
  if (!drawer || drawer.hidden) return;
  drawer.hidden = true;
  if (drawerReturn instanceof HTMLElement) drawerReturn.focus();
}

export function drawerOpen() {
  return !document.getElementById('adm-drawer')?.hidden;
}

// ── Tooltip ────────────────────────────────────────────────────────────────

export function tooltip(target, title, value) {
  const tip = document.getElementById('adm-tooltip');
  if (!tip) return;
  const show = () => {
    tip.replaceChildren(h('b', null, title), h('span', null, value));
    const r = target.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - 80, Math.max(80, r.left + r.width / 2))}px`;
    tip.style.top = `${Math.max(40, r.top)}px`;
    tip.hidden = false;
  };
  const hide = () => { tip.hidden = true; };
  target.addEventListener('pointerenter', show);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);
}

// ── Charts ─────────────────────────────────────────────────────────────────

/**
 * A single-series column chart over days. Thin columns with 4px rounded
 * tops on a shared baseline, a recessive grid, a hover tooltip per column
 * (the hit target is the full column height), and a data table behind it.
 * @param {{ data: { day: string, value: number }[], format?: (n: number) => string, label: string, tone?: 'jade'|'gold'|'moon', total?: string, note?: string }} p
 */
export function barChart({ data, format = num, label, tone = 'jade', total, note }) {
  const W = 640;
  const H = 168;
  const pad = { t: 8, r: 4, b: 22, l: 4 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const step = (W - pad.l - pad.r) / n;
  const gap = Math.min(6, step * 0.32);
  const bw = Math.max(2, step - gap);
  const plotH = H - pad.t - pad.b;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${label}: ${data.length} days` });
  for (const f of [0.5, 1]) {
    const y = pad.t + plotH * (1 - f);
    svg.append(s('line', { class: 'adm-chart__grid', x1: pad.l, x2: W - pad.r, y1: y, y2: y, 'stroke-dasharray': f === 1 ? '' : '2 4' }));
  }
  svg.append(s('line', { class: 'adm-chart__grid', x1: pad.l, x2: W - pad.r, y1: pad.t + plotH, y2: pad.t + plotH }));

  data.forEach((d, i) => {
    const x = pad.l + i * step + gap / 2;
    const bh = d.value > 0 ? Math.max(3, (d.value / max) * plotH) : 0;
    const y = pad.t + plotH - bh;
    const col = s('g', { class: 'adm-chart__col', tabindex: '0', 'aria-label': `${d.day}: ${format(d.value)}` });
    const r = Math.min(4, bw / 2, bh);
    if (bh > 0) {
      // Rounded at the data end only; square on the baseline.
      col.append(s('path', {
        class: 'adm-chart__bar',
        d: `M${x},${y + bh}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + bh}Z`,
      }));
    }
    col.append(s('rect', { class: 'adm-chart__hit', x: x - gap / 2, y: pad.t, width: step, height: plotH }));
    tooltip(col, new Date(`${d.day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }), format(d.value));
    svg.append(col);
  });

  const ticks = [0, Math.floor((n - 1) / 2), n - 1];
  for (const i of ticks) {
    if (!data[i]) continue;
    const x = pad.l + i * step + step / 2;
    const t = s('text', { class: 'adm-chart__axis', x, y: H - 6, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
    t.textContent = new Date(`${data[i].day}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    svg.append(t);
  }

  const tableView = h('details.adm-chart__table', null,
    h('summary', null, 'Show as table'),
    table({
      columns: [
        { label: 'Day', cell: (d) => d.day },
        { label, cell: (d) => format(d.value), className: 'num' },
      ],
      rows: [...data].reverse(),
    }));

  return h(`div.adm-chart.adm-chart--${tone}`, null,
    total !== undefined ? h('div.adm-chart__headline', null, h('span.adm-chart__big', null, total), note ? h('span.adm-chart__note', null, note) : null) : null,
    svg,
    tableView);
}

/** A ranked list of horizontal meters, values in ink beside each bar. */
export function meters(items, format = num) {
  if (!items.length) return empty('No data yet');
  const max = Math.max(1, ...items.map((i) => i.value));
  return h('ul.adm-meter', null, items.map((i) =>
    h('li', null,
      h('span.adm-meter__name', { title: i.label }, i.label),
      h('span.adm-meter__value', null, format(i.value)),
      h('span.adm-meter__track', null, h('span.adm-meter__fill', { style: { width: `${Math.max(2, (i.value / max) * 100)}%` } })))));
}
