/**
 * GET /dashboard, /dashboard/, /
 *
 * Serves the Clex API dashboard SPA from the worker. This is the page that
 * lives at https://api.clex.in/ — operators sign in with Google, mint /
 * rotate / revoke API keys, and read live system + per-key analytics.
 *
 * The HTML + JS are inlined so the worker doesn't need a static-asset
 * binding. Every dynamic value (system health, summary, transfers, audit,
 * keys, usage) is fetched at runtime against the same worker.
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

    .secret {
      background: var(--bg-elev-2); border: 1px solid var(--accent);
      padding: 12px; border-radius: 8px; margin-top: 12px; font-family: ui-monospace, monospace;
      word-break: break-all; font-size: 12px;
    }
    .secret + p { font-size: 12px; color: var(--warn); margin-top: 8px; }

    .tabs { display: none; }
    .tabs.active { display: block; }

    .empty { color: var(--fg-soft); text-align: center; padding: 32px 12px; font-size: 13px; }

    .json {
      max-height: 320px; overflow: auto; background: var(--bg-elev-2);
      padding: 12px; border-radius: 8px; border: 1px solid var(--rule);
      font-size: 12px; line-height: 1.5;
    }

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
      <button data-tab="keys">API keys</button>
      <button data-tab="usage">Usage</button>
      <button data-tab="audit">Audit</button>
    </nav>
    <div class="topbar__user" id="user" hidden></div>
  </header>

  <main id="main">
    <section class="signin" id="signin">
      <h1>Sign in to manage API access</h1>
      <p>The Clex API dashboard reuses the same Google sign-in as <a href="https://clex.in/developers">clex.in/developers</a>.
      Mint Bearer keys, watch live traffic, and read the audit trail — no separate account.</p>
      <button class="btn btn--primary" id="signin-btn">Sign in with Google</button>
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

    <section class="tabs" id="tab-keys">
      <div class="pageHead">
        <div>
          <h1>API keys</h1>
          <p>Bearer tokens you can use against <code>https://api.clex.in/v1/*</code>. Each key carries its own daily / per-minute limits and a max upload size.</p>
        </div>
        <button class="btn btn--primary" id="mint-btn">+ Mint key</button>
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
          <p>Server-side events surfaced by <code>/api/admin/audit</code>. Requires the operator to be signed in <em>and</em> the admin secret to be configured.</p>
        </div>
        <span class="pill mono" id="audit-pill">—</span>
      </div>
      <div class="panel">
        <pre class="json mono" id="audit-json">loading…</pre>
      </div>
    </section>
  </main>

  <div id="modal-root"></div>

  <script>
  // ------------------------------------------------------------------
  //  Tiny client. No bundler. No framework. Lives only in this page.
  // ------------------------------------------------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const tabs = ['overview', 'keys', 'usage', 'audit'];
  const state = { user: null, keys: null, summary: null, audit: null, usage: null };

  async function fetchJson(path, opts) {
    const res = await fetch(path, { credentials: 'include', ...opts });
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
  }

  document.querySelectorAll('#nav button').forEach((b) => {
    b.addEventListener('click', () => setActiveTab(b.dataset.tab));
  });

  // ------------------------------------------------------------------
  //  Sign-in flow. Reuses the existing Google Drive session cookie.
  // ------------------------------------------------------------------
  $('#signin-btn').addEventListener('click', () => {
    // Hand off to the existing Google OAuth start endpoint; it'll bounce
    // back to /workspace by default. We override returnTo to our own URL.
    const target = encodeURIComponent(window.location.href);
    window.location.href = '/api/auth/google?return_to=' + target;
  });

  async function bootstrap() {
    const { ok, body } = await fetchJson('/api/auth/gdrive/session');
    if (!ok || !body || !body.user) {
      $('#signin').style.display = 'block';
      $('#nav').hidden = true;
      $('#user').hidden = true;
      tabs.forEach((t) => $('#tab-' + t).classList.remove('active'));
      return;
    }
    state.user = body.user;
    $('#signin').style.display = 'none';
    $('#nav').hidden = false;
    $('#user').hidden = false;
    $('#user').innerHTML = (body.user.picture
      ? '<img src="' + body.user.picture + '" alt="" />'
      : '') + '<span>' + (body.user.email || body.user.displayName || 'signed in') + '</span>';
    const initial = (location.hash || '').replace('#', '') || 'overview';
    setActiveTab(tabs.includes(initial) ? initial : 'overview');
    await Promise.all([loadOverview(), loadKeys()]);
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
      ? 'admin-gated · sign-in only'
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
    const { ok, body } = await fetchJson('/api/keys');
    if (!ok) {
      $('#keys-table').innerHTML = '<div class="empty">Could not load keys (' + (body && body.error || 'unknown') + ').</div>';
      return;
    }
    state.keys = (body && body.keys) || [];
    if (state.keys.length === 0) {
      $('#keys-table').innerHTML = '<div class="empty">No keys yet. Mint one to start using the Clex API programmatically.</div>';
      return;
    }
    $('#keys-table').innerHTML = '<table class="keys">' +
      '<thead><tr>' +
        '<th>Label</th><th>Plan</th><th>Limits</th>' +
        '<th class="num">Today</th><th class="num">7d</th>' +
        '<th>Last used</th><th></th>' +
      '</tr></thead><tbody>' +
      state.keys.map((k) => (
        '<tr>' +
          '<td>' +
            '<div class="label">' + escapeHtml(k.label) + '</div>' +
            '<div class="prefix mono">' + k.prefix + '••••</div>' +
          '</td>' +
          '<td><span class="pill">' + (k.limits && k.limits.label || k.plan) + '</span></td>' +
          '<td><span class="mono">' + (k.limits ? (k.limits.ratePerMin + '/min · ' + fmtBytes(k.limits.sizeBytes)) : '—') + '</span></td>' +
          '<td class="num mono">' + fmt(k.usageToday) + '</td>' +
          '<td class="num mono">' + fmt(k.usageLast7d) + '</td>' +
          '<td>' + (k.revoked
            ? '<span class="pill pill--err">revoked ' + fmtAgo(k.revokedAt) + '</span>'
            : (k.lastUsedAt ? fmtAgo(k.lastUsedAt) : 'never')) + '</td>' +
          '<td>' + (k.revoked
            ? ''
            : '<button class="btn btn--danger" data-revoke="' + k.id + '">revoke</button>') + '</td>' +
        '</tr>'
      )).join('') +
      '</tbody></table>';

    document.querySelectorAll('[data-revoke]').forEach((b) => {
      b.addEventListener('click', () => onRevoke(b.dataset.revoke));
    });
  }

  $('#mint-btn').addEventListener('click', () => openMintModal());

  function openMintModal() {
    const root = $('#modal-root');
    root.innerHTML = '<div class="modal"><div class="modal__panel">' +
      '<h3>Mint a new API key</h3>' +
      '<label for="m-label">Label</label>' +
      '<input id="m-label" maxlength="80" placeholder="e.g. CI bot · prod" />' +
      '<label for="m-plan">Plan</label>' +
      '<select id="m-plan">' +
        '<option value="free">Free · 10 req/min · 10 MB</option>' +
        '<option value="starter">Starter · 60 req/min · 100 MB</option>' +
        '<option value="pro">Pro · 300 req/min · 1 GB</option>' +
      '</select>' +
      '<div class="modal__actions">' +
        '<button class="btn" id="m-cancel">Cancel</button>' +
        '<button class="btn btn--primary" id="m-create">Mint key</button>' +
      '</div></div></div>';
    $('#m-cancel').addEventListener('click', () => (root.innerHTML = ''));
    $('#m-create').addEventListener('click', onMint);
  }

  async function onMint() {
    const label = $('#m-label').value.trim() || 'Untitled key';
    const plan = $('#m-plan').value;
    $('#m-create').disabled = true;
    $('#m-create').textContent = 'minting…';
    const { ok, body } = await fetchJson('/api/keys', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label, plan }),
    });
    if (!ok || !body || !body.key) {
      alert('Mint failed: ' + (body && body.message || body && body.error || 'unknown'));
      $('#m-create').disabled = false;
      $('#m-create').textContent = 'Mint key';
      return;
    }
    const root = $('#modal-root');
    root.innerHTML = '<div class="modal"><div class="modal__panel">' +
      '<h3>Key minted · save this now</h3>' +
      '<div class="secret mono">' + body.key + '</div>' +
      '<p>This is the only time you will see the full key. Copy it into your secrets manager — Clex never stores the plaintext.</p>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--primary" id="m-done">Done</button>' +
      '</div></div></div>';
    $('#m-done').addEventListener('click', () => (root.innerHTML = ''));
    await loadKeys();
  }

  async function onRevoke(id) {
    if (!confirm('Revoke this key? Existing requests using it will start failing immediately.')) return;
    const { ok, body } = await fetchJson('/api/keys/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!ok) {
      alert('Revoke failed: ' + (body && body.error || 'unknown'));
      return;
    }
    await loadKeys();
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
    if (status === 401 || status === 403) {
      $('#audit-pill').textContent = 'admin-gated';
      $('#audit-json').textContent =
        'This endpoint is gated by CLEX_ADMIN_SECRET. The dashboard does not embed the secret; ' +
        'set it on the worker and call /api/admin/audit with X-Admin-Secret header from your operator console.';
      return;
    }
    state.audit = body;
    $('#audit-pill').textContent = ok ? 'live · ' + (body && body.events ? body.events.length : 0) + ' events' : 'unavailable';
    $('#audit-json').textContent = JSON.stringify(body, null, 2);
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
