/* /admin — Users: everyone who holds something on Clex, and what they hold. */

import { api, VAULT } from '../api.js';
import {
  h, num, bytes, time, rate, short, pill, statusPill, copyChip, table, pager, panel, tabs, searchBox, select,
  loading, errorBox, kv, openDrawer, closeDrawer, dialog, busy,
} from '../ui.js';
import { keyActions } from './keys.js';
import { uploadActions } from './uploads.js';

const state = { q: '', kind: 'all', sort: 'activity', offset: 0, limit: 50 };

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  const toolbar = h('div.adm-toolbar', null,
    searchBox(state.q, (q) => { state.q = q; state.offset = 0; ctx.rerender(); }, 'Search by email or user id…'),
    tabs([['all', 'All'], ['account', 'Accounts'], ['anonymous', 'Anonymous']], state.kind, (k) => { state.kind = k; state.offset = 0; ctx.rerender(); }, 'User kind'),
    h('span.adm-toolbar__spacer'),
    select([['activity', 'Recently active'], ['uploads', 'Most uploads']], state.sort, (v) => { state.sort = v; state.offset = 0; ctx.rerender(); }, 'Sort'));

  const holder = h('div', null, loading(8));
  body.replaceChildren(toolbar, holder);

  const params = new URLSearchParams({ q: state.q, kind: state.kind, sort: state.sort, limit: String(state.limit), offset: String(state.offset) });
  try {
    const data = await api(`${VAULT}/users?${params}`);
    ctx.setCounts({ users: state.q || state.kind !== 'all' ? undefined : data.total });
    holder.replaceChildren(panel({
      title: `${num(data.total)} ${data.total === 1 ? 'user' : 'users'}`,
      sub: 'Anonymous users are devices that minted a key without an account; their id is a keyed hash, not a person.',
      flush: true,
      body: table({
        rows: data.users,
        onRow: (u) => openUser(u.uid, ctx),
        emptyText: state.q ? 'No user matches that search' : 'No users yet',
        columns: [
          { label: 'User', cell: (u) => h('div.adm-cell-main', null, h('b', null, u.email || (u.kind === 'anonymous' ? 'Anonymous device' : 'Signed-in account')), h('small', { title: u.uid }, short(u.uid, 14, 6))) },
          { label: 'Kind', cell: (u) => statusPill(u.kind) },
          { label: 'Keys', className: 'num', cell: (u) => `${num(u.keys_active)} / ${num(u.keys_total)}` },
          { label: 'Uploads', className: 'num', cell: (u) => num(u.uploads) },
          { label: 'Shared', className: 'num', cell: (u) => bytes(u.upload_bytes) },
          { label: 'Vault', className: 'num', cell: (u) => (u.vault_since ? `${num(u.vault_items)} items` : '—') },
          { label: 'First seen', cell: (u) => time(u.first_seen) },
          { label: 'Last active', cell: (u) => time(u.last_active) },
        ],
      }),
      foot: pager(data, (offset) => { state.offset = offset; ctx.rerender(); }),
    }));
  } catch (err) {
    holder.replaceChildren(panel({ title: 'Users', body: errorBox(err, () => ctx.rerender()) }));
  }
}

/** Opens one user in the drawer. Exported so other views can link to a user. */
export async function openUser(uid, ctx) {
  const holder = h('div', null, loading(10));
  openDrawer('User', holder);
  let data;
  try {
    data = await api(`${VAULT}/users/${encodeURIComponent(uid)}`);
  } catch (err) {
    holder.replaceChildren(errorBox(err, () => openUser(uid, ctx)));
    return;
  }
  const { user, keys, uploads, attachments, vault, devices, quota_today_bytes: quota } = data;
  document.getElementById('adm-drawer-title').textContent = user.email || (user.kind === 'anonymous' ? 'Anonymous device' : 'Account');

  const reopen = () => { openUser(uid, ctx); ctx.rerender(); };

  const actions = h('div.adm-toolbar', null,
    h('button.btn.btn--ghost.btn--sm', {
      type: 'button',
      disabled: !user.keys_active,
      onclick: async (e) => {
        const btn = e.currentTarget
        const ok = await dialog({ title: 'Revoke every key?', text: `All ${user.keys_active} active keys stop working immediately. Revoked keys can be restored one by one.`, confirm: 'Revoke keys', danger: true });
        if (!ok) return;
        await busy(btn, () => api(`${VAULT}/users/${encodeURIComponent(uid)}/revoke-keys`, { method: 'POST' }), (r) => `${r.keys_revoked} keys revoked`);
        reopen();
      },
    }, 'Revoke all keys'),
    h('button.btn.btn--ghost.btn--sm', {
      type: 'button',
      disabled: !uploads.some((u) => u.status === 'active'),
      onclick: async (e) => {
        const btn = e.currentTarget
        const ok = await dialog({ title: 'Take down every upload?', text: 'Each share link stops working and its bytes are deleted. This cannot be undone.', confirm: 'Take down', danger: true });
        if (!ok) return;
        await busy(btn, () => api(`${VAULT}/users/${encodeURIComponent(uid)}/revoke-uploads`, { method: 'POST' }), (r) => `${r.uploads_revoked} uploads taken down`);
        reopen();
      },
    }, 'Take down uploads'),
    vault ? h('button.btn.btn--danger-ghost.btn--sm', {
      type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget
        const ok = await dialog({ title: 'Wipe this synced Vault?', text: 'Deletes every synced note and folder and the account\'s Vault key from the server. Copies on the user\'s devices are untouched, but they can no longer sync. Cannot be undone.', confirm: 'Wipe Vault', danger: true, typeToConfirm: 'wipe' });
        if (!ok) return;
        await busy(btn, () => api(`${VAULT}/users/${encodeURIComponent(uid)}/wipe-vault`, { method: 'POST', body: { confirm: uid } }), (r) => `${r.vault_items_deleted ?? 0} Vault items deleted`);
        reopen();
      },
    }, 'Wipe Vault') : null,
    h('button.btn.btn--danger.btn--sm', {
      type: 'button',
      onclick: async (e) => {
        const btn = e.currentTarget
        const ok = await dialog({ title: 'Purge everything for this user?', text: 'Revokes every key, takes down every upload and deletes its bytes, deletes Vault attachments, and wipes the synced Vault. Use for abuse or a deletion request. Cannot be undone.', confirm: 'Purge user', danger: true, typeToConfirm: 'purge' });
        if (!ok) return;
        const r = await busy(btn, () => api(`${VAULT}/users/${encodeURIComponent(uid)}/purge`, { method: 'POST', body: { confirm: uid } }), 'User purged');
        if (r) { closeDrawer(); ctx.rerender(); }
      },
    }, 'Purge user'));

  holder.replaceChildren(
    h('div.adm-toolbar', null, statusPill(user.kind), copyChip(user.uid, short(user.uid, 18, 6)), user.email ? copyChip(user.email) : null),
    kv([
      ['First seen', time(user.first_seen)],
      ['Last active', time(user.last_active)],
      ['Keys', `${num(user.keys_active)} active of ${num(user.keys_total)}`],
      ['Uploads', `${num(user.uploads)} · ${bytes(user.upload_bytes)}`],
      ['Vault attachments', num(user.attachments)],
      ['Uploaded today (Vault quota)', bytes(quota)],
      ['Synced Vault', vault ? `${num(vault.items - vault.tombstones)} items · ${bytes(vault.payload_bytes)} · since ${new Date((user.vault_since || 0) * 1000).toLocaleDateString()}` : 'Not synced'],
      ['Devices', devices.length ? devices.map((d) => d.name).join(', ') : 'None registered'],
    ]),
    actions,
    panel({
      title: 'API keys',
      flush: true,
      body: table({
        rows: keys,
        emptyText: 'No keys',
        columns: [
          { label: 'Key', cell: (k) => h('div.adm-cell-main', null, h('b', null, k.name), h('small', null, `${k.prefix}…`)) },
          { label: 'Status', cell: (k) => statusPill(k.revoked_at ? 'revoked' : 'active') },
          { label: 'Limits', cell: (k) => h('span.adm-dim', null, `${rate(k.rate_per_minute)} · ${bytes(k.max_file_bytes)}`) },
          { label: 'Uploads', className: 'num', cell: (k) => num(k.total_uploads) },
          { label: 'Last used', cell: (k) => time(k.last_used_at) },
          { label: '', className: 'actions', cell: (k) => keyActions(k, reopen) },
        ],
      }),
    }),
    panel({
      title: 'Uploads',
      sub: uploads.length >= 100 ? 'Newest 100' : undefined,
      flush: true,
      body: table({
        rows: uploads,
        emptyText: 'No uploads',
        columns: [
          { label: 'File', cell: (u) => h('div.adm-cell-main', null, h('b', { title: u.filename }, u.filename), h('small', null, `${bytes(u.size_bytes)} · ${u.mime_type}`)) },
          { label: 'Status', cell: (u) => statusPill(u.status) },
          { label: 'Downloads', className: 'num', cell: (u) => num(u.download_count) },
          { label: 'Uploaded', cell: (u) => time(u.upload_at) },
          { label: '', className: 'actions', cell: (u) => uploadActions(u, reopen) },
        ],
      }),
    }),
    attachments.length
      ? panel({
        title: 'Vault attachments',
        flush: true,
        body: table({
          rows: attachments,
          columns: [
            { label: 'File', cell: (a) => h('div.adm-cell-main', null, h('b', null, a.filename), h('small', null, `${bytes(a.size_bytes)} · ${a.mime_type}`)) },
            { label: 'Uploaded', cell: (a) => time(a.upload_at) },
            { label: 'Deletes', cell: (a) => time(a.delete_at) },
          ],
        }),
      })
      : null,
    vault?.kinds ? h('div.adm-toolbar', null, Object.entries(vault.kinds).map(([k, n]) => pill(`${num(n)} ${k}s`, 'moon', true))) : null,
  );
}

