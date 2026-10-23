/* /admin — Uploads: every share link and the file behind it. */

import { api, VAULT } from '../api.js';
import {
  h, icon, num, bytes, time, short, statusPill, copyChip, table, pager, panel, tabs, searchBox, select,
  loading, errorBox, dialog, busy,
} from '../ui.js';

const state = { status: 'active', q: '', sort: 'newest', offset: 0, limit: 50 };

/** Row actions for an upload, shared with the user drawer. */
export function uploadActions(u, after) {
  const live = u.status === 'active';
  return h('div.adm-row-actions', null,
    live ? h('a.btn.btn--ghost.btn--xs', { href: u.share_url, target: '_blank', rel: 'noopener noreferrer', title: 'Open the share page' }, icon('external', 13)) : null,
    live ? copyChip(u.share_url, 'Link') : null,
    live ? h('button.btn.btn--danger-ghost.btn--xs', {
      type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget;
        const ok = await dialog({
          title: 'Take this file down?',
          text: `“${u.filename}” (${bytes(u.size_bytes)}) stops downloading at once and its bytes are deleted. The owner sees the link as revoked.`,
          confirm: 'Take down',
          danger: true,
        });
        if (!ok) return;
        await busy(btn, () => api(`${VAULT}/uploads/${encodeURIComponent(u.id)}/revoke`, { method: 'POST' }), 'Upload taken down');
        after();
      },
    }, 'Take down') : null);
}

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  const toolbar = h('div.adm-toolbar', null,
    searchBox(state.q, (q) => { state.q = q; state.offset = 0; ctx.rerender(); }, 'Search file, token, type, owner…'),
    tabs([['active', 'Live'], ['expired', 'Expired'], ['revoked', 'Taken down'], ['all', 'All']], state.status, (v) => { state.status = v; state.offset = 0; ctx.rerender(); }, 'Upload status'),
    h('span.adm-toolbar__spacer'),
    select([['newest', 'Newest first'], ['size', 'Largest first'], ['downloads', 'Most downloaded']], state.sort, (v) => { state.sort = v; state.offset = 0; ctx.rerender(); }, 'Sort'));

  const holder = h('div', null, loading(8));
  body.replaceChildren(toolbar, holder);

  const params = new URLSearchParams({ status: state.status, q: state.q, sort: state.sort, limit: String(state.limit), offset: String(state.offset) });
  try {
    const data = await api(`${VAULT}/uploads?${params}`);
    if (state.status === 'active' && !state.q) ctx.setCounts({ uploads: data.total });
    holder.replaceChildren(panel({
      title: `${num(data.total)} ${data.total === 1 ? 'upload' : 'uploads'}`,
      sub: 'Expired bytes are removed by the hourly cleanup; the record stays for history.',
      flush: true,
      body: table({
        rows: data.uploads,
        emptyText: state.q ? 'No upload matches that search' : 'Nothing here',
        onRow: (u) => import('./users.js').then((m) => m.openUser(u.user_id, ctx)),
        columns: [
          { label: 'File', cell: (u) => h('div.adm-cell-main', null, h('b', { title: u.filename }, u.filename), h('small', null, u.mime_type)) },
          { label: 'Status', cell: (u) => statusPill(u.status) },
          { label: 'Size', className: 'num', cell: (u) => bytes(u.size_bytes) },
          { label: 'Downloads', className: 'num', cell: (u) => num(u.download_count) },
          { label: 'Owner', cell: (u) => h('span.adm-dim', { title: u.user_id }, short(u.user_id, 12, 4)) },
          { label: 'Via', cell: (u) => h('span.adm-dim', null, u.api_key_id ? 'API key' : 'Browser') },
          { label: 'Uploaded', cell: (u) => time(u.upload_at) },
          { label: 'Expires', cell: (u) => time(u.expires_at) },
          { label: '', className: 'actions', cell: (u) => uploadActions(u, () => ctx.rerender()) },
        ],
      }),
      foot: pager(data, (offset) => { state.offset = offset; ctx.rerender(); }),
    }));
  } catch (err) {
    holder.replaceChildren(panel({ title: 'Uploads', body: errorBox(err, () => ctx.rerender()) }));
  }
}
