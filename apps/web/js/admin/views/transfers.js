/* /admin — Transfers: the chain ledger and the API's transfer sessions. */

import { api, API, CHAIN } from '../api.js';
import {
  h, num, bytes, time, duration, short, statusPill, pill, copyChip, table, pager, panel, tabs, select,
  searchBox, loading, errorBox, kv, openDrawer, dialog, busy, empty,
} from '../ui.js';

const state = { tab: 'chain', status: '', chain: '', offset: 0, limit: 25, apiStatus: '' };

const CHAIN_STATUSES = [['', 'Any status'], ['registered', 'Registered'], ['waiting_peer', 'Waiting for peer'], ['connecting', 'Connecting'], ['transferring', 'Transferring'], ['completed', 'Completed'], ['failed', 'Failed'], ['cancelled', 'Cancelled'], ['abandoned', 'Abandoned']];
const API_STATUSES = [['', 'Any status'], ['created', 'Created'], ['connected', 'Connected'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['expired', 'Expired']];

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  const switcher = tabs([['chain', 'Chain ledger'], ['api', 'API sessions']], state.tab, (t) => { state.tab = t; state.offset = 0; ctx.rerender(); }, 'Transfer source');
  const holder = h('div', null, loading(8));

  if (state.tab === 'chain') {
    body.replaceChildren(h('div.adm-toolbar', null, switcher,
      searchBox(state.chain, (q) => { state.chain = q.toLowerCase(); state.offset = 0; ctx.rerender(); }, 'Chain id or session id prefix…'),
      h('span.adm-toolbar__spacer'),
      select(CHAIN_STATUSES, state.status, (v) => { state.status = v; state.offset = 0; ctx.rerender(); }, 'Status')), holder);
    await renderChain(holder, ctx);
  } else {
    body.replaceChildren(h('div.adm-toolbar', null, switcher, h('span.adm-toolbar__spacer'),
      select(API_STATUSES, state.apiStatus, (v) => { state.apiStatus = v; ctx.rerender(); }, 'Status')), holder);
    await renderApi(holder, ctx);
  }
}

async function renderChain(holder, ctx) {
  const params = new URLSearchParams({ limit: String(state.limit), offset: String(state.offset) });
  if (state.status) params.set('status', state.status);
  if (/^[0-9a-f]{4,32}$/.test(state.chain)) params.set('chain', state.chain);
  try {
    const [list, summary] = await Promise.all([
      api(`${CHAIN}/transfers?${params}`),
      api(`${CHAIN}/summary`).catch(() => null),
    ]);
    const total = list.total ?? list.count;
    holder.replaceChildren(
      summary ? h('div.adm-tiles', null,
        Object.entries(summary.by_status ?? {}).sort((a, b) => b[1] - a[1]).map(([status, n]) =>
          h('button.adm-tile', { type: 'button', onclick: () => { state.status = status; state.offset = 0; ctx.rerender(); } },
            h('span.adm-tile__label', null, status.replace(/_/g, ' ')),
            h('span.adm-tile__value', null, num(n)))),
        h('article.adm-tile', null,
          h('span.adm-tile__label', null, 'Routes'),
          h('span.adm-tile__value', null, num(Object.keys(summary.by_route ?? {}).length)),
          h('span.adm-tile__hint', null, Object.entries(summary.by_route ?? {}).map(([r, n]) => `${r} ${num(n)}`).join(' · '))),
        h('article.adm-tile', null,
          h('span.adm-tile__label', null, 'Ledger height'),
          h('span.adm-tile__value', null, num(summary.ledger_height)),
          h('span.adm-tile__hint', null, `${num(summary.counts?.chain_ids)} chain ids`))) : null,
      panel({
        title: `${num(total)} sessions`,
        sub: 'No file names are ever stored on the ledger — only type, size and an optional content hash.',
        flush: true,
        body: table({
          rows: list.transfers ?? [],
          emptyText: 'No sessions match',
          onRow: (t) => openChainSession(t.id),
          columns: [
            { label: 'Session', cell: (t) => h('div.adm-cell-main', null, h('b.adm-mono', null, short(t.id, 8, 4)), h('small', null, `from ${short(t.sender_chain_id, 6, 4)}${t.receiver_chain_id ? ` → ${short(t.receiver_chain_id, 6, 4)}` : ''}`)) },
            { label: 'Status', cell: (t) => statusPill(t.status) },
            { label: 'Route', cell: (t) => pill(t.route, '', true) },
            { label: 'Files', className: 'num', cell: (t) => num(t.files?.length ?? 0) },
            { label: 'Size', className: 'num', cell: (t) => bytes((t.files ?? []).reduce((n, f) => n + (Number(f.size) || 0), 0)) },
            { label: 'Duration', className: 'num', cell: (t) => (t.duration_ms != null ? duration(t.duration_ms) : '—') },
            { label: 'Started', cell: (t) => time(t.started_at) },
          ],
        }),
        foot: pager({ total, limit: state.limit, offset: state.offset }, (offset) => { state.offset = offset; ctx.rerender(); }),
      }));
  } catch (err) {
    holder.replaceChildren(panel({
      title: 'Chain ledger',
      body: errorBox(err.status === 401 || err.status === 404
        ? { message: `${err.message} The chain worker needs the ADMIN_SESSIONS binding from this release to accept console sessions.` }
        : err, () => ctx.rerender()),
    }));
  }
}

async function openChainSession(id) {
  const holder = h('div', null, loading(6));
  openDrawer('Transfer session', holder);
  try {
    const s = await api(`/chain/session/${encodeURIComponent(id)}`);
    holder.replaceChildren(
      h('div.adm-toolbar', null, statusPill(s.status), pill(s.route, '', true), copyChip(s.id, short(s.id, 12, 6))),
      kv([
        ['Ledger index', num(s.ledger_index)],
        ['Record hash', h('span', { title: s.record_hash }, short(s.record_hash, 14, 8))],
        ['Previous hash', h('span', { title: s.previous_hash }, short(s.previous_hash, 14, 8))],
        ['Sender chain id', s.sender_chain_id],
        ['Receiver chain id', s.receiver_chain_id || '—'],
        ['Started', time(s.started_at)],
        ['Completed', s.completed_at ? time(s.completed_at) : '—'],
        ['Duration', s.duration_ms != null ? duration(s.duration_ms) : '—'],
      ]),
      panel({
        title: 'Files',
        flush: true,
        body: table({
          rows: s.files ?? [],
          columns: [
            { label: 'Kind', cell: (f) => f.category },
            { label: 'Type', cell: (f) => h('span.adm-dim', null, f.type) },
            { label: 'Size', className: 'num', cell: (f) => bytes(f.size) },
            { label: 'SHA-256', cell: (f) => (f.hash ? h('span.adm-dim', { title: f.hash }, short(f.hash, 10, 6)) : '—') },
          ],
        }),
      }),
      panel({
        title: 'Timeline',
        flush: true,
        body: (s.events ?? []).length
          ? h('ul.adm-feed', null, s.events.map((e) => h('li', null, statusPill(e.status), h('span'), time(e.ts))))
          : empty('No events'),
      }));
  } catch (err) {
    holder.replaceChildren(errorBox(err));
  }
}

async function renderApi(holder, ctx) {
  const params = new URLSearchParams({ limit: '200' });
  if (state.apiStatus) params.set('status', state.apiStatus);
  try {
    const data = await api(`${API}/transfers?${params}`);
    holder.replaceChildren(
      h('div.adm-tiles', null, Object.entries(data.counts ?? {}).map(([status, n]) =>
        h('button.adm-tile', { type: 'button', onclick: () => { state.apiStatus = status; ctx.rerender(); } },
          h('span.adm-tile__label', null, status),
          h('span.adm-tile__value', null, num(n))))),
      panel({
        title: `${num(data.total)} sessions in KV`,
        sub: 'Metadata sessions created through POST /api/transfers. They expire on their own after their TTL.',
        flush: true,
        body: table({
          rows: data.transfers ?? [],
          emptyText: 'No API transfer sessions',
          onRow: (t) => openApiTransfer(t.transfer_id, ctx),
          columns: [
            { label: 'File', cell: (t) => h('div.adm-cell-main', null, h('b', null, t.file_name || 'Unnamed'), h('small', null, t.file_mime || '—')) },
            { label: 'Code', cell: (t) => copyChip(t.code) },
            { label: 'Status', cell: (t) => statusPill(t.status) },
            { label: 'Size', className: 'num', cell: (t) => (t.file_size_bytes != null ? bytes(t.file_size_bytes) : '—') },
            { label: 'Client', cell: (t) => h('span.adm-dim', null, t.client_label || '—') },
            { label: 'Events', className: 'num', cell: (t) => num(t.events_count) },
            { label: 'Created', cell: (t) => time(t.created_at) },
            { label: 'Expires', cell: (t) => time(t.expires_at) },
            { label: '', className: 'actions', cell: (t) => cancelButton(t, () => ctx.rerender()) },
          ],
        }),
        foot: [h('span', null, `Showing ${num(data.count)} newest`)],
      }));
  } catch (err) {
    holder.replaceChildren(panel({ title: 'API sessions', body: errorBox(err, () => ctx.rerender()) }));
  }
}

function cancelButton(t, after) {
  if (!['created', 'connected'].includes(t.status)) return null;
  return h('button.btn.btn--danger-ghost.btn--xs', {
    type: 'button',
    onclick: async (e) => {
      const btn = e.currentTarget;
      const ok = await dialog({ title: 'Cancel this transfer?', text: `Code ${t.code} will report "cancelled" to both ends.`, confirm: 'Cancel transfer', danger: true });
      if (!ok) return;
      await busy(btn, () => api(`${API}/transfers/${encodeURIComponent(t.transfer_id)}`, { method: 'DELETE' }), 'Transfer cancelled');
      after();
    },
  }, 'Cancel');
}

async function openApiTransfer(id, ctx) {
  const holder = h('div', null, loading(6));
  openDrawer('API transfer', holder);
  try {
    const { transfer: t } = await api(`${API}/transfers/${encodeURIComponent(id)}`);
    holder.replaceChildren(
      h('div.adm-toolbar', null, statusPill(t.status), copyChip(t.code), copyChip(t.receive_url, 'Receive link'), cancelButton({ ...t, transfer_id: t.id }, () => { openApiTransfer(id, ctx); ctx.rerender(); })),
      kv([
        ['File', t.file_name || '—'],
        ['Type', t.file_mime || '—'],
        ['Size', t.file_size_bytes != null ? bytes(t.file_size_bytes) : '—'],
        ['Route', t.route || '—'],
        ['Client', t.client_label || '—'],
        ['Created', time(t.created_at)],
        ['Expires', time(t.expires_at)],
      ]),
      panel({
        title: 'Events',
        flush: true,
        body: table({
          rows: [...(t.events ?? [])].reverse(),
          columns: [
            { label: 'Event', cell: (e) => h('b.adm-mono', null, e.type) },
            { label: 'Details', cell: (e) => h('span.adm-dim', { title: JSON.stringify(e.details ?? {}) }, e.details ? JSON.stringify(e.details).slice(0, 80) : '—') },
            { label: 'When', cell: (e) => time(e.ts) },
          ],
        }),
      }));
  } catch (err) {
    holder.replaceChildren(errorBox(err));
  }
}
