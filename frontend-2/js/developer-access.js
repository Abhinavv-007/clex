import {
  getGoogleIdToken,
  onVaultAuthChanged,
  signInWithGoogle,
  signOutGoogle,
} from '@clex/frontend-core';

const API_BASE = 'https://api.clex.in';
const TOKEN_PLACEHOLDER = '<YOUR_API_KEY>';

/**
 * @typedef {{ displayName?: string | null, email?: string | null, photoURL?: string | null }} DeveloperUser
 *
 * @typedef {{
 *   id: string,
 *   label: string,
 *   plan: string,
 *   prefix: string,
 *   createdAt: number,
 *   lastUsedAt: number | null,
 *   revoked: boolean,
 *   revokedAt: number | null,
 *   limits: { ratePerMin: number, sizeBytes: number, label: string },
 *   usageToday: number,
 *   usageLast7d: number,
 * }} DeveloperKey
 */

/** @type {{ user: DeveloperUser | null, token: string, keys: DeveloperKey[], loadingKeys: boolean, status: string }} */
const state = {
  user: null,
  token: '',
  keys: [],
  loadingKeys: false,
  status: '',
};

export async function initDeveloperAccess() {
  const root = document.getElementById('developer-access');
  if (!root) return;

  const els = {
    root,
    signInButton: /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-google-signin')),
    signOutButton: /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-google-signout')),
    createButton: /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-create-token')),
    copyTokenButton: /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-copy-token')),
    copyTokenInline: /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-token-copy-inline')),
    refreshButton: /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-refresh-keys')),
    tokenOutput: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('dev-token-output')),
    tokenBlock: document.getElementById('dev-token-block'),
    statusPill: document.getElementById('dev-status-pill'),
    statusText: document.getElementById('dev-token-status'),
    userName: document.getElementById('dev-user-name'),
    userEmail: document.getElementById('dev-user-email'),
    userAvatar: /** @type {HTMLImageElement | null} */ (document.getElementById('dev-user-avatar')),
    keysCount: document.getElementById('dev-keys-count'),
    keysList: document.getElementById('dev-keys-list'),
  };

  /**
   * @param {string} state
   * @param {string} [text]
   */
  const setStatus = (state, text = '') => {
    if (els.statusPill) els.statusPill.dataset.state = state;
    if (els.statusPill) els.statusPill.textContent = pillLabel(state);
    if (els.statusText) els.statusText.textContent = text;
    if (text) state === 'error' ? console.warn('[clex] dev-access:', text) : null;
  };

  /** @param {boolean} busy */
  const setBusy = busy => {
    root.classList.toggle('dev-access--busy', busy);
    for (const button of [els.signInButton, els.signOutButton, els.createButton, els.copyTokenButton, els.copyTokenInline, els.refreshButton]) {
      if (button) button.disabled = busy ? true : button.dataset.alwaysOn === 'true' ? false : button.disabled;
    }
  };

  const render = () => {
    const isAuthed = Boolean(state.user);
    root.dataset.state = isAuthed ? 'signed-in' : 'signed-out';
    root.classList.toggle('dev-access--signed-in', isAuthed);
    root.classList.toggle('dev-access--has-token', Boolean(state.token));

    if (isAuthed && state.user) {
      if (els.userName) els.userName.textContent = state.user.displayName || state.user.email || 'Signed in';
      if (els.userEmail) els.userEmail.textContent = state.user.email || '';
      if (els.userAvatar) {
        if (state.user.photoURL) {
          els.userAvatar.src = state.user.photoURL;
          els.userAvatar.hidden = false;
        } else {
          els.userAvatar.removeAttribute('src');
          els.userAvatar.hidden = true;
        }
      }
    }

    if (els.tokenBlock) els.tokenBlock.hidden = !state.token;
    if (els.tokenOutput) els.tokenOutput.value = state.token || '';
    if (els.copyTokenButton) els.copyTokenButton.disabled = !state.token;

    renderKeys(els.keysList, els.keysCount, state.keys, state.loadingKeys, async (id) => {
      await onRevokeKey(id, setStatus, refreshKeys);
    });

    updateCommands(state.token || TOKEN_PLACEHOLDER);
  };

  const refreshKeys = async () => {
    if (!state.user) {
      state.keys = [];
      state.loadingKeys = false;
      render();
      return;
    }
    state.loadingKeys = true;
    render();
    try {
      const token = await getGoogleIdToken();
      if (!token) throw new Error('Not signed in.');
      state.keys = await fetchKeys(token);
    } catch (err) {
      console.error(err);
      setStatus('error', `Could not load keys: ${pretty(err)}`);
      state.keys = [];
    } finally {
      state.loadingKeys = false;
      render();
    }
  };

  els.signInButton?.addEventListener('click', async () => {
    setBusy(true);
    setStatus('loading', 'Opening Google sign-in…');
    try {
      const user = await signInWithGoogle();
      if (user) {
        state.user = user;
        setStatus('signed-in', 'Signed in. Create a key when you need one.');
      } else {
        setStatus('signed-out', 'Sign-in was cancelled.');
      }
    } catch (err) {
      console.error(err);
      setStatus('error', `Google sign-in failed: ${pretty(err)}`);
    } finally {
      setBusy(false);
      render();
      if (state.user) await refreshKeys();
    }
  });

  els.signOutButton?.addEventListener('click', async () => {
    setBusy(true);
    setStatus('loading', 'Signing out…');
    try {
      await signOutGoogle();
      state.user = null;
      state.token = '';
      state.keys = [];
      setStatus('signed-out', 'Signed out.');
    } catch (err) {
      console.error(err);
      setStatus('error', `Sign-out failed: ${pretty(err)}`);
    } finally {
      setBusy(false);
      render();
    }
  });

  els.createButton?.addEventListener('click', async () => {
    if (!state.user) {
      setStatus('error', 'Sign in first to mint a key.');
      return;
    }
    setBusy(true);
    setStatus('loading', 'Creating API key…');
    try {
      const token = await getGoogleIdToken(true);
      if (!token) {
        setStatus('error', 'Could not refresh your Google session. Sign in again.');
        return;
      }
      const minted = await createDashboardKey(token);
      state.token = minted.key;
      setStatus('signed-in', 'API key ready — copy it now. Plaintext won\'t be shown again.');
    } catch (err) {
      console.error(err);
      setStatus('error', pretty(err));
    } finally {
      setBusy(false);
      render();
      await refreshKeys();
    }
  });

  const copyTokenHandler = async () => {
    if (!state.token) return;
    try {
      await copyText(state.token);
      setStatus('signed-in', 'API key copied to clipboard.');
    } catch (err) {
      setStatus('error', `Copy failed: ${pretty(err)}`);
    }
  };
  els.copyTokenButton?.addEventListener('click', copyTokenHandler);
  els.copyTokenInline?.addEventListener('click', copyTokenHandler);

  els.refreshButton?.addEventListener('click', () => { refreshKeys(); });

  root.querySelectorAll('[data-copy-command]').forEach(button => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-command');
      const code = targetId ? document.getElementById(targetId) : null;
      if (!code) return;
      try {
        await copyText(code.textContent || '');
        setStatus(state.user ? 'signed-in' : 'signed-out', 'Command copied.');
      } catch (err) {
        setStatus('error', `Copy failed: ${pretty(err)}`);
      }
    });
  });

  setStatus('loading', 'Loading auth…');
  try {
    await onVaultAuthChanged(async user => {
      state.user = user;
      if (!user) {
        state.token = '';
        state.keys = [];
        setStatus('signed-out', 'Sign in to mint a Clex API key.');
      } else {
        setStatus('signed-in', state.token ? 'Signed in. Key ready.' : 'Signed in. Create a key when you need one.');
      }
      render();
      if (user) await refreshKeys();
    });
  } catch (err) {
    console.error(err);
    setStatus('error', `Auth state could not be loaded: ${pretty(err)}`);
  }

  render();
}

/** @param {string} state */
function pillLabel(state) {
  switch (state) {
    case 'signed-in': return 'Signed in';
    case 'signed-out': return 'Signed out';
    case 'loading': return 'Working…';
    case 'error': return 'Error';
    default: return 'Ready';
  }
}

/** @param {unknown} err */
function pretty(err) {
  if (!err) return 'unknown error';
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}

/**
 * @param {HTMLElement | null} list
 * @param {HTMLElement | null} countEl
 * @param {DeveloperKey[]} keys
 * @param {boolean} loading
 * @param {(id: string) => Promise<void>} onRevoke
 */
function renderKeys(list, countEl, keys, loading, onRevoke) {
  if (countEl) {
    const active = keys.filter(k => !k.revoked).length;
    countEl.textContent = loading ? '…' : `${active} active · ${keys.length} total`;
  }
  if (!list) return;
  if (loading) {
    list.innerHTML = '<p class="dev-keys__empty">Loading keys…</p>';
    return;
  }
  if (keys.length === 0) {
    list.innerHTML = '<p class="dev-keys__empty">No keys yet. Click <strong>Create API key</strong> above to mint your first one.</p>';
    return;
  }
  list.innerHTML = keys.map(key => keyCard(key)).join('');
  list.querySelectorAll('[data-revoke-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-revoke-id');
      if (!id) return;
      const target = /** @type {HTMLButtonElement} */ (btn);
      target.disabled = true;
      target.textContent = 'Revoking…';
      try {
        await onRevoke(id);
      } finally {
        target.disabled = false;
        target.textContent = 'Revoke';
      }
    });
  });
}

/** @param {DeveloperKey} key */
function keyCard(key) {
  const created = formatDate(key.createdAt);
  const lastUsed = key.lastUsedAt ? formatDate(key.lastUsedAt) : 'never';
  const status = key.revoked
    ? '<span class="dev-key__badge dev-key__badge--revoked">Revoked</span>'
    : '<span class="dev-key__badge dev-key__badge--active">Active</span>';
  const revokeBtn = key.revoked
    ? ''
    : `<button class="btn btn--ghost btn--small dev-key__revoke" data-revoke-id="${escapeAttr(key.id)}" type="button">Revoke</button>`;
  return `
    <article class="dev-key">
      <div class="dev-key__head">
        <div class="dev-key__title">
          <strong>${escapeHtml(key.label || 'Untitled key')}</strong>
          ${status}
        </div>
        <code class="dev-key__prefix" title="Key prefix">${escapeHtml(key.prefix || '')}…</code>
      </div>
      <dl class="dev-key__meta">
        <div><dt>Plan</dt><dd>${escapeHtml(key.plan || 'free')}</dd></div>
        <div><dt>Created</dt><dd>${escapeHtml(created)}</dd></div>
        <div><dt>Last used</dt><dd>${escapeHtml(lastUsed)}</dd></div>
        <div><dt>Today</dt><dd>${formatNumber(key.usageToday)}</dd></div>
        <div><dt>7-day</dt><dd>${formatNumber(key.usageLast7d)}</dd></div>
      </dl>
      <div class="dev-key__actions">${revokeBtn}</div>
    </article>
  `;
}

/**
 * @param {string} id
 * @param {(state: string, text?: string) => void} setStatus
 * @param {() => Promise<void>} refresh
 */
async function onRevokeKey(id, setStatus, refresh) {
  if (!confirm('Revoke this API key? Any clients still using it will start failing immediately.')) return;
  try {
    const token = await getGoogleIdToken();
    if (!token) throw new Error('Not signed in.');
    const res = await fetch(`${API_BASE}/api/keys/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || body.error || `Revoke failed (${res.status})`);
    setStatus('signed-in', 'Key revoked.');
    await refresh();
  } catch (err) {
    setStatus('error', `Could not revoke key: ${pretty(err)}`);
  }
}

/** @param {number} epochSeconds */
function formatDate(epochSeconds) {
  if (!epochSeconds) return '—';
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** @param {number} n */
function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return Number(n).toLocaleString();
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => /** @type {Record<string, string>} */ ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[m] || m);
}

/** @param {string} s */
function escapeAttr(s) { return escapeHtml(s); }

/** @param {string} token */
function updateCommands(token) {
  const exportCode = document.getElementById('dev-cmd-export');
  const healthCode = document.getElementById('dev-cmd-health');
  const authCode = document.getElementById('dev-cmd-auth');

  if (exportCode) {
    exportCode.textContent = `export CLEX_API_KEY='${token}'`;
  }
  if (healthCode) {
    healthCode.textContent = `curl ${API_BASE}/api/health`;
  }
  if (authCode) {
    authCode.textContent = `curl -X POST https://clex.in/vault/api/uploads \\
  -H "Authorization: Bearer ${token}" \\
  -H "X-Filename: report.pdf" \\
  --data-binary @report.pdf`;
  }
}

/** @param {string} text */
async function copyText(text) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

/** @param {string} token */
async function fetchKeys(token) {
  const res = await fetch(`${API_BASE}/api/keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || body.error || `Could not load keys (${res.status})`);
  }
  return Array.isArray(body.keys) ? /** @type {DeveloperKey[]} */ (body.keys) : [];
}

/** @param {string} token */
async function createDashboardKey(token) {
  const response = await fetch(`${API_BASE}/api/keys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      label: `Developers page · ${new Date().toISOString().slice(0, 10)}`,
      plan: 'free',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data.message || data.error || `API key request failed (${response.status})`;
    if (response.status === 401) {
      throw new Error('Your Google session has expired. Sign in again, then retry.');
    }
    throw new Error(reason);
  }
  return { key: typeof data.key === 'string' ? data.key : '', record: data.record ?? null };
}
