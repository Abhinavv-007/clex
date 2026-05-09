const HEX_BYTE = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

export function hex(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < view.length; i += 1) out += HEX_BYTE[view[i]];
  return out;
}

export function fromHex(s: string): Uint8Array {
  const clean = s.length % 2 === 0 ? s : `0${s}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return hex(digest);
}

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function randomHex(n: number): string {
  return hex(randomBytes(n));
}

export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < view.length; i += 1) s += String.fromCharCode(view[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
