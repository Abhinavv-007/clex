/* /admin — Vault: synced accounts, attachments and secret links. */

import { api, settle, VAULT } from '../api.js';
import {
  h, num, compact, bytes, time, short, statusPill, pill, table, pager, panel, tile, searchBox,
  loading, errorBox, dialog, busy,
} from '../ui.js';

const state = { q: '', offset: 0, limit: 25 };

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  if (!body.childElementCount) body.append(loading(6));
  const params = new URLSearchParams({ q: state.q, limit: String(state.limit), offset: String(state.offset) });
  const [summary, attachments, secrets] = await Promise.all([
    settle(api(`${VAULT}/summary`)),
    settle(api(`${VAULT}/attachments?${params}`)),
    settle(api(`${VAULT}/secrets?limit=100`)),
  ]);

  const v = summary.ok ? summary.value : null;
  const tiles = h('div.adm-tiles', null,
    tile({ label: 'Synced accounts', value: v?.vault ? compact(v.vault.accounts) : '—', hint: v?.vault ? 'one Vault key each' : 'sync tables missing', tone: 'jade' }),
    tile({ label: 'Notes', value: v?.vault ? compact(v.vault.notes) : '—', hint: v?.vault ? `${num(v.vault.folders)} folders` : '' }),
    tile({ label: 'Encrypted payload', value: v?.vault ? bytes(v.vault.payload_bytes) : '—', hint: 'ciphertext held for sync' }),
    tile({ label: 'Attachments', value: v ? compact(v.attachments?.live) : '—', hint: v ? `${bytes(v.attachments?.bytes)} · deleted after 24 h` : '' }),
    tile({ label: 'Secret links', value: v ? `${compact(v.secrets?.count)}${v.secrets?.capped ? '+' : ''}` : '—', hint: 'waiting to be opened or to expire' }),
    tile({ label: 'Deletion queue', value: v ? compact(v.pending_deletions?.total) : '—', hint: v ? `${num(v.pending_deletions?.overdue)} overdue` : '', tone: v?.pending_deletions?.overdue ? 'warn' : undefined }),
  );

  const attachmentsPanel = attachments.ok
    ? panel({
      title: 'Attachments',
      sub: 'Files attached to Vault notes. Encrypted before upload; removed automatically after a day.',
      actions: searchBox(state.q, (q) => { state.q = q; state.offset = 0; ctx.rerender(); }, 'File name or user id…'),
      flush: true,
      body: table({
        rows: attachments.value.attachments,
        emptyText: 'No attachments stored',
        onRow: (a) => import('./users.js').then((m) => m.openUser(a.user_id, ctx)),
        columns: [
          { label: 'File', cell: (a) => h('div.adm-cell-main', null, h('b', { title: a.filename }, a.filename), h('small', null, a.mime_type)) },
          { label: 'Size', className: 'num', cell: (a) => bytes(a.size_bytes) },
          { label: 'Owner', cell: (a) => h('span.adm-dim', { title: a.user_id }, short(a.user_id, 12, 4)) },
          { label: 'Uploaded', cell: (a) => time(a.upload_at) },
          { label: 'Deletes', cell: (a) => time(a.delete_at) },
          {
            label: '', className: 'actions', cell: (a) => h('button.btn.btn--danger-ghost.btn--xs', {
              type: 'button',
              onclick: async (e) => {
                const btn = e.currentTarget;
                const ok = await dialog({ title: 'Delete this attachment?', text: `“${a.filename}” is removed from storage now.`, confirm: 'Delete', danger: true });
                if (!ok) return;
                await busy(btn, () => api(`${VAULT}/attachments/${encodeURIComponent(a.id)}`, { method: 'DELETE' }), 'Attachment deleted');
                ctx.rerender();
              },
            }, 'Delete'),
          },
        ],
      }),
      foot: pager(attachments.value, (offset) => { state.offset = offset; ctx.rerender(); }),
    })
    : panel({ title: 'Attachments', body: errorBox(attachments.error, () => ctx.rerender()) });

  const secretsPanel = secrets.ok
    ? panel({
      title: 'Secret links',
      sub: 'Only metadata: the payload is ciphertext and its key lives in the link fragment, which never reaches the server.',
      flush: true,
      body: table({
        rows: secrets.value.secrets,
        emptyText: 'No live secret links',
        columns: [
          { label: 'Secret', cell: (x) => h('div.adm-cell-main', null, h('b', null, x.title || 'Untitled secret'), h('small', null, short(x.id, 10, 4))) },
          { label: 'State', cell: (x) => statusPill(x.opened ? 'opened' : 'unread') },
          {
            label: 'Protections', cell: (x) => h('div.adm-row-actions', null,
              x.policy?.viewOnce ? pill('view once', '', true) : null,
              x.policy?.timedView ? pill(`${x.policy.viewWindowSeconds}s`, '', true) : null,
              x.policy?.devtoolsGuard ? pill('guarded', '', true) : null),
          },
          { label: 'Size', className: 'num', cell: (x) => bytes(x.size) },
          { label: 'Created', cell: (x) => time(x.created_at) },
          { label: 'Expires', cell: (x) => time(x.expires_at) },
          {
            label: '', className: 'actions', cell: (x) => h('button.btn.btn--danger-ghost.btn--xs', {
              type: 'button',
              onclick: async (e) => {
                const btn = e.currentTarget;
                const ok = await dialog({ title: 'Burn this secret?', text: 'The link will report the secret as gone. Use this for abuse reports.', confirm: 'Burn', danger: true });
                if (!ok) return;
                await busy(btn, () => api(`${VAULT}/secrets/${encodeURIComponent(x.id)}`, { method: 'DELETE' }), 'Secret burned');
                ctx.rerender();
              },
            }, 'Burn'),
          },
        ],
      }),
      foot: secrets.value.more ? [h('span', null, 'Showing the first 100')] : null,
    })
    : panel({ title: 'Secret links', body: errorBox(secrets.error, () => ctx.rerender()) });

  body.replaceChildren(summary.ok ? tiles : panel({ title: 'Vault', body: errorBox(summary.error, () => ctx.rerender()) }), attachmentsPanel, secretsPanel);
}
