/**
 * Developer API-key panel.
 *
 * The previous implementation minted keys entirely in the browser:
 *
 *     const random = await randomToken(32)
 *     state.token = `clex_${fingerprint.slice(0, 12)}_${random}`
 *     localStorage.setItem(KEY_STORE, state.token)
 *
 * …and commented that "the server validates the fingerprint binding on use".
 * It does not, and it cannot: the worker authenticates a key by looking up
 * SHA-256(key) in the `api_keys` table, and nothing had ever inserted a row.
 * Every key this panel produced was therefore rejected with 401 on first use,
 * which is why "generating the API key to the working of the API key" was
 * broken — the page's own three-step diagram (sign in with Google → create
 * api key → send bearer key) described a flow the code never performed.
 *
 * Keys are now created by POST /vault/api/keys, which stores the hash against
 * the signed-in user and returns the plaintext exactly once. See
 * apps/vault-worker/src/apiKeys.ts.
 */

const TOKEN_PLACEHOLDER = '<YOUR_API_KEY>';
/** Where the one-time plaintext is held for this tab only. */
const SESSION_KEY = 'clex_dev_apikey_session';
const VAULT_API = '/vault/api';

const state = {
  /** @type {import('@clex/frontend-core').VaultUser | null} */
  user: null,
  /** @type {string} Plaintext key, only known immediately after creation. */
  token: '',
  /** @type {Array<{id: string, name: string, prefix: string, createdAt: number, lastUsedAt: number|null, totalUploads: number}>} */
  keys: [],
  busy: false,
};

export async function initDeveloperAccess() {
  const root = document.getElementById('developer-access');
  if (!root) return;

  const els = {
    create: /** @type {HTMLButtonElement|null} */ (document.getElementById('dev-create-token')),
    copy: /** @type {HTMLButtonElement|null} */ (document.getElementById('dev-copy-token')),
    rotate: /** @type {HTMLButtonElement|null} */ (document.getElementById('dev-rotate-token')),
    output: /** @type {HTMLTextAreaElement|null} */ (document.getElementById('dev-token-output')),
    userLabel: document.getElementById('dev-user-label'),
    status: document.getElementById('dev-token-status'),
    identity: document.getElementById('dev-fp-display'),
  };

  // Restore a key minted earlier in this tab so a reload doesn't lose the one
  // copy the server will ever hand out. sessionStorage, not localStorage: the
  // plaintext should not outlive the tab.
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) state.token = saved;
  } catch { /* private mode */ }

  const core = await import('@clex/frontend-core');

  const setBusy = (busy, label) => {
    state.busy = busy;
    root.classList.toggle('dev-access--busy', busy);
    if (label && els.status) els.status.textContent = label;
    [els.create, els.copy, els.rotate].forEach((b) => { if (b) b.disabled = busy; });
  };

  const render = () => {
    const signedIn = Boolean(state.user);
    root.classList.toggle('dev-access--has-token', Boolean(state.token));
    root.classList.toggle('dev-access--signed-in', signedIn);

    if (els.identity) {
      els.identity.textContent = signedIn ? (state.user.email || state.user.uid) : 'not signed in';
    }

    if (els.userLabel) {
      if (!signedIn) {
        els.userLabel.innerHTML = 'Sign in with Google to create an api key';
      } else if (state.token) {
        els.userLabel.innerHTML = `Key ready · copy it now, it is shown <b>once</b>`;
      } else if (state.keys.length) {
        const plural = state.keys.length === 1 ? 'key' : 'keys';
        els.userLabel.innerHTML =
          `${state.keys.length} active ${plural} · <b>Generate</b> to mint another`;
      } else {
        els.userLabel.innerHTML = 'Click <b>Generate api key</b> to mint one';
      }
    }

    // Write to the label span, not the button: the button also holds an icon.
    const createLabel = document.getElementById('dev-create-token-label');
    if (createLabel) {
      createLabel.textContent = signedIn ? 'Generate api key' : 'Sign in with Google';
    }

    if (els.output) {
      els.output.value = state.token || '';
      els.output.placeholder = signedIn
        ? 'Generate a key — the plaintext is shown once and never stored on the server'
        : 'Sign in to create a key';
    }

    updateCommands(state.token || TOKEN_PLACEHOLDER);
  };

  /** Authenticated request against the vault worker. */
  const api = async (method, path, body) => {
    const token = await core.getGoogleIdToken();
    if (!token) throw new Error('Sign-in expired. Sign in again.');
    const res = await fetch(`${VAULT_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error ?? ''; } catch { /* non-JSON */ }
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return res.status === 204 ? null : res.json();
  };

  const loadKeys = async () => {
    if (!state.user) return;
    try {
      const data = await api('GET', '/keys');
      state.keys = data?.keys ?? [];
    } catch (err) {
      console.error('[clex] could not list api keys', err);
      state.keys = [];
    }
    render();
  };

  const signIn = async () => {
    setBusy(true, 'Opening Google sign-in…');
    try {
      await core.signInWithGoogle();
      // onVaultAuthChanged fires and drives the rest.
    } catch (err) {
      if (els.status) els.status.textContent = describeError(err, 'Sign-in failed.');
    } finally {
      setBusy(false);
      render();
    }
  };

  const generate = async () => {
    if (!state.user) return signIn();
    setBusy(true, 'Creating key…');
    try {
      const data = await api('POST', '/keys', {
        name: `developers-page · ${new Date().toISOString().slice(0, 10)}`,
        email: state.user.email ?? undefined,
      });
      state.token = data?.plaintext ?? '';
      try { sessionStorage.setItem(SESSION_KEY, state.token); } catch { /* private mode */ }
      if (els.status) {
        const key = data?.key;
        els.status.textContent = key
          ? `Key ready · ${formatLimit(key.ratePerMinute, '/min')} · ${formatBytes(key.maxFileBytes)} per file`
          : 'Key ready.';
      }
      await loadKeys();
    } catch (err) {
      if (els.status) els.status.textContent = describeError(err, 'Could not create the key.');
    } finally {
      setBusy(false);
      render();
    }
  };

  const rotate = async () => {
    if (!state.user) return signIn();
    if (!confirm('Revoke every existing key and mint a new one? Old keys stop working immediately.')) return;
    setBusy(true, 'Revoking old keys…');
    try {
      await loadKeys();
      for (const key of state.keys) {
        await api('DELETE', `/keys/${encodeURIComponent(key.id)}`);
      }
      state.token = '';
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      await generate();
      return;
    } catch (err) {
      if (els.status) els.status.textContent = describeError(err, 'Could not rotate keys.');
    } finally {
      setBusy(false);
      render();
    }
  };

  els.create?.addEventListener('click', () => { if (!state.busy) void generate(); });
  els.rotate?.addEventListener('click', () => { if (!state.busy) void rotate(); });

  els.copy?.addEventListener('click', async () => {
    if (!state.token) {
      if (els.status) {
        els.status.textContent = state.user
          ? 'Generate a key first.'
          : 'Sign in, then generate a key.';
      }
      return;
    }
    await copyText(state.token);
    if (els.status) els.status.textContent = 'api key copied.';
    els.copy.classList.add('is-copied');
    setTimeout(() => els.copy.classList.remove('is-copied'), 1600);
  });

  // Generic [data-copy-command] support — kept for the sample command blocks.
  root.querySelectorAll('[data-copy-command]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-command');
      const code = targetId ? document.getElementById(targetId) : null;
      if (!code) return;
      await copyText(code.textContent || '');
      if (els.status) els.status.textContent = 'Command copied.';
    });
  });

  core.onVaultAuthChanged((user) => {
    state.user = user;
    if (!user) {
      state.keys = [];
      state.token = '';
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
      render();
      return;
    }
    void loadKeys();
  });

  render();
}

/** @param {unknown} err @param {string} fallback */
function describeError(err, fallback) {
  const msg = err instanceof Error ? err.message : '';
  if (!msg) return fallback;
  if (/popup|cancell?ed/i.test(msg)) return 'Sign-in cancelled.';
  return msg;
}

/** @param {number} rpm @param {string} suffix */
function formatLimit(rpm, suffix) {
  return rpm < 0 ? 'unlimited' : `${rpm}${suffix}`;
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (bytes < 0) return 'unlimited';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(0)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/** @param {string} token */
function updateCommands(token) {
  const targets = [
    ['dev-cmd-export', `export CLEX_API_KEY='${token}'`],
    ['dev-cmd-health', `curl https://api.clex.in/api/health`],
    [
      'dev-cmd-auth',
      `curl -X POST https://clex.in/vault/api/uploads \\\n` +
      `  -H "Authorization: Bearer ${token}" \\\n` +
      `  -H "X-Filename: report.pdf" \\\n` +
      `  --data-binary @report.pdf`,
    ],
  ];
  targets.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

/** @param {string} text */
async function copyText(text) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch { /* fall through to the legacy path */ }
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
