/* ==========================================================================
   Clex — the API, live on the Developers page

   · a status pill that asks /vault/api/health whether the API is up
   · "Try it here": uploads a file with the key minted above, through the
     same endpoint the curl example uses, and shows the share link it returns
     — with a revoke button, so a test upload does not have to linger
   ========================================================================== */

const VAULT_API = '/vault/api';
/** Where developer-access.js keeps the key for this tab. */
const SESSION_KEY = 'clex_dev_apikey_session';

export async function initApiStatus() {
  const root = document.querySelector('[data-api-status]');
  const text = root?.querySelector('[data-api-status-text]');
  if (!root || !text) return;
  try {
    const res = await fetch(`${VAULT_API}/health`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(String(res.status));
    root.classList.add('is-up');
    text.textContent = `API online · storage ${data.storageConfigured ? 'ready' : 'offline'}`;
  } catch {
    root.classList.add('is-down');
    text.textContent = 'API not reachable from here right now';
  }
}

export function initApiPlayground() {
  const root = document.querySelector('[data-api-try]');
  if (!(root instanceof HTMLElement)) return;
  const form = root.querySelector('[data-try-form]');
  const fileInput = root.querySelector('[data-try-file]');
  const name = root.querySelector('[data-try-name]');
  const expiry = root.querySelector('[data-try-expiry]');
  const send = root.querySelector('[data-try-send]');
  const note = root.querySelector('[data-try-note]');
  const result = root.querySelector('[data-try-result]');
  const link = root.querySelector('[data-try-link]');
  const open = root.querySelector('[data-try-open]');
  const copy = root.querySelector('[data-try-copy]');
  const revoke = root.querySelector('[data-try-revoke]');
  const json = root.querySelector('[data-try-json]');
  if (!(form instanceof HTMLFormElement) || !(fileInput instanceof HTMLInputElement)) return;

  /** @type {{ id: string, shareUrl: string } | null} */
  let last = null;
  const say = (msg, tone = '') => {
    if (!note) return;
    note.textContent = msg;
    note.setAttribute('data-tone', tone);
  };
  const key = () => {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
  };

  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (name) name.textContent = f ? `${f.name} · ${formatBytes(f.size)}` : 'Choose a file, up to 100 MB';
    root.classList.toggle('has-file', Boolean(f));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = key();
    const file = fileInput.files?.[0];
    if (!token) {
      say('Generate a key above first, then come back here.', 'warn');
      document.getElementById('api-access')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!file) {
      say('Pick a file to upload.', 'warn');
      return;
    }
    if (send instanceof HTMLButtonElement) send.disabled = true;
    root.classList.add('is-busy');
    say(`Uploading ${file.name}…`);
    try {
      const res = await fetch(`${VAULT_API}/uploads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Filename': encodeURIComponent(file.name),
          'X-Expires-In': expiry instanceof HTMLSelectElement ? expiry.value : '3600',
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      last = { id: data.id, shareUrl: data.shareUrl };
      if (link) link.textContent = data.shareUrl;
      if (open instanceof HTMLAnchorElement) open.href = data.shareUrl;
      if (json) {
        const { rate, ...rest } = data;
        json.textContent = `201 Created\n${JSON.stringify(rest, null, 2)}`;
      }
      if (result instanceof HTMLElement) result.hidden = false;
      say(`Uploaded. The link works until ${new Date(data.expiresAt).toLocaleString()}.`, 'ok');
    } catch (err) {
      say(err instanceof Error ? err.message : 'Upload failed.', 'bad');
    } finally {
      if (send instanceof HTMLButtonElement) send.disabled = false;
      root.classList.remove('is-busy');
    }
  });

  copy?.addEventListener('click', async () => {
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.shareUrl);
      say('Link copied.', 'ok');
    } catch {
      say('Copy was blocked by the browser.', 'warn');
    }
  });

  revoke?.addEventListener('click', async () => {
    if (!last) return;
    try {
      const res = await fetch(`${VAULT_API}/uploads/${encodeURIComponent(last.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key()}` },
      });
      if (!res.ok) throw new Error(`Revoke failed (${res.status})`);
      say('Revoked. The link now answers 410 Gone.', 'ok');
      if (result instanceof HTMLElement) result.classList.add('is-revoked');
    } catch (err) {
      say(err instanceof Error ? err.message : 'Revoke failed.', 'bad');
    }
  });
}

/** @param {number} n */
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
