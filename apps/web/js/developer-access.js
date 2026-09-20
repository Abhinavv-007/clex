/**
 * Developer API-key panel — no account required.
 *
 * ─── Why the previous version could never work ────────────────────────────
 *
 * It minted the key in the browser:
 *
 *     state.token = `clex_${fingerprint.slice(0, 12)}_${random}`
 *     localStorage.setItem(KEY_STORE, state.token)
 *
 * …and claimed "the server validates the fingerprint binding on use". It
 * cannot. The worker authenticates a key by looking up SHA-256(key) in the
 * `api_keys` table, and nothing ever inserted a row, so every key this page
 * produced was rejected 401 on first use.
 *
 * ─── What changed ─────────────────────────────────────────────────────────
 *
 * The fingerprint stays, and sign-in is still not required — but the SERVER
 * mints the key. POST /vault/api/keys/anonymous sends the fingerprint, the
 * worker combines it with the edge-observed IP to decide how many keys this
 * apparent device may hold, generates the secret, stores its hash, and
 * returns the plaintext once.
 *
 * The fingerprint is not a credential — it is computed here, so a caller can
 * send anything. It only meters abuse. The API key is the credential, which
 * is why revoking a key is done by presenting the key
 * (DELETE /vault/api/keys/self) rather than by claiming a fingerprint.
 */

const TOKEN_PLACEHOLDER = '<YOUR_API_KEY>';
const FP_KEY = 'clex_dev_fp_v2';
/** The key itself: kept for this tab only, never localStorage. */
const SESSION_KEY = 'clex_dev_apikey_session';
const VAULT_API = '/vault/api';

const state = {
  fingerprint: '',
  token: '',
  /** @type {{ratePerMinute:number,maxFileBytes:number,prefix:string}|null} */
  meta: null,
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
    label: document.getElementById('dev-create-token-label'),
    userLabel: document.getElementById('dev-user-label'),
    status: document.getElementById('dev-token-status'),
    identity: document.getElementById('dev-fp-display'),
  };

  state.fingerprint = await computeFingerprint();
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) state.token = saved;
  } catch { /* private mode */ }

  const setBusy = (busy, label) => {
    state.busy = busy;
    root.classList.toggle('dev-access--busy', busy);
    if (label && els.status) els.status.textContent = label;
    [els.create, els.copy, els.rotate].forEach((b) => { if (b) b.disabled = busy; });
  };

  const render = () => {
    root.classList.toggle('dev-access--has-token', Boolean(state.token));

    if (els.identity) els.identity.textContent = `${state.fingerprint.slice(0, 24)}…`;
    if (els.label) els.label.textContent = state.token ? 'Generate another' : 'Generate api key';

    if (els.userLabel) {
      els.userLabel.innerHTML = state.token
        ? 'Key ready · copy it now, it is shown <b>once</b>'
        : 'Click <b>Generate api key</b> to mint one — no signup';
    }

    if (els.output) {
      els.output.value = state.token || '';
      els.output.placeholder = 'Click Generate — the key is shown once and stored only as a hash';
    }

    if (els.status && state.meta) {
      els.status.textContent =
        `${formatLimit(state.meta.ratePerMinute)} · ${formatBytes(state.meta.maxFileBytes)} per file`;
    }

    updateCommands(state.token || TOKEN_PLACEHOLDER);
  };

  const generate = async () => {
    setBusy(true, 'Creating key…');
    try {
      const res = await fetch(`${VAULT_API}/keys/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: state.fingerprint,
          name: `developers-page · ${new Date().toISOString().slice(0, 10)}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Could not create the key (${res.status}).`);

      state.token = data.plaintext || '';
      state.meta = data.key || null;
      try { sessionStorage.setItem(SESSION_KEY, state.token); } catch { /* private mode */ }
      if (els.status && state.meta) {
        els.status.textContent =
          `Key ready · ${formatLimit(state.meta.ratePerMinute)} · ${formatBytes(state.meta.maxFileBytes)} per file`;
      }
    } catch (err) {
      if (els.status) els.status.textContent = err instanceof Error ? err.message : 'Could not create the key.';
    } finally {
      setBusy(false);
      render();
    }
  };

  const rotate = async () => {
    if (!state.token) return generate();
    if (!confirm('Revoke this key and mint a new one? The current key stops working immediately.')) return;
    setBusy(true, 'Revoking…');
    try {
      await fetch(`${VAULT_API}/keys/self`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${state.token}` },
      });
    } catch { /* revoke is best-effort; the new key is what matters */ }
    state.token = '';
    state.meta = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    setBusy(false);
    await generate();
  };

  els.create?.addEventListener('click', () => { if (!state.busy) void generate(); });
  els.rotate?.addEventListener('click', () => { if (!state.busy) void rotate(); });

  els.copy?.addEventListener('click', async () => {
    if (!state.token) {
      if (els.status) els.status.textContent = 'Generate a key first.';
      return;
    }
    await copyText(state.token);
    if (els.status) els.status.textContent = 'api key copied.';
    els.copy.classList.add('is-copied');
    setTimeout(() => els.copy.classList.remove('is-copied'), 1600);
  });

  root.querySelectorAll('[data-copy-command]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-command');
      const code = targetId ? document.getElementById(targetId) : null;
      if (!code) return;
      await copyText(code.textContent || '');
      if (els.status) els.status.textContent = 'Command copied.';
    });
  });

  render();
}

/**
 * A stable-ish device signature. Cached so the same browser keeps the same
 * mint allowance across visits.
 *
 * This is an abuse-metering signal, not an identity: it is computed here, so
 * the value is whatever the client chooses to send.
 */
async function computeFingerprint() {
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
  } catch { /* private mode */ }

  const parts = [
    navigator.userAgent || '',
    navigator.language || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(navigator.hardwareConcurrency || 0),
  ];

  // Canvas signature — the same shapes rasterise slightly differently per GPU.
  try {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 50;
    const g = c.getContext('2d');
    if (g) {
      g.textBaseline = 'top';
      g.font = '14px monospace';
      g.fillStyle = '#f60';
      g.fillRect(0, 0, 100, 30);
      g.fillStyle = '#069';
      g.fillText('clex.fingerprint', 2, 2);
      parts.push(c.toDataURL().slice(-64));
    }
  } catch { /* canvas blocked — the rest still varies */ }

  const hash = await sha256(parts.join('|'));
  try { localStorage.setItem(FP_KEY, hash); } catch { /* private mode */ }
  return hash;
}

/** @param {string} input */
async function sha256(input) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Only reachable on an insecure origin, where SubtleCrypto is unavailable.
  let h = 0;
  for (const c of input) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(16).padStart(16, '0').repeat(2);
}

/** @param {number} rpm */
function formatLimit(rpm) {
  return rpm < 0 ? 'unlimited' : `${rpm} req/min`;
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
    } catch { /* fall through */ }
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
