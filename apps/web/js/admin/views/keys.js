/* /admin — API keys: every key minted, its limits and its use. */

import { api, VAULT } from '../api.js';
import {
  h, num, bytes, time, rate, short, statusPill, table, pager, panel, tabs, searchBox, select,
  loading, errorBox, dialog, busy,
} from '../ui.js';

const state = { status: 'active', kind: 'all', q: '', sort: 'created', offset: 0, limit: 50 };

const RATE_OPTIONS = [['30', '30 / min'], ['60', '60 / min'], ['120', '120 / min'], ['600', '600 / min'], ['6000', '6,000 / min'], ['-1', 'Unlimited']];
const SIZE_OPTIONS = [
  [String(10 * 1024 ** 2), '10 MB'], [String(100 * 1024 ** 2), '100 MB'], [String(1024 ** 3), '1 GB'],
  [String(5 * 1024 ** 3), '5 GB'], ['-1', 'Unlimited (5 GB ceiling)'],
];

/** Keeps a key's current value selectable even when it is not a preset. */
function withCurrent(options, value, format) {
  const v = String(value);
  return options.some(([o]) => o === v) ? options : [[v, `${format(value)} (current)`], ...options];
}

/** Row actions for a key, shared with the user drawer. @param {any} k @param {() => void} after */
export function keyActions(k, after) {
  const revoked = Boolean(k.revoked_at);
  return h('div.adm-row-actions', null,
    !revoked ? h('button.btn.btn--ghost.btn--xs', {
      type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget;
        const values = await dialog({
          title: 'Edit key',
          text: `${k.prefix}… · owned by ${k.user_email || short(k.user_id, 14, 4)}`,
          confirm: 'Save',
          fields: [
            { name: 'name', label: 'Label', value: k.name, required: true },
            { name: 'rate', label: 'Rate limit', value: String(k.rate_per_minute), options: withCurrent(RATE_OPTIONS, k.rate_per_minute, rate) },
            { name: 'size', label: 'Max file size', value: String(k.max_file_bytes), options: withCurrent(SIZE_OPTIONS, k.max_file_bytes, bytes) },
          ],
        });
        if (!values) return;
        await busy(btn, () => api(`${VAULT}/keys/${encodeURIComponent(k.id)}`, {
          method: 'PATCH',
          body: { name: values.name, ratePerMinute: Number(values.rate), maxFileBytes: Number(values.size) },
        }), 'Key updated');
        after();
      },
    }, 'Edit') : null,
    h(`button.btn.${revoked ? 'btn--ghost' : 'btn--danger-ghost'}.btn--xs`, {
      type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget;
        if (!revoked) {
          const ok = await dialog({ title: 'Revoke this key?', text: `“${k.name}” (${k.prefix}…) stops working at once. Its uploads stay up. You can restore it later.`, confirm: 'Revoke', danger: true });
          if (!ok) return;
        }
        await busy(btn, () => api(`${VAULT}/keys/${encodeURIComponent(k.id)}/${revoked ? 'restore' : 'revoke'}`, { method: 'POST' }), revoked ? 'Key restored' : 'Key revoked');
        after();
      },
    }, revoked ? 'Restore' : 'Revoke'));
}

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  const toolbar = h('div.adm-toolbar', null,
    searchBox(state.q, (q) => { state.q = q; state.offset = 0; ctx.rerender(); }, 'Search label, prefix, owner…'),
    tabs([['active', 'Active'], ['revoked', 'Revoked'], ['all', 'All']], state.status, (v) => { state.status = v; state.offset = 0; ctx.rerender(); }, 'Key status'),
    select([['all', 'All owners'], ['account', 'Accounts'], ['anonymous', 'Anonymous']], state.kind, (v) => { state.kind = v; state.offset = 0; ctx.rerender(); }, 'Owner kind'),
    h('span.adm-toolbar__spacer'),
    select([['created', 'Newest first'], ['usage', 'Most uploads']], state.sort, (v) => { state.sort = v; state.offset = 0; ctx.rerender(); }, 'Sort'));

  const holder = h('div', null, loading(8));
  body.replaceChildren(toolbar, holder);

  const params = new URLSearchParams({ status: state.status, kind: state.kind, q: state.q, sort: state.sort, limit: String(state.limit), offset: String(state.offset) });
  try {
    const data = await api(`${VAULT}/keys?${params}`);
    if (state.status === 'active' && state.kind === 'all' && !state.q) ctx.setCounts({ keys: data.total });
    holder.replaceChildren(panel({
      title: `${num(data.total)} ${state.status === 'all' ? '' : `${state.status} `}${data.total === 1 ? 'key' : 'keys'}`,
      sub: 'Only a key\'s hash is stored; the prefix is what its owner sees.',
      flush: true,
      body: table({
        rows: data.keys,
        emptyText: state.q ? 'No key matches that search' : 'No keys here',
        onRow: (k) => import('./users.js').then((m) => m.openUser(k.user_id, ctx)),
        columns: [
          { label: 'Key', cell: (k) => h('div.adm-cell-main', null, h('b', { title: k.name }, k.name), h('small', null, `${k.prefix}…`)) },
          { label: 'Owner', cell: (k) => h('div.adm-cell-main', null, h('b', null, k.user_email || (k.kind === 'anonymous' ? 'Anonymous' : 'Account')), h('small', { title: k.user_id }, short(k.user_id, 12, 4))) },
          { label: 'Status', cell: (k) => statusPill(k.revoked_at ? 'revoked' : 'active') },
          { label: 'Rate', className: 'num', cell: (k) => rate(k.rate_per_minute) },
          { label: 'Max file', className: 'num', cell: (k) => bytes(k.max_file_bytes) },
          { label: 'Uploads', className: 'num', cell: (k) => num(k.total_uploads) },
          { label: 'Shipped', className: 'num', cell: (k) => bytes(k.total_bytes) },
          { label: 'Created', cell: (k) => time(k.created_at) },
          { label: 'Last used', cell: (k) => time(k.last_used_at) },
          { label: '', className: 'actions', cell: (k) => keyActions(k, () => ctx.rerender()) },
        ],
      }),
      foot: pager(data, (offset) => { state.offset = offset; ctx.rerender(); }),
    }));
  } catch (err) {
    holder.replaceChildren(panel({ title: 'API keys', body: errorBox(err, () => ctx.rerender()) }));
  }
}

