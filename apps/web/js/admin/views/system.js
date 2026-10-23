/* /admin — System: every worker's health, bindings and config, and maintenance. */

import { api, settle, API, VAULT, CHAIN } from '../api.js';
import { h, num, time, duration, statusPill, pill, table, panel, kv, loading, errorBox, dialog, busy } from '../ui.js';

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  if (!body.childElementCount) body.append(loading(6));
  const [health, apiSum, vaultHealth, vaultSum, chainHealth] = await Promise.all([
    ctx.health(true),
    settle(api(`${API}/summary`)),
    settle(api(`${VAULT}/health`)),
    settle(api(`${VAULT}/summary`)),
    settle(api(`${CHAIN}/health`)),
  ]);

  const down = health.filter((p) => !p.ok).length;
  ctx.setBadge('system', down, down > 0);

  const healthGrid = h('div.adm-health', null, health.map((p) => h('article.adm-health__card', { 'data-state': p.ok ? (p.ms > 1200 ? 'slow' : 'up') : 'down' },
    h('div.adm-health__top', null,
      h('span.adm-health__name', null, h('span.status-dot'), p.name),
      statusPill(p.ok ? 'up' : 'failed')),
    h('div.adm-health__meta', null,
      h('span', null, p.host),
      h('span', null, `${p.ms} ms`),
      p.body?.version ? h('span', null, p.body.version) : null,
      p.status && !p.ok ? h('span', null, `HTTP ${p.status}`) : null))));

  const a = apiSum.ok ? apiSum.value : null;
  const vh = vaultHealth.ok ? vaultHealth.value : null;
  const vs = vaultSum.ok ? vaultSum.value : null;
  const ch = chainHealth.ok ? chainHealth.value : null;

  const yes = (v) => (v ? pill('bound', 'ok', true) : pill('missing', 'danger', true));
  const set = (v) => (v ? pill('set', 'ok', true) : pill('not set', 'warn', true));

  const apiPanel = panel({
    title: 'API worker',
    sub: 'clex.in/api/* · sign-in, sessions, transfer sessions',
    body: a ? kv([
      ['KV · DRIVE_SESSION_STORE', yes(a.bindings?.kv_drive_session_store)],
      ['Admin secret', set(a.config?.admin_secret_set)],
      ['Passkey relying party', a.config?.webauthn_rp_id || '—'],
      ['Allowed origins', a.config?.allowed_origin || '—'],
      ['Isolate up for', duration(a.process?.uptime_ms)],
      ['Requests seen by this isolate', num(a.metrics?.total_requests)],
    ]) : errorBox(apiSum.error),
  });

  const vaultPanel = panel({
    title: 'Vault worker',
    sub: 'clex.in/vault/api/* · keys, uploads, Vault, secrets',
    body: vh ? kv([
      ['D1 · clex-vault', vh.bindings?.d1 ? pill('reachable', 'ok', true) : pill('unreachable', 'danger', true)],
      ['Object storage', vh.storage?.configured ? pill(vh.storage.backend === 'r2' ? 'R2' : 'KV chunks', 'ok', true) : pill('none', 'danger', true)],
      ['KV · secrets, tokens, signals', yes(vh.bindings?.kv_vault_secrets && vh.bindings?.kv_vault_tokens && vh.bindings?.kv_vault_signals)],
      ['KV · upload quota', yes(vh.bindings?.kv_upload_quota)],
      ['Firebase project', vh.config?.firebase_project || '—'],
      ['Anonymous-key HMAC secret', set(vh.config?.anon_key_secret_set)],
      ['Max secret size', vh.config?.max_secret_size ? `${num(vh.config.max_secret_size)} chars` : '—'],
      ['D1 tables', vs ? `${vs.tables.length} · ${vs.tables.filter((t) => !t.startsWith('_') && t !== 'sqlite_sequence').join(', ')}` : '—'],
    ]) : errorBox(vaultHealth.error),
  });

  const chainPanel = panel({
    title: 'Chain worker',
    sub: 'clex.in/chain/* · public transfer ledger',
    body: ch ? kv([
      ['D1 · clex-chain', ch.bindings?.d1 ? pill('reachable', 'ok', true) : pill('unreachable', 'danger', true)],
      ['Durable Object · ledger', yes(ch.bindings?.durable_object_ledger)],
      ['Admin secret', set(ch.config?.admin_secret_set)],
    ]) : errorBox(chainHealth.error),
  });

  const routes = a?.metrics?.per_route ?? [];
  const metricsPanel = panel({
    title: 'API traffic by route',
    sub: 'Counted in the current isolate\'s memory only — Cloudflare runs many isolates and restarts them, so read this as a recent sample, not a total.',
    flush: true,
    body: a ? table({
      rows: routes,
      emptyText: 'No traffic seen by this isolate yet',
      columns: [
        { label: 'Route', cell: (r) => h('b.adm-mono', null, r.route) },
        { label: 'Requests', className: 'num', cell: (r) => num(r.total) },
        { label: 'Errors', className: 'num', cell: (r) => num(r.errors) },
        { label: 'Error rate', className: 'num', cell: (r) => (r.error_rate_pct != null ? `${r.error_rate_pct}%` : '—') },
        { label: 'Avg latency', className: 'num', cell: (r) => (r.avg_latency_ms != null ? `${r.avg_latency_ms} ms` : '—') },
        { label: 'Last hit', cell: (r) => time(r.last_seen) },
      ],
    }) : errorBox(apiSum.error),
    foot: a ? [h('span', null, `Status codes: ${Object.entries(a.metrics?.status_codes ?? {}).map(([c, n]) => `${c} × ${num(n)}`).join(' · ') || '—'}`)] : null,
  });

  const pending = vs?.pending_deletions;
  const maintenance = panel({
    title: 'Maintenance',
    sub: 'The vault worker runs this every hour. Run it now to clear expired files immediately.',
    body: h('div.adm-toolbar', null,
      h('div', null,
        h('b', null, `${num(pending?.total)} queued · ${num(pending?.overdue)} overdue`),
        h('p.adm-dim', null, 'Deletes the bytes of expired uploads and attachments.')),
      h('span.adm-toolbar__spacer'),
      h('button.btn.btn--primary.btn--sm', {
        type: 'button',
        onclick: async (e) => {
          const btn = e.currentTarget;
          const ok = await dialog({ title: 'Run cleanup now?', text: 'Every file past its expiry is deleted from storage.', confirm: 'Run cleanup' });
          if (!ok) return;
          await busy(btn, () => api(`${VAULT}/maintenance/cleanup`, { method: 'POST' }), (r) => `${num(r.removed)} expired files removed`);
          ctx.rerender();
        },
      }, 'Run cleanup')),
  });

  body.replaceChildren(
    panel({ title: 'Service health', sub: 'Public health endpoints, probed from this browser', body: healthGrid }),
    h('div.adm-grid.adm-grid--3', null, apiPanel, vaultPanel, chainPanel),
    maintenance,
    metricsPanel,
  );
}
