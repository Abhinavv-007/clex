/**
 * GET /dashboard, /dashboard/, /
 *
 * Serves the Clex API dashboard SPA from the worker. This is the page that
 */
import type { Env } from './googleAuth'

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <title>Clex API · Dashboard</title>
  <meta name="description" content="Clex API operator dashboard — manage API keys, watch live traffic, read the audit trail." />
  <link rel="icon" type="image/png" href="https://clex.in/brand/clex-logo.png" />
  <style>
    :root {
      --bg: #0d0e10;
      --bg-elev: #15171a;
      --bg-elev-2: #1c1e23;
      --rule: #25282e;
      --rule-soft: #1d1f24;
      --fg: #f5f5f4;
      --fg-soft: #c2c4ca;
      --muted: #8a8d96;
      --accent: #ffd83d;
      --accent-soft: rgba(255, 216, 61, 0.16);
      --accent-text: #ffd83d;
      --ok: #5fd17a;
      --warn: #f4b942;
      --err: #ff6b6b;
      --info: #7aa9ff;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #fafaf7;
        --bg-elev: #ffffff;
        --bg-elev-2: #f3f3ee;
        --rule: #e3e2dc;
        --rule-soft: #ecebe5;
        --fg: #131316;
        --fg-soft: #3c3d42;
        --muted: #6e6e75;
        --accent: #b58800;
        --accent-soft: rgba(181, 136, 0, 0.12);
        --accent-text: #b58800;
        --ok: #16823b;
        --warn: #b97316;
        --err: #c0392b;
        --info: #1d4ed8;
      }
    }
    * { box-sizing: border-box; }
    html, body { background: var(--bg); color: var(--fg); margin: 0; padding: 0; }
    body {
      font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-feature-settings: "tnum" 1, "ss01" 1;
      min-height: 100vh;
      overflow-x: clip;
    }
    a { color: var(--accent-text); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code, pre, .mono { font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace; font-feature-settings: "tnum" 1, "ss01" 1; }

    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 24px;
      border-bottom: 1px solid var(--rule);
      background: var(--bg-elev);
      position: sticky; top: 0; z-index: 10;
    }
    .topbar__brand { display: flex; align-items: center; gap: 10px; font-weight: 600; }
    .topbar__brand img { width: 22px; height: 22px; border-radius: 4px; }
    .topbar__brand .sub { color: var(--muted); font-weight: 400; font-size: 12px; }
    .topbar__nav { display: flex; gap: 6px; }
    .topbar__nav button {
      background: transparent; border: 1px solid transparent; color: var(--fg-soft);
      padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;
    }
    .topbar__nav button:hover { color: var(--fg); border-color: var(--rule); }
    .topbar__nav button.active { color: var(--accent-text); background: var(--accent-soft); border-color: var(--accent-soft); }

    .topbar__user { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--fg-soft); }
    .topbar__user img { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--rule); }
    .topbar__user .pill { padding: 2px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-text); border: 1px solid var(--accent-soft); }

    main { max-width: 1180px; margin: 0 auto; padding: 28px 24px 80px; }

    .pageHead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
    .pageHead h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.01em; }
    .pageHead p { margin: 0; color: var(--fg-soft); font-size: 13px; max-width: 56ch; }
    .pageHead .pill {
      padding: 4px 8px; border-radius: 999px; background: var(--bg-elev-2);
      border: 1px solid var(--rule); font-size: 11px; color: var(--fg-soft);
    }

    .grid { display: grid; gap: 14px; }
    .grid--stats { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .stat {
      background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 10px;
      padding: 14px 16px;
    }
    .stat__label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
    .stat__value { font-size: 22px; font-weight: 600; margin-top: 6px; letter-spacing: -0.01em; }
    .stat__hint { font-size: 11px; color: var(--fg-soft); margin-top: 4px; }
    .stat--ok .stat__value { color: var(--ok); }
    .stat--warn .stat__value { color: var(--warn); }
    .stat--err .stat__value { color: var(--err); }

    .panel {
      background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 10px;
      padding: 18px; margin-top: 18px;
    }
    .panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .panel__head h2 { margin: 0; font-size: 14px; letter-spacing: 0.01em; }
    .panel__head .hint { color: var(--muted); font-size: 12px; }

    .btn {
      cursor: pointer; padding: 7px 12px; border-radius: 6px; font-size: 12px;
      background: var(--bg-elev-2); border: 1px solid var(--rule); color: var(--fg);
    }
    .btn:hover { border-color: var(--accent); }
    .btn--primary { background: var(--accent); color: #1c1d22; border-color: var(--accent); font-weight: 600; }
    .btn--primary:hover { filter: brightness(1.05); }
    .btn--danger { background: transparent; color: var(--err); border-color: var(--err); }
    .btn--danger:hover { background: var(--err); color: var(--bg); }

    table.keys { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.keys th { text-align: left; font-weight: 500; color: var(--muted); padding: 8px 10px; border-bottom: 1px solid var(--rule); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
    table.keys td { padding: 10px; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
    table.keys tr:hover td { background: var(--bg-elev-2); }
    table.keys .label { font-weight: 500; }
    table.keys .prefix { color: var(--muted); font-size: 12px; }
    table.keys .pill {
      padding: 2px 8px; border-radius: 999px; font-size: 11px; background: var(--bg-elev-2);
      border: 1px solid var(--rule); color: var(--fg-soft);
    }
    table.keys .pill--ok { color: var(--ok); border-color: rgba(95,209,122,.4); }
    table.keys .pill--err { color: var(--err); border-color: rgba(255,107,107,.4); }
    table.keys .num { text-align: right; }

    .strip { display: flex; gap: 2px; align-items: flex-end; min-height: 60px; padding: 6px 0; }
    .strip__cell {
      flex: 1; min-width: 6px; max-width: 20px;
      background: var(--bg-elev-2); border-radius: 2px;
      transition: background 120ms ease;
    }
    .strip__cell:hover { background: var(--accent); }
    .strip__cell[data-tier="0"] { background: var(--rule-soft); height: 6px; }
    .strip__cell[data-tier="1"] { background: rgba(255,216,61,0.32); }
    .strip__cell[data-tier="2"] { background: rgba(255,216,61,0.55); }
    .strip__cell[data-tier="3"] { background: rgba(255,216,61,0.78); }
    .strip__cell[data-tier="4"] { background: var(--accent); }
    .strip__legend { display: flex; gap: 12px; font-size: 11px; color: var(--muted); margin-top: 6px; align-items: center; flex-wrap: wrap; }
    .strip__legend .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }

    .signin {
      max-width: 460px; margin: 80px auto; text-align: center;
      background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 12px;
      padding: 30px;
    }
    .signin h1 { margin: 0 0 8px; font-size: 20px; }
    .signin p { color: var(--fg-soft); }
    .admin-secret {
      width: 100%; padding: 9px 10px; margin-top: 14px; border-radius: 7px;
      border: 1px solid var(--rule); background: var(--bg); color: var(--fg);
      font: inherit;
    }
    .signin .btn--primary { display: inline-block; margin-top: 18px; padding: 10px 16px; }

    .modal {
      position: fixed; inset: 0; background: rgba(0,0,0,.6);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; z-index: 50;
    }
    .modal__panel {
      background: var(--bg-elev); border: 1px solid var(--rule); border-radius: 12px;
      max-width: 480px; width: 100%; padding: 22px;
    }
    .modal__panel h3 { margin: 0 0 12px; font-size: 16px; }
    .modal__panel label { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 12px; margin-bottom: 4px; }
    .modal__panel input, .modal__panel select {
      width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--rule);
      background: var(--bg); color: var(--fg); font: inherit;
    }
    .modal__actions { display: flex; gap: 8px; margin-top: 18px; justify-content: flex-end; }

    .tabs { display: none; }
    .tabs.active { display: block; }

    .empty { color: var(--fg-soft); text-align: center; padding: 32px 12px; font-size: 13px; }

    .json {
      max-height: 320px; overflow: auto; background: var(--bg-elev-2);
      padding: 12px; border-radius: 8px; border: 1px solid var(--rule);
      font-size: 12px; line-height: 1.5;
    }
    .card-list { display: grid; gap: 10px; }
    .row-card {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px;
      padding: 12px; border: 1px solid var(--rule-soft); border-radius: 9px;
      background: var(--bg-elev-2);
    }
    .row-card__title { font-weight: 600; word-break: break-word; }
    .row-card__meta { color: var(--muted); font-size: 12px; word-break: break-word; }
    .row-card__actions { display: flex; gap: 8px; align-items: center; }

    @media (max-width: 700px) {
      .topbar { padding: 12px 16px; flex-wrap: wrap; gap: 10px; }
      main { padding: 22px 16px 60px; }
      .topbar__nav { order: 2; flex-basis: 100%; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar__brand">
      <img src="https://clex.in/brand/clex-logo.png" alt="Clex" />
      <span>Clex API <span class="sub">· dashboard</span></span>
    </div>
    <nav class="topbar__nav" id="nav" hidden>
      <button data-tab="overview" class="active">Overview</button>
      <button data-tab="users">Users</button>
      <button data-tab="feed">Live feed</button>
      <button data-tab="keys">API keys</button>
      <button data-tab="usage">Usage</button>
      <button data-tab="audit">Audit</button>
      <button data-tab="passkeys">Passkeys</button>
    </nav>
    <div class="topbar__user" id="user" hidden></div>
  </header>

  <main id="main">
    <section class="signin" id="signin">
      <h1>Clex admin</h1>
      <p>Password login unlocks the admin panel. Register a passkey after first login to use passkey login next time.</p>
      <input id="admin-secret" class="admin-secret" type="password" autocomplete="current-password" placeholder="Admin password" />
      <button class="btn btn--primary" id="signin-btn">Sign in with password</button>
      <button class="btn" id="passkey-login-btn" type="button">Use passkey</button>
    </section>

    <section class="tabs" id="tab-overview">
      <div class="pageHead">
        <div>
          <h1>System overview</h1>
          <p>Live picture of the Clex API worker — metrics are pulled from <code>/api/admin/health</code> and <code>/api/admin/summary</code>.</p>
        </div>
        <span class="pill mono" id="overview-pill">loading…</span>
      </div>
      <div class="grid grid--stats" id="overview-stats"></div>
      <div class="panel">
        <div class="panel__head">
          <h2>Recent transfers</h2>
          <span class="hint">last 20 KV-tracked transfers</span>
        </div>
        <div id="overview-transfers"><div class="empty">loading…</div></div>
      </div>
    </section>

    <section class="tabs" id="tab-users">
      <div class="pageHead">
        <div>
          <h1>Users</h1>
          <p>Recent signed-in accounts from Clex Google/Firebase sessions.</p>
        </div>
        <span class="pill mono" id="users-pill">—</span>
      </div>
      <div class="panel"><div id="users-list"><div class="empty">loading…</div></div></div>
    </section>

    <section class="tabs" id="tab-feed">
      <div class="pageHead">
        <div>
          <h1>Live feed</h1>
          <p>Recent API key creations and operational activity.</p>
        </div>
        <span class="pill mono" id="feed-pill">—</span>
      </div>
      <div class="panel"><div id="feed-list"><div class="empty">loading…</div></div></div>
    </section>

    <section class="tabs" id="tab-keys">
      <div class="pageHead">
        <div>
          <h1>API keys</h1>
          <p>Bearer keys for account-owned programmatic uploads. Accounts can keep five active unlimited keys.</p>
        </div>
        <a class="btn btn--primary" href="https://clex.in/account">Open account</a>
      </div>
      <div class="panel" id="keys-panel">
        <div id="keys-table"><div class="empty">loading…</div></div>
      </div>
    </section>

    <section class="tabs" id="tab-usage">
      <div class="pageHead">
        <div>
          <h1>Usage · last 30 days</h1>
          <p>Aggregated request count across every key minted by your account. Days are UTC.</p>
        </div>
        <span class="pill mono" id="usage-total">—</span>
      </div>
      <div class="panel">
        <div class="strip" id="usage-strip"></div>
        <div class="strip__legend">
          <span><span class="swatch" style="background:rgba(255,216,61,.32)"></span>1–9</span>
          <span><span class="swatch" style="background:rgba(255,216,61,.55)"></span>10–99</span>
          <span><span class="swatch" style="background:rgba(255,216,61,.78)"></span>100–999</span>
          <span><span class="swatch" style="background:#ffd83d"></span>1K+</span>
          <span style="margin-left:auto" id="usage-range"></span>
        </div>
      </div>
    </section>

    <section class="tabs" id="tab-audit">
      <div class="pageHead">
        <div>
          <h1>Audit · system events</h1>
          <p>Password and passkey admin login events surfaced by <code>/api/admin/audit</code>.</p>
        </div>
        <span class="pill mono" id="audit-pill">—</span>
      </div>
      <div class="panel">
        <pre class="json mono" id="audit-json">loading…</pre>
      </div>
    </section>

    <section class="tabs" id="tab-passkeys">
      <div class="pageHead">
        <div>
          <h1>Passkeys</h1>
          <p>Register and manage admin passkeys after password login.</p>
        </div>
        <button class="btn btn--primary" id="register-passkey-btn">+ Register passkey</button>
      </div>
      <div class="panel"><div id="passkeys-list"><div class="empty">loading…</div></div></div>
    </section>
  </main>

  <div id="modal-root"></div>

  <script>
  // ------------------------------------------------------------------
  //  Tiny client. No bundler. No framework. Lives only in this page.
  // ------------------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const tabs = ['overview', 'users', 'feed', 'keys', 'usage', 'audit', 'passkeys'];
  const state = { user: null, keys: null, summary: null, audit: null, usage: null, adminSession: '' };

  async function fetchJson(path, opts = {}) {
    const headers = new Headers(opts.headers || {});
    if (state.adminSession && path.startsWith('/api/admin/')) {
      headers.set('X-Admin-Session', state.adminSession);
    }
    const res = await fetch(path, { credentials: 'include', ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON ok */ }
    return { ok: res.ok, status: res.status, body };
  }

  function fmt(n) {
    if (n == null || !Number.isFinite(n)) return '—';
    return new Intl.NumberFormat('en-US').format(n);
  }
  function fmtBytes(n) {
    if (n == null || !Number.isFinite(n) || n < 0) return 'unlimited';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(n < 10 ? 1 : 0) + ' ' + u[i];
  }
  function fmtAgo(ts) {
    if (!ts) return '—';
    const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function b64ToBuf(value) {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodePublicKeyOptions(publicKey) {
    return {
      ...publicKey,
      challenge: b64ToBuf(publicKey.challenge),
      user: publicKey.user ? { ...publicKey.user, id: b64ToBuf(publicKey.user.id) } : publicKey.user,
      allowCredentials: (publicKey.allowCredentials || []).map(c => ({ ...c, id: b64ToBuf(c.id) })),
      excludeCredentials: (publicKey.excludeCredentials || []).map(c => ({ ...c, id: b64ToBuf(c.id) })),
    };
  }
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

  function setActiveTab(name) {
    tabs.forEach((t) => {
      const sec = $('#tab-' + t);
      if (sec) sec.classList.toggle('active', t === name);
    });
    document.querySelectorAll('#nav button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    history.replaceState(null, '', '#' + name);
    if (name === 'usage') void loadUsage();
    if (name === 'audit') void loadAudit();
    if (name === 'users') void loadUsers();
    if (name === 'feed') void loadFeed();
    if (name === 'passkeys') void loadPasskeys();
  }

  document.querySelectorAll('#nav button').forEach((b) => {
    b.addEventListener('click', () => setActiveTab(b.dataset.tab));
  });

  function readDashboardAdminSession() {
    try { return localStorage.getItem('clex_dashboard_admin_session') || ''; } catch { return ''; }
  }

  function persistDashboardAdminSession(session) {
    try {
      if (session) localStorage.setItem('clex_dashboard_admin_session', session);
      else localStorage.removeItem('clex_dashboard_admin_session');
    } catch {}
  }

  $('#signin-btn').addEventListener('click', async () => {
    const secret = ($('#admin-secret') && $('#admin-secret').value || '').trim();
    if (!secret) return alert('Enter the admin password.');
    const res = await fetchJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret })
    });
    if (!res.ok || !res.body || !res.body.session_id) return alert('Admin login failed.');
    state.adminSession = res.body.session_id;
    persistDashboardAdminSession(state.adminSession);
    await bootstrap();
  });

  $('#passkey-login-btn').addEventListener('click', async () => {
    try {
      const begin = await fetchJson('/api/admin/login/passkey/begin', { method: 'POST' });
      if (!begin.ok || !begin.body) throw new Error('passkey_begin_failed');
      const cred = await navigator.credentials.get({ publicKey: decodePublicKeyOptions(begin.body.publicKey) });
      const finish = await fetchJson('/api/admin/login/passkey/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: begin.body.handle, ...credentialToJSON(cred) })
      });
      if (!finish.ok || !finish.body || !finish.body.session_id) throw new Error('passkey_finish_failed');
      state.adminSession = finish.body.session_id;
      persistDashboardAdminSession(state.adminSession);
      await bootstrap();
    } catch (e) {
      alert('Passkey login failed: ' + (e && e.message ? e.message : e));
    }
  });

  async function bootstrap() {
    state.adminSession = readDashboardAdminSession();
    if (!state.adminSession) {
      $('#signin').style.display = 'block';
      $('#nav').hidden = true;
      $('#user').hidden = true;
      tabs.forEach((t) => $('#tab-' + t).classList.remove('active'));
      return;
    }
    const { ok, body } = await fetchJson('/api/admin/me');
    if (!ok || !body || !body.session) {
      persistDashboardAdminSession('');
      state.adminSession = '';
      $('#signin').style.display = 'block';
      $('#nav').hidden = true;
      $('#user').hidden = true;
      tabs.forEach((t) => $('#tab-' + t).classList.remove('active'));
      return;
    }
    state.user = body.session;
    $('#signin').style.display = 'none';
    $('#nav').hidden = false;
    $('#user').hidden = false;
    $('#user').innerHTML = '<span>admin · ' + body.session.method + '</span><span class="pill mono">expires ' + fmtAgo(body.session.expires_at) + '</span>';
    const initial = (location.hash || '').replace('#', '') || 'overview';
    setActiveTab(tabs.includes(initial) ? initial : 'overview');
    await loadOverview();
  }

  // ------------------------------------------------------------------
  //  Overview tab.
  // ------------------------------------------------------------------
  async function loadOverview() {
    const [healthRes, summaryRes, transfersRes] = await Promise.all([
      fetchJson('/api/health'),
      fetchJson('/api/admin/summary'),
      fetchJson('/api/admin/transfers?limit=20'),
    ]);
    const health = healthRes.body || {};
    const summary = summaryRes.body || {};
    const transfers = (transfersRes.body && transfersRes.body.transfers) || [];

    state.summary = summary;
    const adminGated = summaryRes.status === 401 || summaryRes.status === 403;

    $('#overview-pill').textContent = adminGated
      ? 'admin session required'
      : (health.ok ? 'healthy · v' + (health.version || '?') : 'offline');

    const stats = [
      { label: 'Service', value: health.service || 'clex-api', hint: health.version || 'phase-2' },
      { label: 'Total requests', value: fmt((summary.metrics || {}).total_requests), tone: '' },
      { label: 'Transfers · created', value: fmt(((summary.metrics || {}).transfers || {}).created), tone: '' },
      { label: 'Transfers · completed', value: fmt(((summary.metrics || {}).transfers || {}).completed), tone: 'ok' },
      { label: 'Transfers · cancelled', value: fmt(((summary.metrics || {}).transfers || {}).cancelled), tone: '' },
      { label: 'Bindings · KV', value: ((summary.bindings || {}).kv_drive_session_store ? 'connected' : 'missing'), tone: ((summary.bindings || {}).kv_drive_session_store ? 'ok' : 'err') },
    ];
    $('#overview-stats').innerHTML = stats.map((s) => (
      '<div class="stat ' + (s.tone ? 'stat--' + s.tone : '') + '">' +
        '<div class="stat__label">' + s.label + '</div>' +
        '<div class="stat__value">' + s.value + '</div>' +
        (s.hint ? '<div class="stat__hint">' + s.hint + '</div>' : '') +
      '</div>'
    )).join('');

    if (transfers.length === 0) {
      $('#overview-transfers').innerHTML =
        '<div class="empty">No KV-tracked transfers in the last window. Either traffic has been quiet or the admin endpoint is gated.</div>';
    } else {
      $('#overview-transfers').innerHTML = '<table class="keys">' +
        '<thead><tr>' +
          '<th>Code</th><th>File</th><th>Route</th>' +
          '<th class="num">Size</th><th>Status</th><th>Created</th>' +
        '</tr></thead><tbody>' +
        transfers.map((t) => (
          '<tr>' +
            '<td class="mono">' + (t.code || '—') + '</td>' +
            '<td>' + escapeHtml(t.file_name || '—') + '</td>' +
            '<td>' + (t.route || '—') + '</td>' +
            '<td class="num">' + fmtBytes(t.file_size_bytes) + '</td>' +
            '<td><span class="pill">' + (t.status || '—') + '</span></td>' +
            '<td>' + fmtAgo(t.created_at) + '</td>' +
          '</tr>'
        )).join('') +
        '</tbody></table>';
    }
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ------------------------------------------------------------------
  //  Keys tab.
  // ------------------------------------------------------------------
  async function loadKeys() {
    $('#keys-table').innerHTML = '<div class="empty">API keys are managed from the signed-in user account page. Admin can inspect them from Users and Live feed.</div>';
  }

  async function loadUsers() {
    const { ok, body } = await fetchJson('/api/admin/users?limit=100');
    const users = ok && body && body.users ? body.users : [];
    $('#users-pill').textContent = ok ? fmt(body.total || users.length) + ' users' : 'unavailable';
    if (!ok || users.length === 0) {
      $('#users-list').innerHTML = '<div class="empty">No signed-in users found yet.</div>';
      return;
    }
    $('#users-list').innerHTML = '<div class="card-list">' + users.map(u => (
      '<div class="row-card">' +
        '<div><div class="row-card__title">' + escapeHtml(u.email || u.display_name || u.firebase_uid) + '</div>' +
        '<div class="row-card__meta mono">' + escapeHtml(u.firebase_uid) + ' · last seen ' + fmtAgo(u.last_seen_at) + '</div></div>' +
        '<div class="row-card__actions"><button class="btn" data-user-detail="' + encodeURIComponent(u.firebase_uid) + '">Details</button></div>' +
      '</div>'
    )).join('') + '</div>';
    document.querySelectorAll('[data-user-detail]').forEach(btn => {
      btn.addEventListener('click', () => showUserDetail(decodeURIComponent(btn.dataset.userDetail)));
    });
  }

  async function showUserDetail(uid) {
    const { ok, body } = await fetchJson('/api/admin/users/' + encodeURIComponent(uid));
    if (!ok) return alert('Could not load user detail.');
    const u = body.user || {};
    const keyRows = (body.keys || []).map(k => '<tr><td>' + escapeHtml(k.label) + '</td><td class="mono">' + k.prefix + '••••</td><td>' + (k.revokedAt ? 'revoked' : 'active') + '</td><td>' + fmtAgo(k.createdAt) + '</td></tr>').join('');
    $('#modal-root').innerHTML = '<div class="modal"><div class="modal__panel">' +
      '<h3>User profile</h3>' +
      '<p><strong>Email:</strong> ' + escapeHtml(u.email || '—') + '</p>' +
      '<p><strong>Display name:</strong> ' + escapeHtml(u.display_name || '—') + '</p>' +
      '<p class="mono"><strong>Firebase UID:</strong> ' + escapeHtml(u.firebase_uid || uid) + '</p>' +
      '<p><strong>Joined:</strong> ' + fmtAgo(u.created_at) + ' · <strong>Last seen:</strong> ' + fmtAgo(u.last_seen_at) + '</p>' +
      '<h3>Security audit</h3>' +
      '<pre class="json mono">' + escapeHtml(JSON.stringify(body.security || {}, null, 2)) + '</pre>' +
      '<h3>API keys</h3>' +
      '<table class="keys"><tbody>' + (keyRows || '<tr><td>No API keys</td></tr>') + '</tbody></table>' +
      '<div class="modal__actions"><button class="btn btn--primary" id="u-close">Close</button></div>' +
      '</div></div>';
    $('#u-close').addEventListener('click', () => $('#modal-root').innerHTML = '');
  }

  async function loadFeed() {
    const { ok, body } = await fetchJson('/api/admin/feeds?limit=50');
    const creations = ok && body && body.key_creations ? body.key_creations : [];
    $('#feed-pill').textContent = ok ? creations.length + ' events' : 'unavailable';
    if (!ok || creations.length === 0) {
      $('#feed-list').innerHTML = '<div class="empty">No recent activity found.</div>';
      return;
    }
    $('#feed-list').innerHTML = '<div class="card-list">' + creations.map(k => (
      '<div class="row-card">' +
        '<div><div class="row-card__title">' + escapeHtml(k.email || k.user_id) + ' · ' + escapeHtml(k.name || 'API key') + '</div>' +
        '<div class="row-card__meta mono">' + escapeHtml(k.key_prefix || '') + '… · ' + (k.revoked_at ? 'revoked' : 'active') + '</div></div>' +
        '<div class="row-card__actions"><span class="pill">' + fmtAgo(k.created_at) + '</span></div>' +
      '</div>'
    )).join('') + '</div>';
  }

  // ------------------------------------------------------------------
  //  Usage tab.
  // ------------------------------------------------------------------
  async function loadUsage() {
    const { ok, body } = await fetchJson('/api/keys/usage?days=30');
    const series = (ok && body && body.series) || [];
    state.usage = series;
    if (series.length === 0) {
      $('#usage-strip').innerHTML = '<div class="empty">No usage yet. Mint a key and start hitting the API.</div>';
      $('#usage-range').textContent = '';
      $('#usage-total').textContent = '0 requests';
      return;
    }
    const total = series.reduce((acc, s) => acc + s.count, 0);
    $('#usage-total').textContent = fmt(total) + ' requests';
    $('#usage-range').textContent = series[0].day + ' → ' + series[series.length - 1].day;
    $('#usage-strip').innerHTML = series.map((s) => {
      const tier = s.count === 0 ? 0 : s.count < 10 ? 1 : s.count < 100 ? 2 : s.count < 1000 ? 3 : 4;
      const h = s.count === 0 ? 6 : Math.min(60, 6 + Math.log10(Math.max(1, s.count)) * 18);
      return '<div class="strip__cell" data-tier="' + tier + '" style="height:' + h + 'px" title="' + s.day + ': ' + fmt(s.count) + ' req"></div>';
    }).join('');
  }

  // ------------------------------------------------------------------
  //  Audit tab.
  // ------------------------------------------------------------------
  async function loadAudit() {
    const { ok, status, body } = await fetchJson('/api/admin/audit');
    state.audit = body;
    $('#audit-pill').textContent = ok ? 'live · ' + (body && body.events ? body.events.length : 0) + ' events' : 'unavailable';
    $('#audit-json').textContent = JSON.stringify(body, null, 2);
  }

  async function loadPasskeys() {
    const { ok, body } = await fetchJson('/api/admin/passkeys');
    const passkeys = ok && body && body.passkeys ? body.passkeys : [];
    if (!ok || passkeys.length === 0) {
      $('#passkeys-list').innerHTML = '<div class="empty">No passkeys registered yet. Register one after password login.</div>';
      return;
    }
    $('#passkeys-list').innerHTML = '<div class="card-list">' + passkeys.map(p => (
      '<div class="row-card">' +
        '<div><div class="row-card__title">' + escapeHtml(p.label || 'Admin passkey') + '</div>' +
        '<div class="row-card__meta mono">' + escapeHtml(p.credential_id) + ' · created ' + fmtAgo(p.created_at) + ' · last used ' + fmtAgo(p.last_used_at) + '</div></div>' +
        '<div class="row-card__actions"><button class="btn btn--danger" data-passkey-revoke="' + p.id + '">Revoke</button></div>' +
      '</div>'
    )).join('') + '</div>';
    document.querySelectorAll('[data-passkey-revoke]').forEach(btn => {
      btn.addEventListener('click', () => revokePasskey(btn.dataset.passkeyRevoke));
    });
  }

  $('#register-passkey-btn').addEventListener('click', async () => {
    const label = prompt('Passkey label', 'Admin passkey');
    try {
      const begin = await fetchJson('/api/admin/passkeys/register/begin', { method: 'POST' });
      if (!begin.ok || !begin.body) throw new Error('register_begin_failed');
      const cred = await navigator.credentials.create({ publicKey: decodePublicKeyOptions(begin.body.publicKey) });
      const finish = await fetchJson('/api/admin/passkeys/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: begin.body.handle, label: label || 'Admin passkey', ...credentialToJSON(cred) })
      });
      if (!finish.ok) throw new Error(finish.body && finish.body.error || 'register_finish_failed');
      await loadPasskeys();
    } catch (e) {
      alert('Passkey registration failed: ' + (e && e.message ? e.message : e));
    }
  });

  async function revokePasskey(id) {
    if (!confirm('Revoke this admin passkey?')) return;
    const { ok, body } = await fetchJson('/api/admin/passkeys/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!ok) return alert('Revoke failed: ' + (body && body.error || 'unknown'));
    await loadPasskeys();
  }

  bootstrap();
  </script>
</body>
</html>
`

export function handleDashboard(_request: Request, _env: Env): Response {
  return new Response(HTML, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // The dashboard fetches everything dynamically so the shell itself
      // is safe to cache for a short window. Long enough that revisiting
      // doesn't pull a fresh worker invocation, short enough that we can
      // still ship UX tweaks without stale caches biting users.
      'cache-control': 'public, max-age=120, s-maxage=300',
    },
  })
}
