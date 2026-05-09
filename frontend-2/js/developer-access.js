import {
  getGoogleIdToken,
  onVaultAuthChanged,
  signInWithGoogle,
  signOutGoogle,
} from '@clex/frontend-core';

const API_BASE = 'https://api.clex.in';
const TOKEN_PLACEHOLDER = '<YOUR_API_KEY>';

/**
 * @typedef {{ displayName?: string | null, email?: string | null }} DeveloperUser
 */

/** @type {{ user: DeveloperUser | null, token: string }} */
const state = {
  user: null,
  token: '',
};

export async function initDeveloperAccess() {
  const root = document.getElementById('developer-access');
  if (!root) return;

  const signInButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-google-signin'));
  const signOutButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-google-signout'));
  const createButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-create-token'));
  const copyTokenButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('dev-copy-token'));
  const tokenOutput = /** @type {HTMLTextAreaElement | HTMLInputElement | null} */ (document.getElementById('dev-token-output'));
  const userLabel = document.getElementById('dev-user-label');
  const statusLabel = document.getElementById('dev-token-status');

  /** @param {boolean} busy @param {string} [label] */
  const setBusy = (busy, label = '') => {
    root.classList.toggle('dev-access--busy', busy);
    if (statusLabel) statusLabel.textContent = label;
    for (const button of [signInButton, signOutButton, createButton, copyTokenButton]) {
      if (button) button.disabled = busy;
    }
  };

  const render = () => {
    const isAuthed = Boolean(state.user);
    root.classList.toggle('dev-access--signed-in', isAuthed);
    root.classList.toggle('dev-access--has-token', Boolean(state.token));

    if (userLabel) {
      const user = state.user;
      userLabel.textContent = isAuthed
        ? `${user?.displayName || user?.email || 'Google account'} signed in`
        : 'Sign in to create an API key';
    }

    if (tokenOutput) {
      tokenOutput.value = state.token || '';
      tokenOutput.placeholder = isAuthed
        ? 'Click Create API key'
        : 'Sign in with Google first';
    }

    updateCommands(state.token || TOKEN_PLACEHOLDER);
  };

  signInButton?.addEventListener('click', async () => {
    setBusy(true, 'Opening Google sign-in...');
    try {
      const user = await signInWithGoogle();
      if (user) {
        state.user = user;
        if (statusLabel) statusLabel.textContent = 'Signed in. Create an API key when you need one.';
      } else {
        if (statusLabel) statusLabel.textContent = 'Sign-in was cancelled.';
      }
    } catch (err) {
      console.error(err);
      if (statusLabel) statusLabel.textContent = 'Google sign-in failed. Check Firebase auth settings.';
    } finally {
      setBusy(false, statusLabel?.textContent || '');
      render();
    }
  });

  signOutButton?.addEventListener('click', async () => {
    setBusy(true, 'Signing out...');
    try {
      await signOutGoogle();
      state.user = null;
      state.token = '';
      if (statusLabel) statusLabel.textContent = 'Signed out.';
    } catch (err) {
      console.error(err);
      if (statusLabel) statusLabel.textContent = 'Sign-out failed.';
    } finally {
      setBusy(false, statusLabel?.textContent || '');
      render();
    }
  });

  createButton?.addEventListener('click', async () => {
    setBusy(true, 'Creating API key...');
    try {
      const token = await getGoogleIdToken(true);
      if (!token) {
        if (statusLabel) statusLabel.textContent = 'Sign in first, then create an API key.';
        return;
      }
      state.token = await createDashboardKey(token);
      if (statusLabel) statusLabel.textContent = 'API key ready. Copy it now — it will not be shown again.';
    } catch (err) {
      console.error(err);
      if (statusLabel) statusLabel.textContent = 'Could not create an API key. Try signing in again.';
    } finally {
      setBusy(false, statusLabel?.textContent || '');
      render();
    }
  });

  copyTokenButton?.addEventListener('click', async () => {
    if (!state.token) return;
    await copyText(state.token);
    if (statusLabel) statusLabel.textContent = 'API key copied.';
  });

  root.querySelectorAll('[data-copy-command]').forEach(button => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-command');
      const code = targetId ? document.getElementById(targetId) : null;
      if (!code) return;
      await copyText(code.textContent || '');
      if (statusLabel) statusLabel.textContent = 'Command copied.';
    });
  });

  try {
    await onVaultAuthChanged(user => {
      state.user = user;
      if (!user) state.token = '';
      render();
    });
  } catch (err) {
    console.error(err);
    if (statusLabel) statusLabel.textContent = 'Auth state could not be loaded.';
  }

  render();
}

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
    throw new Error(data.message || data.error || `API key request failed (${response.status})`);
  }
  return data.key || '';
}
