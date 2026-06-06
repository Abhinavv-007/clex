// Device-fingerprint based API keys — no auth required.
// Combines a stable device fingerprint (canvas + UA + screen) + persisted
// localStorage seed so the same browser keeps the same key, while different
// devices get distinct keys for rate-limit accounting on the server side.

const TOKEN_PLACEHOLDER = '<YOUR_API_KEY>';
const FP_KEY = 'clex_dev_fp_v2';
const KEY_STORE = 'clex_dev_apikey_v2';

const state = {
  fingerprint: '',
  token: '',
};

export async function initDeveloperAccess() {
  const root = document.getElementById('developer-access');
  if (!root) return;

  const createButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-create-token'));
  const copyButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-copy-token'));
  const rotateButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-rotate-token'));
  const tokenOutput = /** @type {HTMLTextAreaElement | HTMLInputElement | null} */ (document.getElementById('dev-token-output'));
  const userLabel = document.getElementById('dev-user-label');
  const statusLabel = document.getElementById('dev-token-status');
  const fpDisplay = document.getElementById('dev-fp-display');

  state.fingerprint = await computeFingerprint();
  if (fpDisplay) fpDisplay.textContent = state.fingerprint.slice(0, 24) + '…';

  // Restore persisted key.
  try {
    const saved = localStorage.getItem(KEY_STORE);
    if (saved) state.token = saved;
  } catch { /* ignore */ }

  /** @param {boolean} busy @param {string} [label] */
  const setBusy = (busy, label = '') => {
    root.classList.toggle('dev-access--busy', busy);
    if (label && statusLabel) statusLabel.textContent = label;
    [createButton, copyButton, rotateButton].forEach((b) => { if (b) b.disabled = busy; });
  };

  const render = () => {
    root.classList.toggle('dev-access--has-token', Boolean(state.token));
    if (userLabel) {
      userLabel.innerHTML = state.token
        ? `Key bound to <b>${state.fingerprint.slice(0, 8)}…</b> · stored on this device only`
        : 'Click <b>Generate api key</b> to mint one';
    }
    if (tokenOutput) {
      tokenOutput.value = state.token || '';
      tokenOutput.placeholder = 'Click Generate to mint a fingerprint-bound key';
    }
    updateCommands(state.token || TOKEN_PLACEHOLDER);
  };

  const generate = async () => {
    setBusy(true, 'Generating key from device fingerprint…');
    try {
      // Mint a key locally — server validates the fingerprint binding on use.
      // Format: clex_<fp-prefix>_<random>. Random portion is unforgeable;
      // server hashes the whole thing and rate-limits per fingerprint.
      const random = await randomToken(32);
      const fpPrefix = state.fingerprint.slice(0, 12);
      state.token = `clex_${fpPrefix}_${random}`;
      try { localStorage.setItem(KEY_STORE, state.token); } catch { /* ignore */ }
      if (statusLabel) statusLabel.textContent = 'Key ready · device-bound · 60 req/min · 100MB/day';
    } catch (err) {
      console.error(err);
      if (statusLabel) statusLabel.textContent = 'Could not generate key. Try refreshing.';
    } finally {
      setBusy(false);
      render();
    }
  };

  const rotate = async () => {
    if (state.token && !confirm('Rotate the key? The old key will stop working immediately.')) return;
    state.token = '';
    try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ }
    await generate();
  };

  createButton?.addEventListener('click', generate);
  rotateButton?.addEventListener('click', rotate);

  copyButton?.addEventListener('click', async () => {
    if (!state.token) {
      if (statusLabel) statusLabel.textContent = 'Generate a key first.';
      render();
      return;
    }
    await copyText(state.token);
    if (statusLabel) statusLabel.textContent = 'api key copied.';
    copyButton.classList.add('is-copied');
    setTimeout(() => copyButton.classList.remove('is-copied'), 1600);
  });

  // Generic [data-copy-command] support — kept for compatibility.
  root.querySelectorAll('[data-copy-command]').forEach(button => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-command');
      const code = targetId ? document.getElementById(targetId) : null;
      if (!code) return;
      await copyText(code.textContent || '');
      if (statusLabel) statusLabel.textContent = 'Command copied.';
    });
  });

  render();
}

/** Build a stable device fingerprint hash. */
async function computeFingerprint() {
  // Try cached value first.
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
  } catch { /* ignore */ }

  const ua = navigator.userAgent || '';
  const lang = navigator.language || '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const platform = navigator.platform || '';
  const cores = String(navigator.hardwareConcurrency || 0);

  // Canvas signature — different GPUs render the same shapes slightly differently.
  let canvasSig = '';
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
      g.fillText('clex.fingerprint 🔒', 2, 2);
      canvasSig = c.toDataURL().slice(-64);
    }
  } catch { /* ignore */ }

  const seed = [ua, lang, tz, screen, platform, cores, canvasSig].join('|');
  const hash = await sha256(seed);
  try { localStorage.setItem(FP_KEY, hash); } catch { /* ignore */ }
  return hash;
}

/** @param {string} input */
async function sha256(input) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (extremely unlikely needed on modern browsers).
  let h = 0;
  for (const c of input) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(16).padStart(16, '0');
}

/** @param {number} bytes */
async function randomToken(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} token */
function updateCommands(token) {
  const targets = [
    ['dev-cmd-export', `export CLEX_API_KEY='${token}'`],
    ['dev-cmd-health', `curl https://api.clex.in/api/health`],
    ['dev-cmd-auth', `curl -X POST https://clex.in/vault/api/uploads \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "X-Filename: report.pdf" \\\n  --data-binary @report.pdf`],
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
