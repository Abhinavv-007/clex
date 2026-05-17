/**
 * Clex Admin SPA
 * Vanilla JS module hosted at /admin on clex.in.
 * All data calls go to https://api.clex.in/api/admin/*.
 *
 * Auth model:
 *  - Password: POST /api/admin/login → returns session_id, stored in localStorage.
 *  - Passkey:  POST /api/admin/login/passkey/{begin,finish}.
 *  - All admin requests carry "X-Admin-Session: <session_id>".
 */

/** @typedef {Record<string, unknown>} Json */

const API_BASE = (() => {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8788';
  if (host.endsWith('clex.in')) return 'https://api.clex.in';
  return 'https://api.clex.in';
})();

const SESSION_KEY = 'clex_admin_session';
/** @type {readonly ['overview', 'users', 'transfers', 'keys', 'audit', 'passkeys']} */
const TABS = /** @type {const} */ (['overview', 'users', 'transfers', 'keys', 'audit', 'passkeys']);

/** @type {{ session: string, method: string, expires: number, activeTab: string, stats: any, transfersAll: any[], usersAll: any[], keysAll: any[], auditAll: any[], passkeys: any[], health: any, loaded: Record<string, boolean> }} */
const state = {
  session: '',
  method: '',
  expires: 0,
  activeTab: 'overview',
  stats: null,
  transfersAll: [],
  usersAll: [],
  keysAll: [],
  auditAll: [],
  passkeys: [],
  health: null,
  loaded: { overview: false, users: false, transfers: false, keys: false, audit: false, passkeys: false },
};

// ─── DOM refs ─────────────────────────────────────────────────────
/** @type {(sel: string, root?: Document | Element) => HTMLElement | null} */
const $ = (sel, root = document) => /** @type {HTMLElement | null} */ (root.querySelector(sel));
/** @type {(sel: string, root?: Document | Element) => NodeListOf<HTMLElement>} */
const $$ = (sel, root = document) => /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel));

// ─── Utilities ────────────────────────────────────────────────────
function readSession() {
  try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}
/** @param {string} token */
function writeSession(token) {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

/**
 * @param {string} path
 * @param {RequestInit} [opts]
 * @returns {Promise<{ ok: boolean, status: number, body: any }>}
 */
async function apiFetch(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (state.session) headers.set('X-Admin-Session', state.session);
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...opts, headers });
  } catch (err) {
    return { ok: false, status: 0, body: { error: 'network', message: String(/** @type {any} */ (err)?.message || err) } };
  }
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, body };
}

/** @param {unknown} n */
function fmtNum(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0';
  return Number(n).toLocaleString();
}
/** @param {unknown} n */
function fmtBytes(n) {
  if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return '0 B';
  let v = Number(n);
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; while (v >= 1024 && i < u.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
/** @param {unknown} epochSeconds */
function fmtDate(epochSeconds) {
  const e = Number(epochSeconds);
  if (!e || !Number.isFinite(e)) return '—';
  const d = new Date(e * 1000);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
/** @param {unknown} epochSeconds */
function fmtAgo(epochSeconds) {
  const e = Number(epochSeconds);
  if (!e || !Number.isFinite(e)) return '—';
  const s = Math.max(1, Math.floor(Date.now() / 1000 - e));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
/** @param {unknown} sec */
function fmtSeconds(sec) {
  const s = Number(sec);
  if (!s || !Number.isFinite(s)) return '0s';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
/** @param {unknown} s */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => /** @type {Record<string, string>} */ ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[m] || m);
}
/** @param {unknown} s */
function escapeAttr(s) { return escapeHtml(s); }

// ─── WebAuthn helpers ─────────────────────────────────────────────
/** @param {string} value */
function b64ToBuf(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
/** @param {ArrayBuffer | Uint8Array} buf */
function bufToB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** @param {any} publicKey */
function decodePublicKeyOptions(publicKey) {
  return {
    ...publicKey,
    challenge: b64ToBuf(publicKey.challenge),
    user: publicKey.user ? { ...publicKey.user, id: b64ToBuf(publicKey.user.id) } : publicKey.user,
    allowCredentials: (publicKey.allowCredentials || []).map((/** @type {any} */ c) => ({ ...c, id: b64ToBuf(c.id) })),
    excludeCredentials: (publicKey.excludeCredentials || []).map((/** @type {any} */ c) => ({ ...c, id: b64ToBuf(c.id) })),
  };
}
/** @param {any} cred */
function credentialToJSON(cred) {
  return {
    credentialId: cred.id,
    response: {
      attestationObject: cred.response.attestationObject ? bufToB64(cred.response.attestationObject) : undefined,
      authenticatorData: cred.response.authenticatorData ? bufToB64(cred.response.authenticatorData) : undefined,
      clientDataJSON: bufToB64(cred.response.clientDataJSON),
      signature: cred.response.signature ? bufToB64(cred.response.signature) : undefined,
      transports: typeof cred.response.getTransports === 'function' ? cred.response.getTransports() : undefined,
    },
  };
}

// ─── Sign-in flow ─────────────────────────────────────────────────
/** @param {string} msg */
function setSigninError(msg) {
  const el = $('#admin-signin-error');
  if (!el) return;
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
}

/** @param {string} secret */
async function attemptPasswordLogin(secret) {
  setSigninError('');
  const { ok, status, body } = await apiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ secret }),
  });
  if (!ok || !body || !body.session_id) {
    const reason = body?.message || body?.error || `HTTP ${status}`;
    setSigninError(`Sign-in failed: ${reason}`);
    return;
  }
  state.session = body.session_id;
  state.method = body.method || 'password';
  state.expires = body.expires_at || 0;
  writeSession(state.session);
  await enterShell();
}

async function attemptPasskeyLogin() {
  setSigninError('');
  try {
    const begin = await apiFetch('/api/admin/login/passkey/begin', { method: 'POST' });
    if (!begin.ok || !begin.body) throw new Error(begin.body?.message || 'passkey_begin_failed');
    const cred = await navigator.credentials.get({ publicKey: decodePublicKeyOptions(begin.body.publicKey) });
    if (!cred) throw new Error('cancelled');
    const finish = await apiFetch('/api/admin/login/passkey/finish', {
      method: 'POST',
      body: JSON.stringify({ handle: begin.body.handle, ...credentialToJSON(cred) }),
    });
    if (!finish.ok || !finish.body || !finish.body.session_id) throw new Error(finish.body?.message || 'passkey_finish_failed');
    state.session = finish.body.session_id;
    state.method = finish.body.method || 'passkey';
    state.expires = finish.body.expires_at || 0;
    writeSession(state.session);
    await enterShell();
  } catch (err) {
    setSigninError(`Passkey failed: ${/** @type {any} */ (err)?.message || err}`);
  }
}

async function bootstrap() {
  state.session = readSession();
  if (!state.session) {
    showSignin();
    return;
  }
  const { ok, body } = await apiFetch('/api/admin/me');
  if (!ok || !body || !body.session) {
    state.session = '';
    writeSession('');
    showSignin();
    return;
  }
  state.method = body.session.method || 'password';
  state.expires = body.session.expires_at || 0;
  await enterShell();
}

function showSignin() {
  const signin = $('#admin-signin');
  const shell = $('#admin-shell');
  if (signin) signin.style.display = '';
  if (shell) shell.hidden = true;
}

async function enterShell() {
  const signin = $('#admin-signin');
  const shell = $('#admin-shell');
  if (signin) signin.style.display = 'none';
  if (shell) shell.hidden = false;

  const methodPill = $('#admin-method-pill');
  if (methodPill) {
    methodPill.dataset.state = 'ok';
    methodPill.textContent = `${state.method} · expires ${fmtAgo(state.expires)}`;
  }

  const initial = (location.hash || '').replace('#', '');
  const tab = TABS.includes(/** @type {any} */ (initial)) ? initial : 'overview';
  setActiveTab(tab);

  await loadHealth();
}

async function loadHealth() {
  const pill = $('#admin-health-pill');
  const { ok, body } = await apiFetch('/api/health');
  state.health = body;
  if (!pill) return;
  if (ok && body?.ok) {
    pill.dataset.state = 'ok';
    pill.textContent = `healthy · ${body.version || '?'}`;
  } else {
    pill.dataset.state = 'error';
    pill.textContent = 'offline';
  }
}

// ─── Tab switching ────────────────────────────────────────────────
/** @type {Record<string, { title: string, sub: string }>} */
const TAB_TITLES = {
  overview: { title: 'Overview', sub: 'Real-time snapshot of users, API keys and transfer activity.' },
  users: { title: 'Users', sub: 'Everyone who has signed in or minted a Clex API key.' },
  transfers: { title: 'Transfers', sub: 'Recent file transfers tracked by the worker.' },
  keys: { title: 'API keys', sub: 'Recent clex_* key creations and their owners.' },
  audit: { title: 'Audit log', sub: 'Admin sign-ins, 5xx responses and worker boots.' },
  passkeys: { title: 'Passkeys', sub: 'Hardware-backed credentials registered for admin login.' },
};

/** @param {string} tab */
function setActiveTab(tab) {
  state.activeTab = tab;
  TABS.forEach((t) => {
    const sec = $(`#admin-tab-${t}`);
    if (sec) sec.classList.toggle('is-active', t === tab);
    $$('#admin-nav .admin-nav__item').forEach((b) => {
      if (b.dataset.tab === t) b.classList.toggle('is-active', t === tab);
    });
  });
  history.replaceState(null, '', `#${tab}`);
  const meta = TAB_TITLES[tab];
  if (meta) {
    const t = $('#admin-tab-title');
    const s = $('#admin-tab-sub');
    if (t) t.textContent = meta.title;
    if (s) s.textContent = meta.sub;
  }
  ensureLoaded(tab);
}

/**
 * @param {string} tab
 * @param {boolean} [force]
 */
function ensureLoaded(tab, force = false) {
  if (tab === 'overview') return loadOverview(force);
  if (tab === 'users') return loadUsers(force);
  if (tab === 'transfers') return loadTransfers(force);
  if (tab === 'keys') return loadKeys(force);
  if (tab === 'audit') return loadAudit(force);
  if (tab === 'passkeys') return loadPasskeys(force);
  return Promise.resolve();
}

// ─── Overview ─────────────────────────────────────────────────────
/** @param {boolean} [force] */
async function loadOverview(force = false) {
  if (state.loaded.overview && !force) return;
  const statsEl = $('#admin-stats');
  const { ok, body, status } = await apiFetch('/api/admin/stats');
  if (!ok) {
    if (status === 401 || status === 403) return signOut();
    if (statsEl) statsEl.innerHTML = `<p class="admin-empty">Failed to load stats (${status}).</p>`;
    return;
  }
  state.stats = body;
  state.loaded.overview = true;
  renderOverview(body);
  await loadRecentTransfers();
}

/** @param {any} s */
function renderOverview(s) {
  const statsEl = $('#admin-stats');
  if (!statsEl) return;
  const stats = [
    { label: 'Total users', value: fmtNum(s.users?.total), hint: `${fmtNum(s.users?.active_24h)} active 24h · ${fmtNum(s.users?.new_7d)} new 7d`, accent: true },
    { label: 'Active API keys', value: fmtNum(s.api_keys?.active), hint: `${fmtNum(s.api_keys?.total)} total · ${fmtNum(s.api_keys?.revoked)} revoked` },
    { label: 'Transfers today', value: fmtNum(s.transfers?.today), hint: `${fmtNum(s.transfers?.total)} total` },
    { label: 'Bytes moved (24h)', value: fmtBytes(s.transfers?.bytes_today), hint: `total ${fmtBytes(s.transfers?.bytes_total)}` },
    { label: 'Avg duration', value: fmtSeconds(s.transfers?.avg_duration_seconds || 0), hint: 'first → last event' },
    { label: 'Total requests', value: fmtNum(s.requests?.total), hint: 'since worker boot' },
  ];
  statsEl.innerHTML = stats.map((st) => `
    <div class="admin-stat ${st.accent ? 'admin-stat--accent' : ''}">
      <span class="admin-stat__label">${escapeHtml(st.label)}</span>
      <span class="admin-stat__value">${st.value}</span>
      ${st.hint ? `<span class="admin-stat__hint">${escapeHtml(st.hint)}</span>` : ''}
    </div>
  `).join('');

  // Sparkline
  const spark = $('#admin-spark');
  const sparkMeta = $('#admin-spark-meta');
  /** @type {{ day: string, count: number, bytes: number }[]} */
  const days = Array.isArray(s.activity?.daily_transfers) ? s.activity.daily_transfers : [];
  const max = Math.max(1, ...days.map((d) => d.count || 0));
  if (spark) {
    spark.innerHTML = days.map((d) => {
      const h = Math.max(2, Math.round(((d.count || 0) / max) * 92));
      return `<div class="admin-spark__bar" data-empty="${(d.count || 0) === 0}" style="height:${h}px" title="${escapeAttr(d.day)}: ${fmtNum(d.count)} transfers · ${fmtBytes(d.bytes)}"></div>`;
    }).join('') || '<p class="admin-empty">No data.</p>';
  }
  if (sparkMeta) {
    const total = days.reduce((acc, d) => acc + (d.count || 0), 0);
    sparkMeta.textContent = `${fmtNum(total)} transfers · peak ${fmtNum(max)}/day`;
  }

  // Mime bars
  const barsEl = $('#admin-mime-bars');
  const mimeMeta = $('#admin-mime-meta');
  /** @type {Record<string, number>} */
  const mime = s.transfers?.by_mime || {};
  const mimeEntries = Object.entries(mime).sort((a, b) => Number(b[1]) - Number(a[1]));
  const mimeMax = Math.max(1, ...mimeEntries.map(([, v]) => Number(v)));
  if (barsEl) {
    barsEl.innerHTML = mimeEntries.length === 0
      ? '<p class="admin-empty">No transfers yet.</p>'
      : mimeEntries.map(([k, v]) => `
          <div class="admin-bar">
            <span class="admin-bar__label">${escapeHtml(k)}</span>
            <div class="admin-bar__track"><div class="admin-bar__fill" style="width:${(Number(v) / mimeMax) * 100}%"></div></div>
            <span class="admin-bar__value">${fmtNum(v)}</span>
          </div>`).join('');
  }
  if (mimeMeta) mimeMeta.textContent = `${mimeEntries.length} kinds`;

  // Recent admin sign-ins
  const loginsEl = $('#admin-recent-logins');
  /** @type {any[]} */
  const logins = Array.isArray(s.activity?.recent_logins) ? s.activity.recent_logins : [];
  if (loginsEl) {
    loginsEl.innerHTML = logins.length === 0
      ? '<p class="admin-empty">No logins recorded yet.</p>'
      : `<table class="admin-table">
          <thead><tr><th>When</th><th>Method</th><th>Result</th><th class="clip">IP</th></tr></thead>
          <tbody>
            ${logins.map((l) => `
              <tr>
                <td>${fmtAgo(l.created_at)}</td>
                <td>${escapeHtml(l.method)}</td>
                <td>${l.result === 'success'
                  ? '<span class="pill pill--ok">success</span>'
                  : `<span class="pill pill--bad" title="${escapeAttr(l.reason || '')}">failure</span>`}</td>
                <td class="mono clip">${escapeHtml(l.ip || '—')}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
  }
}

async function loadRecentTransfers() {
  const target = $('#admin-recent-transfers');
  if (!target) return;
  const { ok, body, status } = await apiFetch('/api/admin/transfers?limit=10');
  if (!ok) {
    target.innerHTML = `<p class="admin-empty">Failed to load (${status}).</p>`;
    return;
  }
  /** @type {any[]} */
  const transfers = Array.isArray(body?.transfers) ? body.transfers : [];
  target.innerHTML = transfers.length === 0
    ? '<p class="admin-empty">No transfers in the recent window.</p>'
    : `<table class="admin-table">
        <thead><tr><th>Code</th><th class="clip">File</th><th>Route</th><th class="num">Size</th><th>Status</th><th>When</th></tr></thead>
        <tbody>
          ${transfers.map((t) => transferRow(t)).join('')}
        </tbody>
      </table>`;
}

/** @param {any} t */
function transferRow(t) {
  const status = String(t.status || '');
  const tone = status === 'completed' ? 'ok' : status === 'cancelled' || status === 'expired' ? 'bad' : 'warn';
  return `<tr>
    <td class="mono">${escapeHtml(t.code || '—')}</td>
    <td class="clip" title="${escapeAttr(t.file_name || '')}">${escapeHtml(t.file_name || '—')}</td>
    <td>${escapeHtml(t.route || '—')}</td>
    <td class="num">${fmtBytes(t.file_size_bytes)}</td>
    <td><span class="pill pill--${tone}">${escapeHtml(status || 'pending')}</span></td>
    <td title="${escapeAttr(fmtDate(t.created_at))}">${fmtAgo(t.created_at)}</td>
  </tr>`;
}

// ─── Users tab ────────────────────────────────────────────────────
/** @param {boolean} [force] */
async function loadUsers(force = false) {
  if (state.loaded.users && !force) return;
  const list = $('#admin-users-list');
  if (list) list.innerHTML = '<p class="admin-empty">Loading users…</p>';
  const { ok, body, status } = await apiFetch('/api/admin/users?limit=200');
  if (!ok) {
    if (status === 401 || status === 403) return signOut();
    if (list) list.innerHTML = `<p class="admin-empty">Failed (${status}).</p>`;
    return;
  }
  state.usersAll = Array.isArray(body?.users) ? body.users : [];
  state.loaded.users = true;
  renderUsers();
}

function renderUsers() {
  const list = $('#admin-users-list');
  const count = $('#admin-users-count');
  const search = /** @type {HTMLInputElement | null} */ ($('#admin-users-search'));
  if (!list) return;
  const q = (search?.value || '').toLowerCase().trim();
  const users = q
    ? state.usersAll.filter((u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q))
    : state.usersAll;
  if (count) count.textContent = `${users.length} of ${state.usersAll.length}`;
  list.innerHTML = users.length === 0
    ? '<p class="admin-empty">No users match.</p>'
    : `<table class="admin-table">
        <thead><tr><th class="clip">Email</th><th class="clip">Name</th><th class="clip">UID</th><th>Created</th><th>Last seen</th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr class="is-clickable" data-uid="${escapeAttr(u.id)}">
              <td class="clip">${escapeHtml(u.email || '—')}</td>
              <td class="clip">${escapeHtml(u.display_name || '—')}</td>
              <td class="mono clip" title="${escapeAttr(u.id)}">${escapeHtml(u.id)}</td>
              <td>${fmtAgo(u.created_at)}</td>
              <td>${u.last_seen_at ? fmtAgo(u.last_seen_at) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  $$('#admin-users-list tr[data-uid]').forEach((row) => {
    row.addEventListener('click', () => openUserDrawer(row.dataset.uid || ''));
  });
}

// ─── Transfers tab ────────────────────────────────────────────────
/** @param {boolean} [force] */
async function loadTransfers(force = false) {
  if (state.loaded.transfers && !force) return;
  const list = $('#admin-transfers-list');
  if (list) list.innerHTML = '<p class="admin-empty">Loading transfers…</p>';
  const { ok, body, status } = await apiFetch('/api/admin/transfers?limit=50');
  if (!ok) {
    if (status === 401 || status === 403) return signOut();
    if (list) list.innerHTML = `<p class="admin-empty">Failed (${status}).</p>`;
    return;
  }
  state.transfersAll = Array.isArray(body?.transfers) ? body.transfers : [];
  state.loaded.transfers = true;
  renderTransfers();
}

function renderTransfers() {
  const list = $('#admin-transfers-list');
  const count = $('#admin-transfers-count');
  if (!list) return;
  if (count) count.textContent = `${state.transfersAll.length} records`;
  list.innerHTML = state.transfersAll.length === 0
    ? '<p class="admin-empty">No transfers in the recent window.</p>'
    : `<table class="admin-table">
        <thead><tr>
          <th>Code</th><th class="clip">File</th><th>Type</th>
          <th>Route</th><th class="num">Size</th><th>Status</th><th>Started</th>
        </tr></thead>
        <tbody>${state.transfersAll.map((t) => `
          <tr>
            <td class="mono">${escapeHtml(t.code || '—')}</td>
            <td class="clip" title="${escapeAttr(t.file_name || '')}">${escapeHtml(t.file_name || '—')}</td>
            <td class="mono">${escapeHtml(t.file_mime || '—')}</td>
            <td>${escapeHtml(t.route || '—')}</td>
            <td class="num">${fmtBytes(t.file_size_bytes)}</td>
            <td><span class="pill pill--${t.status === 'completed' ? 'ok' : t.status === 'cancelled' || t.status === 'expired' ? 'bad' : 'warn'}">${escapeHtml(t.status || 'pending')}</span></td>
            <td title="${escapeAttr(fmtDate(t.created_at))}">${fmtAgo(t.created_at)}</td>
          </tr>`).join('')}</tbody>
      </table>`;
}

// ─── Keys feed tab ────────────────────────────────────────────────
/** @param {boolean} [force] */
async function loadKeys(force = false) {
  if (state.loaded.keys && !force) return;
  const list = $('#admin-keys-list');
  if (list) list.innerHTML = '<p class="admin-empty">Loading API key feed…</p>';
  const { ok, body, status } = await apiFetch('/api/admin/feeds?limit=100');
  if (!ok) {
    if (status === 401 || status === 403) return signOut();
    if (list) list.innerHTML = `<p class="admin-empty">Failed (${status}).</p>`;
    return;
  }
  state.keysAll = Array.isArray(body?.key_creations) ? body.key_creations : [];
  state.loaded.keys = true;
  renderKeys();
}

function renderKeys() {
  const list = $('#admin-keys-list');
  const count = $('#admin-keys-count');
  if (!list) return;
  if (count) count.textContent = `${state.keysAll.length} keys`;
  list.innerHTML = state.keysAll.length === 0
    ? '<p class="admin-empty">No keys yet.</p>'
    : `<table class="admin-table">
        <thead><tr>
          <th class="clip">Owner</th><th class="clip">Label</th><th class="mono">Prefix</th>
          <th>Created</th><th>Last used</th><th>Status</th>
        </tr></thead>
        <tbody>${state.keysAll.map((k) => {
          const status = k.revoked_at
            ? '<span class="pill pill--bad">revoked</span>'
            : '<span class="pill pill--ok">active</span>';
          return `<tr>
            <td class="clip" title="${escapeAttr(k.email || '')}">${escapeHtml(k.email || k.user_id || '—')}</td>
            <td class="clip" title="${escapeAttr(k.name || '')}">${escapeHtml(k.name || '—')}</td>
            <td class="mono">${escapeHtml(k.key_prefix || '')}…</td>
            <td>${fmtAgo(k.created_at)}</td>
            <td>${k.last_used_at ? fmtAgo(k.last_used_at) : '—'}</td>
            <td>${status}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
}

// ─── Audit tab ────────────────────────────────────────────────────
/** @param {boolean} [force] */
async function loadAudit(force = false) {
  if (state.loaded.audit && !force) return;
  const list = $('#admin-audit-list');
  if (list) list.innerHTML = '<p class="admin-empty">Loading audit events…</p>';
  const { ok, body, status } = await apiFetch('/api/admin/audit');
  if (!ok) {
    if (status === 401 || status === 403) return signOut();
    if (list) list.innerHTML = `<p class="admin-empty">Failed (${status}).</p>`;
    return;
  }
  state.auditAll = Array.isArray(body?.events) ? body.events : [];
  state.loaded.audit = true;
  renderAudit();
}

function renderAudit() {
  const list = $('#admin-audit-list');
  if (!list) return;
  if (state.auditAll.length === 0) {
    list.innerHTML = '<p class="admin-empty">No audit events.</p>';
    return;
  }
  list.innerHTML = `<table class="admin-table">
    <thead><tr><th>When</th><th>Type</th><th class="clip">Details</th></tr></thead>
    <tbody>${state.auditAll.map((e) => {
      const tone = String(e.type || '').includes('failure') ? 'bad'
        : String(e.type || '').includes('success') ? 'ok'
        : String(e.type || '').includes('5xx') ? 'warn'
        : 'mute';
      return `<tr>
        <td title="${escapeAttr(fmtDate(e.ts))}">${fmtAgo(e.ts)}</td>
        <td><span class="pill pill--${tone}">${escapeHtml(e.type || '')}</span></td>
        <td class="mono clip" title="${escapeAttr(JSON.stringify(e.details || {}))}">${escapeHtml(JSON.stringify(e.details || {}))}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

// ─── Passkeys tab ─────────────────────────────────────────────────
/** @param {boolean} [force] */
async function loadPasskeys(force = false) {
  if (state.loaded.passkeys && !force) return;
  const list = $('#admin-passkey-list');
  if (list) list.innerHTML = '<p class="admin-empty">Loading passkeys…</p>';
  const { ok, body, status } = await apiFetch('/api/admin/passkeys');
  if (!ok) {
    if (status === 401 || status === 403) return signOut();
    if (list) list.innerHTML = `<p class="admin-empty">Failed (${status}).</p>`;
    return;
  }
  state.passkeys = Array.isArray(body?.passkeys) ? body.passkeys : [];
  state.loaded.passkeys = true;
  renderPasskeys();
}

function renderPasskeys() {
  const list = $('#admin-passkey-list');
  if (!list) return;
  if (state.passkeys.length === 0) {
    list.innerHTML = '<p class="admin-empty">No passkeys yet. Click <strong>+ Register passkey</strong> to add one.</p>';
    return;
  }
  list.innerHTML = `<table class="admin-table">
    <thead><tr><th>Label</th><th class="mono">Credential ID</th><th>Created</th><th>Last used</th><th></th></tr></thead>
    <tbody>${state.passkeys.map((p) => `
      <tr>
        <td>${escapeHtml(p.label || '—')}</td>
        <td class="mono clip" title="${escapeAttr(p.credential_id)}">${escapeHtml(p.credential_id || '')}</td>
        <td>${fmtAgo(p.created_at)}</td>
        <td>${p.last_used_at ? fmtAgo(p.last_used_at) : '—'}</td>
        <td><button class="btn btn--ghost btn--small" data-revoke-passkey="${escapeAttr(p.id)}" type="button">Revoke</button></td>
      </tr>`).join('')}</tbody>
  </table>`;
  $$('#admin-passkey-list [data-revoke-passkey]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Revoke this passkey?')) return;
      const id = btn.getAttribute('data-revoke-passkey');
      if (!id) return;
      const { ok } = await apiFetch(`/api/admin/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!ok) { alert('Could not revoke.'); return; }
      await loadPasskeys(true);
    });
  });
}

async function registerPasskey() {
  const label = prompt('Label this passkey (e.g. MacBook TouchID):', '');
  if (label === null) return;
  try {
    const begin = await apiFetch('/api/admin/passkeys/register/begin', {
      method: 'POST',
      body: JSON.stringify({ label: label || null }),
    });
    if (!begin.ok || !begin.body) throw new Error(begin.body?.message || 'register_begin_failed');
    const cred = await navigator.credentials.create({ publicKey: decodePublicKeyOptions(begin.body.publicKey) });
    if (!cred) throw new Error('cancelled');
    const finish = await apiFetch('/api/admin/passkeys/register/finish', {
      method: 'POST',
      body: JSON.stringify({ handle: begin.body.handle, label: label || null, ...credentialToJSON(cred) }),
    });
    if (!finish.ok || !finish.body?.ok) throw new Error(finish.body?.message || 'register_finish_failed');
    await loadPasskeys(true);
    alert('Passkey registered.');
  } catch (err) {
    alert(`Could not register passkey: ${/** @type {any} */ (err)?.message || err}`);
  }
}

// ─── User drawer ──────────────────────────────────────────────────
/** @param {string} uid */
async function openUserDrawer(uid) {
  const drawer = $('#admin-user-drawer');
  const title = $('#admin-drawer-title');
  const body = $('#admin-drawer-body');
  if (!drawer || !title || !body) return;
  drawer.hidden = false;
  title.textContent = 'Loading…';
  body.innerHTML = '<p class="admin-empty">Loading…</p>';
  const { ok, body: payload, status } = await apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`);
  if (!ok || !payload?.user) {
    body.innerHTML = `<p class="admin-empty">Failed to load (${status}).</p>`;
    return;
  }
  const u = payload.user;
  title.textContent = u.display_name || u.email || u.id;
  /** @type {any[]} */
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  /** @type {any[]} */
  const sessions = Array.isArray(payload.security?.sessions) ? payload.security.sessions : [];
  body.innerHTML = `
    <section>
      <h3>Identity</h3>
      <dl>
        <dt>UID</dt><dd class="mono">${escapeHtml(u.id)}</dd>
        <dt>Email</dt><dd>${escapeHtml(u.email || '—')}</dd>
        <dt>Name</dt><dd>${escapeHtml(u.display_name || '—')}</dd>
        <dt>Created</dt><dd>${fmtDate(u.created_at)}</dd>
        <dt>Last seen</dt><dd>${u.last_seen_at ? fmtDate(u.last_seen_at) : '—'}</dd>
      </dl>
    </section>
    <section>
      <h3>API keys (${keys.length})</h3>
      ${keys.length === 0 ? '<p class="admin-empty">No keys.</p>' : `
        <table class="admin-table">
          <thead><tr><th>Label</th><th class="mono">Prefix</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>${keys.map((k) => `
            <tr>
              <td>${escapeHtml(k.label || '—')}</td>
              <td class="mono">${escapeHtml(k.prefix || '')}…</td>
              <td>${fmtAgo(k.createdAt)}</td>
              <td>${k.revokedAt ? '<span class="pill pill--bad">revoked</span>' : '<span class="pill pill--ok">active</span>'}</td>
            </tr>`).join('')}</tbody>
        </table>`}
    </section>
    <section>
      <h3>Sessions (${sessions.length})</h3>
      ${sessions.length === 0 ? '<p class="admin-empty">No sessions.</p>' : `
        <table class="admin-table">
          <thead><tr><th>Email</th><th>Created</th><th>Updated</th><th>Token expires</th></tr></thead>
          <tbody>${sessions.map((s) => `
            <tr>
              <td>${escapeHtml(s.email || '—')}</td>
              <td>${fmtAgo(s.created_at)}</td>
              <td>${fmtAgo(s.updated_at)}</td>
              <td>${s.access_token_expires_at ? fmtAgo(s.access_token_expires_at) : '—'}</td>
            </tr>`).join('')}</tbody>
        </table>`}
    </section>
  `;
}

function closeDrawer() {
  const drawer = $('#admin-user-drawer');
  if (drawer) drawer.hidden = true;
}

// ─── Sign out ─────────────────────────────────────────────────────
async function signOut() {
  try { await apiFetch('/api/admin/logout', { method: 'POST' }); } catch { /* ignore */ }
  state.session = '';
  state.method = '';
  writeSession('');
  showSignin();
}

// ─── Wire DOM ─────────────────────────────────────────────────────
function wire() {
  $$('#admin-nav .admin-nav__item').forEach((b) => {
    b.addEventListener('click', () => setActiveTab(b.dataset.tab || 'overview'));
  });
  $('#admin-signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement | null} */ ($('#admin-secret'));
    if (!input?.value) { setSigninError('Enter the admin password.'); return; }
    await attemptPasswordLogin(input.value.trim());
  });
  $('#admin-passkey-btn')?.addEventListener('click', () => attemptPasskeyLogin());
  $('#admin-signout')?.addEventListener('click', () => signOut());
  $('#admin-refresh')?.addEventListener('click', () => ensureLoaded(state.activeTab, true));
  $('#admin-passkey-register')?.addEventListener('click', () => registerPasskey());
  $('#admin-users-search')?.addEventListener('input', () => renderUsers());
  $$('#admin-user-drawer [data-close]').forEach((el) => {
    el.addEventListener('click', () => closeDrawer());
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
  window.addEventListener('hashchange', () => {
    const tab = (location.hash || '').replace('#', '');
    if (TABS.includes(/** @type {any} */ (tab)) && tab !== state.activeTab) setActiveTab(tab);
  });
}

wire();
bootstrap();
