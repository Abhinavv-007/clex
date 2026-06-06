// ═══════════════════════════════════════════════════
//  /admin frontend — control room
//  Login (password + passkey) → dashboard with tabs:
//    Overview · Users · Live feed · Audit · Passkeys
// ═══════════════════════════════════════════════════

const API_BASE = location.origin
const SESSION_KEY = 'clex_admin_session_id'
const SESSION_EXPIRES_KEY = 'clex_admin_session_expires_at'
const SESSION_METHOD_KEY = 'clex_admin_session_method'

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

// ── State ─────────────────────────────────────────
const state = {
  method: 'password',
  sessionId: localStorage.getItem(SESSION_KEY) || '',
  expiresAt: Number(localStorage.getItem(SESSION_EXPIRES_KEY) || 0),
  user: null,
  refreshing: false,
  cache: {
    summary: null,
    users: null,
    feeds: null,
    transfers: null,
    health: null,
    audit: null,
    passkeys: null,
  },
}

function storeSession(s) {
  if (!s || !s.session_id) return
  state.sessionId = s.session_id
  state.expiresAt = Number(s.expires_at) || 0
  localStorage.setItem(SESSION_KEY, s.session_id)
  localStorage.setItem(SESSION_EXPIRES_KEY, String(s.expires_at || 0))
  localStorage.setItem(SESSION_METHOD_KEY, s.method || 'password')
}

function clearSession() {
  state.sessionId = ''
  state.expiresAt = 0
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_EXPIRES_KEY)
  localStorage.removeItem(SESSION_METHOD_KEY)
}

function isSessionValid() {
  if (!state.sessionId) return false
  if (!state.expiresAt) return true
  return state.expiresAt * 1000 > Date.now()
}

// ── HTTP ───────────────────────────────────────────
async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {})
  headers.set('content-type', 'application/json')
  if (state.sessionId) headers.set('x-admin-session', state.sessionId)
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  let body = null
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

// ── Login ──────────────────────────────────────────
async function loginWithPassword(secret) {
  const { status, body } = await apiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ secret }),
  })
  if (status !== 200) {
    throw new Error(body?.error === 'invalid_secret' ? 'Invalid admin secret.' : (body?.error || 'Login failed'))
  }
  storeSession(body)
  return body
}

// ── WebAuthn helpers ───────────────────────────────
const b64uToBuf = (s) => {
  const pad = '='.repeat((4 - s.length % 4) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

const bufToB64u = (b) => {
  const bin = String.fromCharCode(...new Uint8Array(b))
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function loginWithPasskey() {
  const begin = await apiFetch('/api/admin/login/passkey/begin', { method: 'POST', body: '{}' })
  if (begin.status !== 200) throw new Error(begin.body?.error || 'Could not start passkey login.')
  const { handle, publicKey } = begin.body
  const challengeBuf = b64uToBuf(publicKey.challenge)
  const allow = (publicKey.allowCredentials || []).map(c => ({
    id: b64uToBuf(c.id),
    type: c.type || 'public-key',
    transports: c.transports,
  }))
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: challengeBuf,
      rpId: publicKey.rpId,
      timeout: publicKey.timeout || 60000,
      userVerification: publicKey.userVerification || 'preferred',
      allowCredentials: allow,
    },
  })
  if (!cred) throw new Error('No credential returned.')
  const finish = await apiFetch('/api/admin/login/passkey/finish', {
    method: 'POST',
    body: JSON.stringify({
      handle,
      credentialId: cred.id,
      response: {
        authenticatorData: bufToB64u(cred.response.authenticatorData),
        clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        signature: bufToB64u(cred.response.signature),
        userHandle: cred.response.userHandle ? bufToB64u(cred.response.userHandle) : null,
      },
    }),
  })
  if (finish.status !== 200) throw new Error(finish.body?.error || 'Passkey verification failed.')
  storeSession(finish.body)
  return finish.body
}

async function registerPasskey(label) {
  const begin = await apiFetch('/api/admin/passkeys/register/begin', { method: 'POST', body: '{}' })
  if (begin.status !== 200) throw new Error(begin.body?.error || 'Could not start registration.')
  const { handle, publicKey } = begin.body
  const opts = {
    challenge: b64uToBuf(publicKey.challenge),
    rp: publicKey.rp,
    user: {
      id: b64uToBuf(publicKey.user.id),
      name: publicKey.user.name,
      displayName: publicKey.user.displayName,
    },
    pubKeyCredParams: publicKey.pubKeyCredParams,
    timeout: publicKey.timeout || 60000,
    authenticatorSelection: publicKey.authenticatorSelection,
    attestation: publicKey.attestation || 'none',
    excludeCredentials: (publicKey.excludeCredentials || []).map(c => ({
      id: b64uToBuf(c.id),
      type: c.type || 'public-key',
      transports: c.transports,
    })),
  }
  const cred = await navigator.credentials.create({ publicKey: opts })
  if (!cred) throw new Error('Registration cancelled.')
  const transports = cred.response.getTransports?.() || []
  const finish = await apiFetch('/api/admin/passkeys/register/finish', {
    method: 'POST',
    body: JSON.stringify({
      handle,
      label: label || 'Device passkey',
      response: {
        attestationObject: bufToB64u(cred.response.attestationObject),
        clientDataJSON: bufToB64u(cred.response.clientDataJSON),
        transports,
      },
    }),
  })
  if (finish.status !== 200) throw new Error(finish.body?.error || 'Registration failed.')
  return finish.body
}

// ── View switching ─────────────────────────────────
function showLogin() {
  $('#admin-login').hidden = false
  $('#admin-dash').hidden = true
}

async function showDash() {
  $('#admin-login').hidden = true
  $('#admin-dash').hidden = false
  // Auth-check / load /me
  const me = await apiFetch('/api/admin/me')
  if (me.status !== 200) {
    clearSession()
    showLogin()
    return
  }
  state.user = me.body?.session
  paintSessionMeta()
  await loadOverview()
}

function paintSessionMeta() {
  if (!state.user) return
  const exp = state.user.expires_at ? new Date(state.user.expires_at * 1000) : null
  const expStr = exp ? exp.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'
  $('#admin-session-meta').textContent =
    `${(state.user.method || 'password').toUpperCase()} · expires ${expStr}`
}

// ── Tab switching ──────────────────────────────────
function activateTab(name) {
  $$('.nav-item').forEach(n => n.classList.toggle('is-active', n.dataset.tab === name))
  $$('.tab-panel').forEach(p => p.classList.toggle('is-active', p.dataset.tab === name))
  if (name === 'overview') loadOverview()
  if (name === 'users') loadUsers()
  if (name === 'feed') loadFeed()
  if (name === 'audit') loadAudit()
  if (name === 'passkeys') loadPasskeys()
}

// ── Helpers ────────────────────────────────────────
const fmtNum = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString()
}

const fmtTime = (epochSec) => {
  if (!epochSec) return '—'
  return new Date(epochSec * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
))

const shortToken = (s, head = 6, tail = 4) => {
  if (!s) return '—'
  const str = String(s)
  if (str.length <= head + tail + 1) return str
  return `${str.slice(0, head)}…${str.slice(-tail)}`
}

// ── Overview ───────────────────────────────────────
async function loadOverview() {
  const [summaryR, transfersR, healthR] = await Promise.all([
    apiFetch('/api/admin/summary'),
    apiFetch('/api/admin/transfers?limit=20'),
    apiFetch('/api/admin/health'),
  ])
  state.cache.summary = summaryR.body
  state.cache.transfers = transfersR.body
  state.cache.health = healthR.body

  paintTiles()
  paintTransfers()
  paintHealth()
}

function paintTiles() {
  const sum = state.cache.summary || {}
  const tx = (sum.metrics && sum.metrics.transfers) || {}
  const tiles = [
    { label: 'Total requests', value: fmtNum(sum.metrics?.total_requests), hint: 'all-time worker hits', tone: 'gold' },
    { label: 'Transfers · created', value: fmtNum(tx.created), hint: 'KV transfer sessions', tone: 'purple' },
    { label: 'Completed', value: fmtNum(tx.completed), hint: 'reached terminal success', tone: 'mint' },
    { label: 'Cancelled', value: fmtNum(tx.cancelled), hint: 'aborted before delivery', tone: 'peach' },
    { label: 'Routes hit', value: fmtNum(state.cache.health?.metrics?.per_route_count), hint: 'distinct API paths', tone: 'cyan' },
    { label: 'Service', value: sum.service || 'clex-api', hint: sum.process?.runtime || 'cloudflare-workers', tone: 'gold' },
  ]
  $('#overview-tiles').innerHTML = tiles.map(t => `
    <article class="tile tile--${t.tone}">
      <span class="tile__label">${escapeHtml(t.label)}</span>
      <span class="tile__value">${escapeHtml(t.value)}</span>
      <span class="tile__hint">${escapeHtml(t.hint)}</span>
    </article>
  `).join('')
}

function paintTransfers() {
  const list = (state.cache.transfers && state.cache.transfers.transfers) || []
  if (!list.length) { $('#overview-transfers').innerHTML = '<div class="empty">no transfers</div>'; return }
  $('#overview-transfers').innerHTML = list.map(t => {
    const sizeKb = Math.round((t.file_size_bytes || 0) / 1024)
    const tone = t.status === 'completed' ? 'ok' : (t.status === 'cancelled' || t.status === 'failed') ? 'err' : 'mute'
    return `
      <div class="row">
        <div class="row__primary">
          ${escapeHtml(t.file_name || '(unnamed)')}
          <div class="row__meta">${escapeHtml(t.code || '—')} · ${escapeHtml(t.route || '—')} · ${sizeKb} KB · ${fmtTime(t.created_at)}</div>
        </div>
        <span class="row__pill row__pill--${tone}">${escapeHtml(t.status || '—')}</span>
      </div>
    `
  }).join('')
}

function paintHealth() {
  const h = state.cache.health || {}
  const c = state.cache.summary?.config || {}
  const rows = [
    ['Version', h.version || '—'],
    ['Booted', fmtTime(h.booted_at)],
    ['Uptime', h.uptime_ms ? `${Math.round(h.uptime_ms / 1000 / 60)} min` : '—'],
    ['KV bindings', h.bindings?.kv_drive_session_store ? 'connected' : 'missing'],
    ['Google OAuth', c.google_oauth_client_configured ? 'configured' : 'missing'],
    ['Admin secret', c.admin_secret_set ? 'set' : 'unset'],
    ['Allowed origin', c.allowed_origin || '—'],
  ]
  $('#overview-health').innerHTML = rows.map(([k, v]) => `
    <div class="row">
      <div class="row__primary"><strong>${escapeHtml(k)}</strong></div>
      <div class="row__meta">${escapeHtml(String(v))}</div>
    </div>
  `).join('')
}

// ── Users ──────────────────────────────────────────
async function loadUsers() {
  const r = await apiFetch('/api/admin/users?limit=200')
  state.cache.users = r.body
  paintUsers()
}

function paintUsers() {
  const all = (state.cache.users && state.cache.users.users) || []
  const term = ($('#users-search')?.value || '').trim().toLowerCase()
  const list = term
    ? all.filter(u => (u.email || '').toLowerCase().includes(term) || (u.firebase_uid || '').toLowerCase().includes(term) || (u.id || '').toLowerCase().includes(term))
    : all
  if (!list.length) { $('#users-table').innerHTML = '<div class="empty">no users</div>'; return }
  $('#users-table').innerHTML = list.map(u => `
    <div class="user-row">
      <div>
        <div class="user-row__email">${escapeHtml(u.email || u.display_name || '(unknown)')}</div>
        <div class="user-row__sub">
          ${u.firebase_uid ? `<span class="code-chip"><strong>UID</strong>${escapeHtml(shortToken(u.firebase_uid, 8, 6))}</span>` : ''}
          ${u.id && u.id !== u.firebase_uid ? `<span class="code-chip"><strong>ID</strong>${escapeHtml(shortToken(u.id, 6, 4))}</span>` : ''}
        </div>
      </div>
      <div class="user-row__time">created · ${fmtTime(u.created_at)}</div>
      <div class="user-row__time">last seen · ${fmtTime(u.last_seen_at)}</div>
    </div>
  `).join('')
}

// ── Live feed ──────────────────────────────────────
async function loadFeed() {
  const r = await apiFetch('/api/admin/feeds?limit=50')
  state.cache.feeds = r.body
  paintFeed()
}

function paintFeed() {
  const f = state.cache.feeds || {}
  const keys = f.key_creations || []
  const calls = f.api_calls || []
  const ips = f.ip_log || []
  $('#feed-keys').innerHTML = keys.length
    ? keys.map(k => `
      <div class="row">
        <div class="row__primary">
          ${escapeHtml(k.label || k.key_id || '(unnamed key)')}
          <div class="row__meta">${escapeHtml(k.user_email || k.firebase_uid || '—')} · ${fmtTime(k.created_at)}</div>
        </div>
      </div>
    `).join('')
    : '<div class="empty">no key creations</div>'
  $('#feed-api').innerHTML = calls.length
    ? calls.map(c => `
      <div class="row">
        <div class="row__primary">
          ${escapeHtml(c.route || c.path || '(unknown route)')} · <span class="row__meta">${escapeHtml(String(c.status || ''))}</span>
          <div class="row__meta">${escapeHtml(c.user_email || c.firebase_uid || '—')} · ${fmtTime(c.created_at)}</div>
        </div>
      </div>
    `).join('')
    : '<div class="empty">no recent API calls tracked</div>'
  $('#feed-ip').innerHTML = ips.length
    ? ips.map(ip => `
      <div class="row">
        <div class="row__primary">
          ${escapeHtml(ip.user_email || ip.firebase_uid || '—')}
          <div class="row__meta">${escapeHtml(ip.ip || '—')} · ${fmtTime(ip.seen_at || ip.created_at)} · ${escapeHtml(ip.user_agent || '')}</div>
        </div>
      </div>
    `).join('')
    : '<div class="empty">no IP history</div>'
}

// ── Audit ──────────────────────────────────────────
async function loadAudit() {
  const r = await apiFetch('/api/admin/audit')
  state.cache.audit = r.body
  paintAudit()
}

function paintAudit() {
  const a = state.cache.audit || {}
  const events = a.events || []
  const loginEvents = events.filter(e => (e.type || '').startsWith('admin.'))
  const sysEvents = events.filter(e => !(e.type || '').startsWith('admin.'))
  const renderEvent = (e) => `
    <div class="row">
      <div class="row__primary">
        <strong>${escapeHtml(e.type || '—')}</strong>
        <div class="row__meta">${fmtTime(e.ts)} · ${escapeHtml(JSON.stringify(e.details || {}))}</div>
      </div>
    </div>
  `
  $('#audit-list').innerHTML = loginEvents.length
    ? loginEvents.map(renderEvent).join('')
    : '<div class="empty">no login events</div>'
  $('#audit-system').innerHTML = sysEvents.length
    ? sysEvents.map(renderEvent).join('')
    : '<div class="empty">no worker events</div>'
}

// ── Passkeys ───────────────────────────────────────
async function loadPasskeys() {
  const r = await apiFetch('/api/admin/passkeys')
  state.cache.passkeys = r.body
  paintPasskeys()
}

function paintPasskeys() {
  const p = state.cache.passkeys || {}
  const list = p.passkeys || []
  if (!list.length) { $('#passkeys-list').innerHTML = '<div class="empty">no passkeys registered</div>'; return }
  $('#passkeys-list').innerHTML = list.map(k => `
    <div class="passkey-row">
      <div>
        <div class="passkey-row__name">${escapeHtml(k.label || 'Passkey')}</div>
        <div class="passkey-row__sub">
          added ${fmtTime(k.created_at)}
          ${k.last_used_at ? ` · last used ${fmtTime(k.last_used_at)}` : ''}
          ${k.transports && k.transports.length ? ` · ${escapeHtml((k.transports || []).join(','))}` : ''}
        </div>
      </div>
      <button class="btn-ghost" data-revoke="${escapeHtml(k.id)}">Remove</button>
    </div>
  `).join('')
}

async function revokePasskey(id) {
  const r = await apiFetch(`/api/admin/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (r.status !== 200) {
    showPasskeyMsg(r.body?.error || 'Could not revoke passkey.')
    return
  }
  await loadPasskeys()
  showPasskeyMsg('Passkey removed.')
}

function showPasskeyMsg(text) {
  const el = $('#passkey-msg')
  if (!el) return
  el.textContent = text
  el.hidden = !text
}

// ── Wire up DOM ────────────────────────────────────
function wireLogin() {
  // Method toggle
  $$('.seg__opt').forEach(b => {
    b.addEventListener('click', () => {
      $$('.seg__opt').forEach(x => x.classList.toggle('is-active', x === b))
      state.method = b.dataset.method
      $$('[data-method]').forEach(el => {
        if (el.classList.contains('seg__opt')) return
        el.hidden = el.dataset.method !== state.method
      })
      $('#admin-error').hidden = true
    })
  })

  $('#admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = $('#admin-continue')
    btn.disabled = true
    $('#admin-error').hidden = true
    try {
      if (state.method === 'password') {
        const secret = $('#admin-secret').value
        if (!secret) throw new Error('Enter the admin secret.')
        await loginWithPassword(secret)
      } else {
        if (!('credentials' in navigator)) throw new Error('Passkeys not supported in this browser.')
        await loginWithPasskey()
      }
      $('#admin-secret').value = ''
      await showDash()
    } catch (err) {
      const el = $('#admin-error')
      el.textContent = err && err.message ? err.message : 'Login failed.'
      el.hidden = false
    } finally {
      btn.disabled = false
    }
  })
}

function wireDash() {
  // Tabs
  $('#admin-nav').addEventListener('click', (e) => {
    const item = e.target.closest('.nav-item')
    if (!item) return
    activateTab(item.dataset.tab)
  })
  // Logout
  $('#admin-logout').addEventListener('click', async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' })
    clearSession()
    showLogin()
  })
  // Refresh
  $('#admin-refresh').addEventListener('click', () => loadOverview())
  // Users search + refresh
  $('#users-search').addEventListener('input', () => paintUsers())
  $('#users-refresh').addEventListener('click', () => loadUsers())
  // Passkey add
  $('#passkey-add').addEventListener('click', async () => {
    const label = (window.prompt('Passkey label (e.g. iPhone, MacBook Touch ID):') || '').trim()
    if (!label) return
    showPasskeyMsg('Waiting for authenticator…')
    try {
      await registerPasskey(label)
      await loadPasskeys()
      showPasskeyMsg('Passkey registered.')
    } catch (err) {
      showPasskeyMsg(err && err.message ? err.message : 'Registration failed.')
    }
  })
  // Passkey revoke (delegated)
  $('#passkeys-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-revoke]')
    if (!btn) return
    if (!window.confirm('Revoke this passkey? You\'ll need to register it again to use it.')) return
    await revokePasskey(btn.dataset.revoke)
  })
}

// ── Boot ───────────────────────────────────────────
async function boot() {
  wireLogin()
  wireDash()
  if (isSessionValid()) {
    try { await showDash() } catch { showLogin() }
  } else {
    showLogin()
  }
}

document.addEventListener('DOMContentLoaded', () => { boot() })
