/* ==========================================================================
   /share/<token> — the page a Clex API share link opens

   Every upload made through the API (the CLI, curl, a script) returns
   https://clex.in/share/<token>. That URL used to fall through to the landing
   page, so a recipient saw the homepage and no file. This page looks the token
   up and offers the download.
   ========================================================================== */

const API = '/vault/api/uploads';

export async function initShare() {
  const root = document.querySelector('[data-share]');
  if (!(root instanceof HTMLElement)) return;

  const token = readToken();
  const set = (/** @type {string} */ state) => { root.dataset.state = state; };
  const text = (/** @type {string} */ sel, /** @type {string} */ value) => {
    const el = root.querySelector(sel);
    if (el) el.textContent = value;
  };

  if (!token) {
    set('missing');
    return;
  }
  text('[data-share-token]', token);

  try {
    const res = await fetch(`${API}/${encodeURIComponent(token)}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));

    if (res.status === 404) return set('missing');
    if (res.status === 410) {
      text('[data-share-gone]', /revoked/i.test(body?.error || '') ? 'The sender revoked this link.' : 'This link has expired.');
      return set('gone');
    }
    if (!res.ok) throw new Error(body?.error || `The share service answered ${res.status}.`);

    const { filename, sizeBytes, mimeType, downloadUrl, expiresAt } = body;
    text('[data-share-name]', filename || 'file');
    text('[data-share-size]', formatBytes(sizeBytes));
    text('[data-share-type]', kindOf(filename, mimeType));
    text('[data-share-expiry]', expiresIn(expiresAt));
    const ext = (filename?.split('.').pop() || 'file').slice(0, 4).toUpperCase();
    text('[data-share-ext]', ext);

    const link = root.querySelector('[data-share-download]');
    if (link instanceof HTMLAnchorElement) {
      link.href = downloadUrl;
      link.setAttribute('download', filename || '');
      link.addEventListener('click', () => {
        link.classList.add('is-done');
        const label = link.querySelector('span');
        if (label) label.textContent = 'Downloading…';
        setTimeout(() => { if (label) label.textContent = 'Download again'; }, 2400);
      });
    }
    document.title = `${filename} — shared with Clex`;
    set('ready');
  } catch (err) {
    text('[data-share-error]', err instanceof Error ? err.message : 'Something went wrong.');
    set('error');
  }
}

function readToken() {
  const fromPath = location.pathname.match(/^\/share\/([A-Za-z0-9_-]{4,64})\/?$/)?.[1];
  const fromQuery = new URLSearchParams(location.search).get('t');
  const token = fromPath || fromQuery || '';
  return /^[A-Za-z0-9_-]{4,64}$/.test(token) ? token : '';
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** @param {string} name @param {string} mime */
function kindOf(name, mime) {
  if (/^image\//.test(mime)) return 'Image';
  if (/pdf/.test(mime) || /\.pdf$/i.test(name)) return 'PDF';
  if (/zip|compressed|tar|gzip/.test(mime)) return 'Archive';
  if (/^video\//.test(mime)) return 'Video';
  if (/^audio\//.test(mime)) return 'Audio';
  if (/word|document|text/.test(mime)) return 'Document';
  return 'File';
}

/** @param {number} at epoch ms */
function expiresIn(at) {
  const ms = at - Date.now();
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `in ${Math.round(h / 24)} days`;
  if (h >= 1) return `in ${h} h`;
  return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
}
