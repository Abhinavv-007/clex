import {
  getGoogleIdToken,
  onVaultAuthChanged,
  signInWithGoogle,
  signOutGoogle,
} from '@clex/frontend-core';

const API_BASE = 'https://api.clex.in';
const TOKEN_PLACEHOLDER = '<YOUR_TOKEN>';

const state = {
  user: null,
  token: '',
};

export async function initDeveloperAccess() {
  const root = document.getElementById('developer-access');
  if (!root) return;

  const signInButton = document.getElementById('dev-google-signin');
  const signOutButton = document.getElementById('dev-google-signout');
  const createButton = document.getElementById('dev-create-token');
  const copyTokenButton = document.getElementById('dev-copy-token');
  const tokenOutput = document.getElementById('dev-token-output');
  const userLabel = document.getElementById('dev-user-label');
  const statusLabel = document.getElementById('dev-token-status');

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
      userLabel.textContent = isAuthed
        ? `${state.user.displayName || state.user.email || 'Google account'} signed in`
        : 'Sign in to create an API token';
    }

    if (tokenOutput) {
      tokenOutput.value = state.token || '';
      tokenOutput.placeholder = isAuthed
        ? 'Click Create API token'
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
        statusLabel.textContent = 'Signed in. Create a token when you need one.';
      } else {
        statusLabel.textContent = 'Sign-in was cancelled.';
      }
    } catch (err) {
      console.error(err);
      statusLabel.textContent = 'Google sign-in failed. Check Firebase auth settings.';
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
      statusLabel.textContent = 'Signed out.';
    } catch (err) {
      console.error(err);
      statusLabel.textContent = 'Sign-out failed.';
    } finally {
      setBusy(false, statusLabel?.textContent || '');
      render();
    }
  });

  createButton?.addEventListener('click', async () => {
    setBusy(true, 'Creating token...');
    try {
      const token = await getGoogleIdToken(true);
      if (!token) {
        statusLabel.textContent = 'Sign in first, then create a token.';
        return;
      }
      state.token = token;
      statusLabel.textContent = 'Token ready. Use it as a Bearer token.';
    } catch (err) {
      console.error(err);
      statusLabel.textContent = 'Could not create token. Try signing in again.';
    } finally {
      setBusy(false, statusLabel?.textContent || '');
      render();
    }
  });

  copyTokenButton?.addEventListener('click', async () => {
    if (!state.token) return;
    await copyText(state.token);
    statusLabel.textContent = 'Token copied.';
  });

  root.querySelectorAll('[data-copy-command]').forEach(button => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-copy-command');
      const code = targetId ? document.getElementById(targetId) : null;
      if (!code) return;
      await copyText(code.textContent || '');
      statusLabel.textContent = 'Command copied.';
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
    statusLabel.textContent = 'Auth state could not be loaded.';
  }

  render();
}

function updateCommands(token) {
  const exportCode = document.getElementById('dev-cmd-export');
  const healthCode = document.getElementById('dev-cmd-health');
  const authCode = document.getElementById('dev-cmd-auth');

  if (exportCode) {
    exportCode.textContent = `export CLEX_TOKEN='${token}'`;
  }
  if (healthCode) {
    healthCode.textContent = `curl ${API_BASE}/api/health`;
  }
  if (authCode) {
    authCode.textContent = `curl ${API_BASE}/api/me \\
  -H "Authorization: Bearer ${token}"`;
  }
}

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
