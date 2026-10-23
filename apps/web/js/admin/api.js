/* ==========================================================================
   /admin — talking to the workers

   Three workers answer the console, all on this origin:
     /api/admin/*        sign-in, sessions, passkeys, transfer sessions, metrics
     /vault/api/admin/*  users, keys, uploads, Vault, maintenance
     /chain/admin/*      the public transfer ledger

   The session is an HttpOnly cookie the page cannot read; every request also
   carries `X-Clex-Admin: 1`, which the workers require as a CSRF guard.
   ========================================================================== */

export class ApiError extends Error {
  /** @param {string} message @param {number} status @param {unknown} body */
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const MESSAGES = {
  invalid_secret: 'That admin secret is not right.',
  too_many_attempts: 'Too many failed attempts from this network. Try again later.',
  admin_secret_not_configured: 'No admin secret is configured on the API worker.',
  admin_session_required: 'Your session has ended. Sign in again.',
  admin_session_expired: 'Your session has expired. Sign in again.',
  csrf_check_failed: 'The request was refused by the CSRF check.',
  no_passkeys_registered: 'No passkey is registered yet. Sign in with the secret and add one under Security.',
  passkey_verification_failed: 'The passkey could not be verified.',
  unknown_credential: 'That passkey is not registered to this console.',
  challenge_not_found: 'The sign-in request expired. Try again.',
  confirm_must_equal_uid: 'The confirmation did not match.',
};

/** @param {unknown} body @param {number} status */
function messageFor(body, status) {
  const code = body && typeof body === 'object' && 'error' in body ? String(body.error) : '';
  if (code && MESSAGES[code]) {
    if (code === 'too_many_attempts' && body.retry_after) {
      return `Too many failed attempts. Try again in ${Math.ceil(Number(body.retry_after) / 60)} min.`;
    }
    return MESSAGES[code];
  }
  if (code) return code.replace(/_/g, ' ');
  if (status === 404) return 'Not found — the worker may not be deployed with this route yet.';
  if (status >= 500) return `The service answered ${status}.`;
  return `Request failed (${status}).`;
}

/** Fired when any call comes back 401, so the shell can show the sign-in. */
export const SIGNED_OUT = 'adm:signed-out';

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal, quiet401?: boolean }} [opts]
 */
export async function api(path, opts = {}) {
  const headers = { 'X-Clex-Admin': '1', Accept: 'application/json' };
  /** @type {RequestInit} */
  const init = { method: opts.method || 'GET', headers, credentials: 'same-origin', cache: 'no-store', signal: opts.signal };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the service.', 0, null);
  }

  let body = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 120) }; }
  }

  if (!res.ok) {
    if (res.status === 401 && !opts.quiet401) window.dispatchEvent(new CustomEvent(SIGNED_OUT));
    throw new ApiError(messageFor(body, res.status), res.status, body);
  }
  return body;
}

/** Resolves to the value, or to `{ error }` — for loading many panels at once. */
export async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

export const API = '/api/admin';
export const VAULT = '/vault/api/admin';
export const CHAIN = '/chain/admin';

/** Public liveness endpoints, probed for the status dots and the System view. */
export const SERVICES = [
  { id: 'api', name: 'API', url: '/api/health', host: 'clex.in/api' },
  { id: 'vault', name: 'Vault', url: '/vault/api/health', host: 'clex.in/vault/api' },
  { id: 'chain', name: 'Chain', url: '/chain/health', host: 'clex.in/chain' },
  { id: 'signal', name: 'Signaling', url: 'https://signal.clex.in/health', host: 'signal.clex.in' },
];

/** @returns {Promise<{ id: string, ok: boolean, ms: number, status: number, body: any }>} */
export async function probe(service) {
  const t0 = performance.now();
  try {
    const res = await fetch(service.url, { cache: 'no-store', credentials: 'omit' });
    const ms = Math.round(performance.now() - t0);
    let body = null;
    try { body = await res.json(); } catch { /* not json */ }
    return { id: service.id, ok: res.ok && body?.ok !== false, ms, status: res.status, body };
  } catch {
    return { id: service.id, ok: false, ms: Math.round(performance.now() - t0), status: 0, body: null };
  }
}

// ── WebAuthn ───────────────────────────────────────────────────────────────

/** @param {string} s */
function b64uToBuf(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** @param {ArrayBuffer} buf */
function bufToB64u(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function passkeysSupported() {
  return typeof window.PublicKeyCredential === 'function' && !!navigator.credentials?.get;
}

export async function signInWithPasskey() {
  const begin = await api(`${API}/login/passkey/begin`, { method: 'POST', body: {}, quiet401: true });
  const { handle, publicKey } = begin;
  const cred = /** @type {PublicKeyCredential | null} */ (await navigator.credentials.get({
    publicKey: {
      challenge: b64uToBuf(publicKey.challenge),
      rpId: publicKey.rpId,
      timeout: publicKey.timeout || 60_000,
      userVerification: publicKey.userVerification || 'required',
      allowCredentials: (publicKey.allowCredentials || []).map((c) => ({
        id: b64uToBuf(c.id), type: 'public-key', transports: c.transports,
      })),
    },
  }));
  if (!cred) throw new ApiError('No passkey was chosen.', 0, null);
  const response = /** @type {AuthenticatorAssertionResponse} */ (cred.response);
  return api(`${API}/login/passkey/finish`, {
    method: 'POST',
    quiet401: true,
    body: {
      handle,
      credentialId: cred.id,
      response: {
        authenticatorData: bufToB64u(response.authenticatorData),
        clientDataJSON: bufToB64u(response.clientDataJSON),
        signature: bufToB64u(response.signature),
      },
    },
  });
}

/** @param {string} label */
export async function registerPasskey(label) {
  const { handle, publicKey } = await api(`${API}/passkeys/register/begin`, { method: 'POST', body: {} });
  const cred = /** @type {PublicKeyCredential | null} */ (await navigator.credentials.create({
    publicKey: {
      challenge: b64uToBuf(publicKey.challenge),
      rp: publicKey.rp,
      user: { id: b64uToBuf(publicKey.user.id), name: publicKey.user.name, displayName: publicKey.user.displayName },
      pubKeyCredParams: publicKey.pubKeyCredParams,
      timeout: publicKey.timeout || 60_000,
      authenticatorSelection: publicKey.authenticatorSelection,
      attestation: 'none',
      excludeCredentials: (publicKey.excludeCredentials || []).map((c) => ({
        id: b64uToBuf(c.id), type: 'public-key', transports: c.transports,
      })),
    },
  }));
  if (!cred) throw new ApiError('Registration was cancelled.', 0, null);
  const response = /** @type {AuthenticatorAttestationResponse} */ (cred.response);
  return api(`${API}/passkeys/register/finish`, {
    method: 'POST',
    body: {
      handle,
      label,
      response: {
        attestationObject: bufToB64u(response.attestationObject),
        clientDataJSON: bufToB64u(response.clientDataJSON),
        transports: response.getTransports?.() || [],
      },
    },
  });
}
