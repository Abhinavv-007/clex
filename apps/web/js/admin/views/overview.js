/* /admin — Overview: the whole product on one screen. */

import { api, settle, API, VAULT, CHAIN } from '../api.js';
import { h, icon, num, compact, bytes, time, device, statusPill, tile, panel, barChart, meters, empty, errorBox, loading } from '../ui.js';

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  if (!body.childElementCount) body.append(loading(6));

  const [vault, chain, apiSum, transfers, logins, uploads] = await Promise.all([
    settle(api(`${VAULT}/summary`)),
    settle(api(`${CHAIN}/summary`)),
    settle(api(`${API}/summary`)),
    settle(api(`${API}/transfers?limit=6`)),
    settle(api(`${API}/logins?limit=6`)),
    settle(api(`${VAULT}/uploads?limit=6&status=all`)),
  ]);
  const health = await ctx.health();

  const v = vault.ok ? vault.value : null;
  const c = chain.ok ? chain.value : null;
  ctx.setCounts({ users: v?.users, keys: v?.keys?.active, uploads: v?.uploads?.active });

  const alerts = attention({ v, c, vault, chain, apiSum, health });
  const down = health.filter((p) => !p.ok).length;
  ctx.setBadge('system', down, down > 0);

  const tiles = h('div.adm-tiles', null,
    tile({ label: 'Users', value: v ? compact(v.users) : '—', hint: v ? hint(v.keys?.new_24h, 'new keys today') : unavailable(vault), href: '#users', tone: 'jade' }),
    tile({ label: 'Active API keys', value: v ? compact(v.keys?.active) : '—', hint: v ? `${num(v.keys?.anon_active)} anonymous · ${num(v.keys?.used_24h)} used today` : unavailable(vault), href: '#keys' }),
    tile({ label: 'Live share links', value: v ? compact(v.uploads?.active) : '—', hint: v ? `${bytes(v.uploads?.live_bytes)} stored` : unavailable(vault), href: '#uploads' }),
    tile({ label: 'Downloads', value: v ? compact(v.uploads?.downloads) : '—', hint: v ? hint(v.uploads?.new_24h, 'uploads today') : unavailable(vault), href: '#uploads' }),
    tile({ label: 'Chain transfers', value: c ? compact(c.counts?.transfers) : '—', hint: c ? hint(c.last24h?.transfers, 'in the last 24 h') : unavailable(chain), href: '#transfers', tone: 'jade' }),
    tile({ label: 'Completed', value: c ? pct(c.counts?.completed, c.counts?.transfers) : '—', hint: c ? `${num(c.counts?.completed)} of ${num(c.counts?.transfers)} transfers` : unavailable(chain), href: '#transfers' }),
    tile({ label: 'Vault accounts', value: v?.vault ? compact(v.vault.accounts) : '—', hint: v?.vault ? `${num(v.vault.notes)} notes · ${bytes(v.vault.payload_bytes)}` : 'sync tables not migrated', href: '#vault' }),
    tile({ label: 'Secret links', value: v ? `${compact(v.secrets?.count)}${v.secrets?.capped ? '+' : ''}` : '—', hint: 'unexpired, view-once', href: '#vault' }),
  );

  const series = v?.series ?? [];
  const uploadsTotal = series.reduce((n, d) => n + d.uploads, 0);
  const keysTotal = series.reduce((n, d) => n + d.keys, 0);
  const chainSeries = c?.series ?? [];
  const chainTotal = chainSeries.reduce((n, d) => n + d.transfers, 0);

  const charts = h('div.adm-grid.adm-grid--2', null,
    panel({
      title: 'Uploads per day',
      sub: 'API and CLI uploads, last 30 days',
      body: v ? barChart({ data: series.map((d) => ({ day: d.day, value: d.uploads })), label: 'Uploads', total: num(uploadsTotal), note: `${bytes(series.reduce((n, d) => n + d.bytes, 0))} in 30 days` }) : errorBox(vault.error),
    }),
    panel({
      title: 'Transfers per day',
      sub: 'Device-to-device sessions on the chain ledger',
      body: c ? barChart({ data: chainSeries.map((d) => ({ day: d.day, value: d.transfers })), label: 'Transfers', tone: 'moon', total: num(chainTotal), note: c.avg_completed_ms ? `average completed in ${(c.avg_completed_ms / 1000).toFixed(1)} s` : 'in 30 days' }) : errorBox(chain.error),
    }),
  );

  const lower = h('div.adm-grid.adm-grid--3', null,
    panel({
      title: 'Keys minted per day',
      sub: 'Last 30 days',
      body: v ? barChart({ data: series.map((d) => ({ day: d.day, value: d.keys })), label: 'Keys', tone: 'gold', total: num(keysTotal), note: 'in 30 days' }) : errorBox(vault.error),
    }),
    panel({
      title: 'What people share',
      sub: 'Uploads by file type, all time',
      body: v ? meters((v.mime_types ?? []).map((m) => ({ label: m.mime_type || 'unknown', value: m.n }))) : errorBox(vault.error),
    }),
    panel({
      title: 'Busiest keys',
      sub: 'By uploads, active keys only',
      flush: true,
      body: v ? keyFeed(v.top_keys ?? []) : errorBox(vault.error),
    }),
  );

  const activity = h('div.adm-grid.adm-grid--3', null,
    panel({ title: 'Latest uploads', sub: 'Newest share links', flush: true, body: uploads.ok ? uploadFeed(uploads.value.uploads ?? []) : errorBox(uploads.error), foot: [h('span', null, ''), h('a.link', { href: '#uploads' }, 'All uploads')] }),
    panel({ title: 'API transfer sessions', sub: 'Opened through /api/transfers', flush: true, body: transfers.ok ? transferFeed(transfers.value.transfers ?? []) : errorBox(transfers.error), foot: [h('span', null, ''), h('a.link', { href: '#transfers' }, 'All transfers')] }),
    panel({ title: 'Console sign-ins', sub: 'Most recent attempts', flush: true, body: logins.ok ? loginFeed(logins.value.logins ?? []) : errorBox(logins.error), foot: [h('span', null, ''), h('a.link', { href: '#security' }, 'Audit log')] }),
  );

  body.replaceChildren(
    alerts.length ? panel({ title: 'Needs attention', sub: alerts.some((a) => a.tone !== 'ok') ? 'Things worth a look' : 'All clear', body: h('ul.adm-alerts', null, alerts.map(alertRow)) }) : null,
    tiles,
    charts,
    lower,
    activity,
  );
}

function hint(n, text) {
  return [h('b', null, `+${num(n ?? 0)}`), ` ${text}`];
}

function unavailable(result) {
  return result.ok ? '' : 'unavailable';
}

function pct(part, whole) {
  if (!whole) return '—';
  return `${Math.round((Number(part) / Number(whole)) * 100)}%`;
}

function attention({ v, c, vault, chain, apiSum, health }) {
  /** @type {{ tone: 'warn'|'danger'|'ok', title: string, text: string, href?: string }[]} */
  const out = [];
  for (const p of health) {
    if (!p.ok) out.push({ tone: 'danger', title: `${p.name} is not answering`, text: `${p.host} — ${p.status ? `HTTP ${p.status}` : 'no response'}`, href: '#system' });
  }
  if (!vault.ok) out.push({ tone: 'danger', title: 'Vault admin data is unavailable', text: vault.error?.message ?? '', href: '#system' });
  if (!chain.ok) out.push({ tone: 'warn', title: 'Chain admin data is unavailable', text: chain.error?.message ?? 'Deploy the chain worker with the ADMIN_SESSIONS binding.', href: '#system' });
  if (!apiSum.ok) out.push({ tone: 'warn', title: 'API metrics are unavailable', text: apiSum.error?.message ?? '' });
  if (v && !v.storage?.configured) out.push({ tone: 'danger', title: 'No object storage is bound', text: 'Uploads fail until FILES (R2) or FILE_CHUNKS (KV) is bound to the vault worker.', href: '#system' });
  if (v && v.pending_deletions?.overdue > 0) out.push({ tone: 'warn', title: `${num(v.pending_deletions.overdue)} deletions are overdue`, text: 'Expired files still stored. Run the cleanup from System, or check the vault cron.', href: '#system' });
  if (v && v.keys?.unlimited_rate > 0) out.push({ tone: 'warn', title: `${num(v.keys.unlimited_rate)} active keys have no rate limit`, text: 'Owners chose "unlimited". Review them under API keys.', href: '#keys' });
  if (v && v.vault === null) out.push({ tone: 'warn', title: 'Vault sync tables are missing', text: 'Apply apps/vault-worker/migrations/0002_account_sync.sql to the D1 database.' });
  if (c && v && !out.length) out.push({ tone: 'ok', title: 'Everything is running', text: 'All workers answered and nothing needs attention.' });
  return out;
}

function alertRow(a) {
  return h(`li.adm-alert.adm-alert--${a.tone}`, null,
    h('span.adm-alert__icon', { 'aria-hidden': 'true' }, a.tone === 'ok' ? '✓' : '!'),
    h('div', null, h('b', null, a.title), a.text ? h('p', null, a.text) : null),
    a.href ? h('a.btn.btn--ghost.btn--xs', { href: a.href }, 'Open') : h('span'));
}

function feed(items, emptyText) {
  if (!items.length) return empty(emptyText);
  return h('ul.adm-feed', null, items);
}

function uploadFeed(rows) {
  return feed(rows.map((u) => h('li', null,
    h('span.adm-feed__icon', null, icon('file')),
    h('div.adm-cell-main', null, h('b', { title: u.filename }, u.filename), h('small', null, `${bytes(u.size_bytes)} · ${num(u.download_count)} downloads`)),
    h('div', { style: { display: 'grid', justifyItems: 'end', gap: '4px' } }, statusPill(u.status), time(u.upload_at)))), 'No uploads yet');
}

function transferFeed(rows) {
  return feed(rows.map((t) => h('li', null,
    h('span.adm-feed__icon', null, icon('swap')),
    h('div.adm-cell-main', null, h('b', null, t.file_name || t.code), h('small', null, `${t.code} · ${t.file_size_bytes != null ? bytes(t.file_size_bytes) : 'size unknown'}`)),
    h('div', { style: { display: 'grid', justifyItems: 'end', gap: '4px' } }, statusPill(t.status), time(t.created_at)))), 'No API transfer sessions');
}

function loginFeed(rows) {
  return feed(rows.map((l) => h('li', null,
    h(`span.adm-feed__icon.adm-feed__icon--${l.result === 'success' ? 'ok' : 'danger'}`, null, icon(l.result === 'success' ? 'check' : 'cross')),
    h('div.adm-cell-main', null, h('b', null, `${l.method === 'passkey' ? 'Passkey' : 'Secret'} · ${l.result}`), h('small', null, `${l.ip || 'unknown ip'}${l.country ? ` · ${l.country}` : ''} · ${device(l.ua)}`)),
    time(l.created_at))), 'No sign-ins recorded yet');
}

function keyFeed(rows) {
  return feed(rows.map((k) => h('li', null,
    h('span.adm-feed__icon', null, icon('key')),
    h('div.adm-cell-main', null, h('b', null, k.name), h('small', null, `${k.prefix}… · ${k.kind}`)),
    h('div', { style: { textAlign: 'right' } }, h('b.adm-mono', null, num(k.total_uploads)), h('div.adm-dim', null, bytes(k.total_bytes))))), 'No key has uploaded yet');
}
