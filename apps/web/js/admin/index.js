/* ==========================================================================
   /admin — the control room

   Sign in with the admin secret or a passkey; the API worker answers with an
   HttpOnly session cookie, so nothing secret is ever kept in this page's
   storage. Each section of the console is a view module that renders into
   its section; the shell routes between them by URL hash, refreshes them on
   demand or every minute, and returns to the sign-in the moment any call
   reports the session gone.
   ========================================================================== */

import { initTheme } from '../theme.js';
import { initInk } from '../ink.js';
import { api, ApiError, API, SERVICES, SIGNED_OUT, probe, passkeysSupported, signInWithPasskey } from './api.js';
import { closeDrawer, drawerOpen, errorBox, placePill, toast, when, compact } from './ui.js';

/**
 * @typedef {object} Ctx
 * @property {() => void} rerender                 re-run the current view, keeping its content until the new one is ready
 * @property {(force?: boolean) => Promise<any[]>} health  service probes, cached for 30 s
 * @property {(counts: Record<string, number | undefined>) => void} setCounts  numbers beside the nav items
 * @property {(name: string, n: number, danger?: boolean) => void} setBadge
 * @property {() => void} signedOut
 */

const VIEWS = {
  overview: { title: 'Overview', load: () => import('./views/overview.js') },
  users: { title: 'Users', load: () => import('./views/users.js') },
  keys: { title: 'API keys', load: () => import('./views/keys.js') },
  uploads: { title: 'Uploads', load: () => import('./views/uploads.js') },
  transfers: { title: 'Transfers', load: () => import('./views/transfers.js') },
  vault: { title: 'Vault', load: () => import('./views/vault.js') },
  security: { title: 'Security', load: () => import('./views/security.js') },
  system: { title: 'System', load: () => import('./views/system.js') },
};

const AUTO_KEY = 'clex-admin-live';
const AUTO_MS = 60_000;

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

let me = null;
let current = '';
let renderToken = 0;
let autoTimer = 0;
let healthCache = { at: 0, value: /** @type {any[]} */ ([]) };

// ── Session ────────────────────────────────────────────────────────────────

async function checkSession() {
  try {
    const data = await api(`${API}/me`, { quiet401: true });
    me = data.session;
    return true;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return false;
    throw err;
  }
}

function showBoot(done) {
  const boot = $('#adm-boot');
  if (done) {
    boot.classList.add('is-done');
    window.setTimeout(() => { boot.hidden = true; }, 450);
  }
}

// ── Sign in ────────────────────────────────────────────────────────────────

let method = 'password';
let streamStarted = false;

function showLogin(message = '') {
  me = null;
  stopAuto();
  closeDrawer();
  $('#adm').hidden = true;
  $('#adm-login').hidden = false;
  document.title = 'Control room — Clex admin';
  const error = $('#adm-login-error');
  error.textContent = message;
  error.hidden = !message;
  showBoot(true);
  placePill($('.adm-login__tabs'));
  if (!streamStarted && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    streamStarted = true;
    import('../stream.js').then((m) => m.initStream()).catch(() => undefined);
    import('../manifest.js').then((m) => m.initManifest()).catch(() => undefined);
  }
  window.setTimeout(() => (method === 'password' ? $('#adm-secret') : $('#adm-continue')).focus(), 60);
}

function setMethod(next) {
  method = next;
  document.querySelectorAll('.adm-login__tabs [data-method]').forEach((b) => b.setAttribute('aria-selected', String(b.getAttribute('data-method') === next)));
  document.querySelectorAll('#adm-login-form [data-for]').forEach((el) => { /** @type {HTMLElement} */ (el).hidden = el.getAttribute('data-for') !== next; });
  $('#adm-continue-label').textContent = next === 'passkey' ? 'Use a passkey' : 'Sign in';
  $('#adm-login-error').hidden = true;
  placePill($('.adm-login__tabs'));
}

function wireLogin() {
  document.querySelectorAll('.adm-login__tabs [data-method]').forEach((b) => {
    b.addEventListener('click', () => setMethod(b.getAttribute('data-method') || 'password'));
  });

  const secret = /** @type {HTMLInputElement} */ ($('#adm-secret'));
  const reveal = $('#adm-secret-reveal');
  reveal.addEventListener('click', () => {
    const show = secret.type === 'password';
    secret.type = show ? 'text' : 'password';
    reveal.setAttribute('aria-pressed', String(show));
    reveal.setAttribute('aria-label', show ? 'Hide secret' : 'Show secret');
    secret.focus();
  });

  $('#adm-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = /** @type {HTMLButtonElement} */ ($('#adm-continue'));
    const error = $('#adm-login-error');
    error.hidden = true;
    button.classList.add('is-busy');
    button.disabled = true;
    try {
      if (method === 'password') {
        if (!secret.value.trim()) throw new ApiError('Enter the admin secret.', 0, null);
        await api(`${API}/login`, { method: 'POST', body: { secret: secret.value }, quiet401: true });
      } else {
        if (!passkeysSupported()) throw new ApiError('This browser does not support passkeys.', 0, null);
        await signInWithPasskey();
      }
      secret.value = '';
      if (!(await checkSession())) throw new ApiError('Signed in, but the session cookie was not kept. Check that cookies are allowed for clex.in.', 0, null);
      await showConsole();
    } catch (err) {
      const aborted = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError');
      error.textContent = aborted ? 'The passkey prompt was dismissed.' : (err?.message || 'Sign-in failed.');
      error.hidden = false;
      if (method === 'password') secret.select();
    } finally {
      button.classList.remove('is-busy');
      button.disabled = false;
    }
  });
}

// ── Console ────────────────────────────────────────────────────────────────

/** @type {Ctx} */
const ctx = {
  rerender: () => { void show(current); },
  health: async (force = false) => {
    if (!force && Date.now() - healthCache.at < 30_000 && healthCache.value.length) return healthCache.value;
    const results = await Promise.all(SERVICES.map(async (s) => ({ ...s, ...(await probe(s)) })));
    healthCache = { at: Date.now(), value: results };
    paintServices(results);
    return results;
  },
  setCounts: (counts) => {
    for (const [name, n] of Object.entries(counts)) {
      if (n === undefined || n === null) continue;
      const el = document.querySelector(`[data-count-for="${name}"]`);
      if (el) el.textContent = compact(n);
    }
  },
  setBadge: (name, n, danger = false) => {
    const el = /** @type {HTMLElement | null} */ (document.querySelector(`[data-badge="${name}"]`));
    if (!el) return;
    el.hidden = !n;
    el.textContent = String(n);
    el.classList.toggle('is-danger', danger);
  },
  signedOut: () => showLogin('You signed out.'),
};

function paintServices(results) {
  for (const r of results) {
    const li = document.querySelector(`#adm-services [data-service="${r.id}"]`);
    if (!li) continue;
    li.setAttribute('data-state', r.ok ? (r.ms > 1200 ? 'slow' : 'up') : 'down');
    li.setAttribute('title', r.ok ? `${r.name}: up · ${r.ms} ms` : `${r.name}: not answering`);
  }
}

async function showConsole() {
  $('#adm-login').hidden = true;
  $('#adm').hidden = false;
  showBoot(true);
  paintMe();
  void ctx.health();
  const autoOn = readAuto();
  /** @type {HTMLInputElement} */ ($('#adm-auto')).checked = autoOn;
  if (autoOn) startAuto();
  await show(viewFromHash());
}

function paintMe() {
  if (!me) return;
  const how = me.method === 'passkey' ? 'Passkey' : 'Secret';
  const ends = new Date(me.expires_at * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('#adm-me-meta').textContent = `${how} · until ${ends}`;
  $('#adm-me-meta').title = `Signed in ${when(me.created_at)} from ${me.ip || 'unknown address'}. Session ends ${when(me.expires_at)}.`;
}

function viewFromHash() {
  const name = location.hash.replace(/^#/, '').split('/')[0];
  return Object.hasOwn(VIEWS, name) ? name : 'overview';
}

/** @param {string} name */
async function show(name) {
  if (!me) return;
  const token = ++renderToken;
  const view = VIEWS[name];
  const changed = name !== current;
  current = name;

  document.querySelectorAll('.adm-nav__item').forEach((a) => {
    if (a.getAttribute('data-view') === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('.adm-section').forEach((sec) => { /** @type {HTMLElement} */ (sec).hidden = sec.getAttribute('data-section') !== name; });
  $('#adm-crumb').textContent = view.title;
  document.title = `${view.title} — Clex admin`;
  closeRail();
  if (changed) {
    closeDrawer();
    window.scrollTo({ top: 0 });
  }

  const section = /** @type {HTMLElement} */ (document.querySelector(`.adm-section[data-section="${name}"]`));
  const host = /** @type {HTMLElement} */ (section.querySelector('[data-body]'));

  // A view renders into a fresh container. The first time, that container
  // goes on screen at once so its loading state shows; after that (a refresh,
  // a filter, coming back to the view) it is built off-screen and swapped in when complete, so the content never
  // blinks and a slow, superseded render can never overwrite a newer one.
  const next = /** @type {HTMLElement} */ (host.cloneNode(false));
  const firstPaint = !host.childElementCount;
  if (firstPaint) host.replaceWith(next);

  const focused = /** @type {HTMLInputElement | null} */ (host.contains(document.activeElement) && document.activeElement?.matches('[data-search]') ? document.activeElement : null);
  const caret = focused?.selectionStart ?? null;

  section.setAttribute('aria-busy', 'true');
  try {
    const mod = await view.load();
    await mod.render(next, ctx);
  } catch (err) {
    if (token !== renderToken) return;
    next.replaceChildren(errorBox(err, () => ctx.rerender()));
  }
  if (token !== renderToken) return;
  section.removeAttribute('aria-busy');
  if (!firstPaint) host.replaceWith(next);

  if (focused) {
    const input = /** @type {HTMLInputElement | null} */ (next.querySelector('[data-search]'));
    if (input) {
      input.focus();
      if (caret !== null) input.setSelectionRange(caret, caret);
    }
  }
  next.querySelectorAll('.tabs').forEach((t) => placePill(t));
  $('#adm-stamp').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  paintMe();
}

// ── Live refresh ───────────────────────────────────────────────────────────

function readAuto() {
  try { return localStorage.getItem(AUTO_KEY) === '1'; } catch { return false; }
}

function startAuto() {
  stopAuto();
  autoTimer = window.setInterval(() => {
    const dlg = /** @type {HTMLDialogElement} */ ($('#adm-dialog'));
    if (document.hidden || dlg.open || drawerOpen() || !me) return;
    if (document.activeElement?.matches('input, select, textarea')) return;
    healthCache.at = 0;
    ctx.rerender();
  }, AUTO_MS);
}

function stopAuto() {
  window.clearInterval(autoTimer);
  autoTimer = 0;
}

// ── Chrome ─────────────────────────────────────────────────────────────────

function openRail() {
  $('#adm-rail').classList.add('is-open');
  $('#adm-scrim').hidden = false;
  $('#adm-menu').setAttribute('aria-expanded', 'true');
}

function closeRail() {
  $('#adm-rail').classList.remove('is-open');
  $('#adm-scrim').hidden = true;
  $('#adm-menu').setAttribute('aria-expanded', 'false');
}

function wireConsole() {
  window.addEventListener('hashchange', () => { if (me) void show(viewFromHash()); });

  $('#adm-refresh').addEventListener('click', () => {
    healthCache.at = 0;
    ctx.rerender();
  });

  $('#adm-auto').addEventListener('change', (e) => {
    const on = /** @type {HTMLInputElement} */ (e.target).checked;
    try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* private mode */ }
    if (on) { startAuto(); toast('Live: refreshing every minute'); } else stopAuto();
  });

  $('#adm-logout').addEventListener('click', async () => {
    try { await api(`${API}/logout`, { method: 'POST', quiet401: true }); } catch { /* the cookie is cleared either way */ }
    showLogin('You signed out.');
  });

  $('#adm-menu').addEventListener('click', () => ($('#adm-rail').classList.contains('is-open') ? closeRail() : openRail()));
  $('#adm-scrim').addEventListener('click', closeRail);

  document.querySelectorAll('[data-drawer-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  $('#adm-drawer').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDrawer(); });

  window.addEventListener(SIGNED_OUT, () => {
    if (me) showLogin('Your session ended. Sign in again.');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (drawerOpen()) { closeDrawer(); e.preventDefault(); }
      else closeRail();
      return;
    }
    const typing = /** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [contenteditable]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey || !me) return;
    if (e.key === '/') {
      const search = /** @type {HTMLInputElement | null} */ (document.querySelector('.adm-section:not([hidden]) [data-search]'));
      if (search) { e.preventDefault(); search.focus(); }
    } else if (e.key === 'r') {
      healthCache.at = 0;
      ctx.rerender();
    } else if (/^[1-8]$/.test(e.key)) {
      location.hash = Object.keys(VIEWS)[Number(e.key) - 1];
    }
  });

  window.addEventListener('resize', () => document.querySelectorAll('.tabs').forEach((t) => placePill(t)));
}

// ── Boot ───────────────────────────────────────────────────────────────────

async function boot() {
  // The session cookie is host-only on clex.in, where the vault and chain
  // workers also listen, so the console only works on the apex host.
  if (location.hostname === 'www.clex.in') {
    location.replace(`https://clex.in/admin${location.hash}`);
    return;
  }

  initTheme();
  initInk();
  wireLogin();
  wireConsole();

  try {
    if (await checkSession()) await showConsole();
    else showLogin();
  } catch (err) {
    showLogin(err?.message || 'The API could not be reached.');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void boot(); });
else void boot();

