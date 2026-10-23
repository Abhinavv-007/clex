/* /admin — Security: console sessions, the sign-in log, passkeys. */

import { api, settle, API, passkeysSupported, registerPasskey } from '../api.js';
import {
  h, num, time, device, statusPill, pill, table, panel, tile, tabs, loading, errorBox, dialog, busy,
} from '../ui.js';

const state = { result: 'all' };

/** @param {HTMLElement} body @param {import('../index.js').Ctx} ctx */
export async function render(body, ctx) {
  if (!body.childElementCount) body.append(loading(6));
  const [sessions, logins, passkeys] = await Promise.all([
    settle(api(`${API}/sessions`)),
    settle(api(`${API}/logins?limit=200`)),
    settle(api(`${API}/passkeys`)),
  ]);

  const all = logins.ok ? logins.value.logins : [];
  const dayAgo = Date.now() / 1000 - 86_400;
  const failures24 = all.filter((l) => l.result !== 'success' && l.created_at >= dayAgo).length;
  const lockouts24 = all.filter((l) => l.result === 'locked' && l.created_at >= dayAgo).length;
  const ips = new Set(all.filter((l) => l.result !== 'success' && l.created_at >= dayAgo).map((l) => l.ip));
  ctx.setBadge('security', failures24, failures24 >= 8);

  const tiles = h('div.adm-tiles', null,
    tile({ label: 'Open sessions', value: sessions.ok ? num(sessions.value.sessions.length) : '—', hint: 'console sign-ins still valid', tone: 'jade' }),
    tile({ label: 'Failed · 24 h', value: num(failures24), hint: `${num(ips.size)} distinct addresses`, tone: failures24 ? 'warn' : undefined }),
    tile({ label: 'Locked · 24 h', value: num(lockouts24), hint: 'attempts refused while locked', tone: lockouts24 ? 'danger' : undefined }),
    tile({ label: 'Passkeys', value: passkeys.ok ? num(passkeys.value.passkeys.length) : '—', hint: passkeys.ok && !passkeys.value.passkeys.length ? 'safer than the shared secret' : 'registered authenticators' }),
  );

  const sessionsPanel = sessions.ok
    ? panel({
      title: 'Console sessions',
      sub: 'Each sign-in holds an HttpOnly cookie for 8 hours. Revoking one signs that browser out on its next request.',
      actions: h('button.btn.btn--ghost.btn--sm', {
        type: 'button',
        disabled: sessions.value.sessions.length < 2,
        onclick: async (e) => {
          const btn = e.currentTarget;
          const ok = await dialog({ title: 'Sign out every other session?', text: 'Every console session except this one ends now.', confirm: 'Sign out others', danger: true });
          if (!ok) return;
          await busy(btn, () => api(`${API}/sessions/others`, { method: 'DELETE' }), (r) => `${r.revoked} sessions signed out`);
          ctx.rerender();
        },
      }, 'Sign out others'),
      flush: true,
      body: table({
        rows: sessions.value.sessions,
        emptyText: 'No sessions',
        columns: [
          { label: 'Device', cell: (s) => h('div.adm-cell-main', null, h('b', null, device(s.ua), s.current ? ' ' : null, s.current ? pill('this browser', 'ok', true) : null), h('small', { title: s.ua || '' }, s.ip || 'unknown address')) },
          { label: 'Method', cell: (s) => pill(s.method === 'passkey' ? `passkey${s.passkey_label ? ` · ${s.passkey_label}` : ''}` : 'secret', s.method === 'passkey' ? 'ok' : 'gold', true) },
          { label: 'Signed in', cell: (s) => time(s.created_at) },
          { label: 'Last seen', cell: (s) => time(s.last_seen_at) },
          { label: 'Expires', cell: (s) => time(s.expires_at) },
          {
            label: '', className: 'actions', cell: (s) => h('button.btn.btn--danger-ghost.btn--xs', {
              type: 'button',
              onclick: async (e) => {
                const btn = e.currentTarget;
                if (s.current) {
                  const ok = await dialog({ title: 'End this session?', text: 'You will be signed out here.', confirm: 'Sign out', danger: true });
                  if (!ok) return;
                }
                const r = await busy(btn, () => api(`${API}/sessions/${encodeURIComponent(s.session_id)}`, { method: 'DELETE' }), 'Session ended');
                if (r?.signed_out) ctx.signedOut();
                else ctx.rerender();
              },
            }, s.current ? 'Sign out' : 'Revoke'),
          },
        ],
      }),
    })
    : panel({ title: 'Console sessions', body: errorBox(sessions.error, () => ctx.rerender()) });

  const filtered = state.result === 'all' ? all : all.filter((l) => (state.result === 'success' ? l.result === 'success' : l.result !== 'success'));
  const loginsPanel = logins.ok
    ? panel({
      title: 'Sign-in log',
      sub: 'Every attempt for 90 days. Addresses come from Cloudflare\'s edge, so they cannot be spoofed by the client.',
      actions: tabs([['all', 'All'], ['success', 'Succeeded'], ['failure', 'Failed']], state.result, (v) => { state.result = v; ctx.rerender(); }, 'Result'),
      flush: true,
      body: table({
        rows: filtered,
        emptyText: 'No attempts recorded',
        columns: [
          { label: 'Result', cell: (l) => statusPill(l.result) },
          { label: 'Method', cell: (l) => (l.method === 'passkey' ? 'Passkey' : 'Secret') },
          { label: 'Address', cell: (l) => h('div.adm-cell-main', null, h('b.adm-mono', null, l.ip || 'unknown'), h('small', null, l.country || '')) },
          { label: 'Device', cell: (l) => h('span', { title: l.ua || '' }, device(l.ua)) },
          { label: 'Reason', cell: (l) => h('span.adm-dim', null, l.reason ? l.reason.replace(/_/g, ' ') : '—') },
          { label: 'When', cell: (l) => time(l.created_at) },
        ],
      }),
    })
    : panel({ title: 'Sign-in log', body: errorBox(logins.error, () => ctx.rerender()) });

  const supported = passkeysSupported();
  const passkeysPanel = passkeys.ok
    ? panel({
      title: 'Passkeys',
      sub: 'Sign in with Touch ID, Windows Hello or a security key instead of the shared secret. Unlocking is required.',
      actions: h('button.btn.btn--jade.btn--sm', {
        type: 'button',
        disabled: !supported,
        title: supported ? undefined : 'This browser does not support passkeys',
        onclick: async (e) => {
          const btn = e.currentTarget;
          const values = await dialog({
            title: 'Add a passkey',
            text: 'Your browser will ask you to create a passkey for clex.in on this device or a security key.',
            confirm: 'Continue',
            fields: [{ name: 'label', label: 'Name it', placeholder: 'MacBook Touch ID', required: true }],
          });
          if (!values) return;
          await busy(btn, () => registerPasskey(values.label.trim().slice(0, 80)), 'Passkey added');
          ctx.rerender();
        },
      }, '+ Add passkey'),
      flush: true,
      body: table({
        rows: passkeys.value.passkeys,
        emptyText: 'No passkeys registered yet',
        columns: [
          { label: 'Name', cell: (p) => h('div.adm-cell-main', null, h('b', null, p.label || 'Passkey'), h('small', null, `${p.alg === -257 ? 'RS256' : 'ES256'}${p.transports?.length ? ` · ${p.transports.join(', ')}` : ''}`)) },
          { label: 'Added', cell: (p) => time(p.created_at) },
          { label: 'Last used', cell: (p) => (p.last_used_at ? time(p.last_used_at) : 'never') },
          { label: 'From', cell: (p) => h('span.adm-dim', null, p.last_used_ip || p.created_ip || '—') },
          {
            label: '', className: 'actions', cell: (p) => h('button.btn.btn--danger-ghost.btn--xs', {
              type: 'button',
              onclick: async (e) => {
                const btn = e.currentTarget;
                const ok = await dialog({ title: 'Remove this passkey?', text: `“${p.label || 'Passkey'}” can no longer open the console.`, confirm: 'Remove', danger: true });
                if (!ok) return;
                await busy(btn, () => api(`${API}/passkeys/${encodeURIComponent(p.id)}`, { method: 'DELETE' }), 'Passkey removed');
                ctx.rerender();
              },
            }, 'Remove'),
          },
        ],
      }),
    })
    : panel({ title: 'Passkeys', body: errorBox(passkeys.error, () => ctx.rerender()) });

  body.replaceChildren(tiles, sessionsPanel, h('div.adm-grid.adm-grid--wide', null, loginsPanel, passkeysPanel));
}
