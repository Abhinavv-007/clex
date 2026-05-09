// ═══════════════════════════════════════════════════════════════════════════
// Minimal WebAuthn helpers for admin passkey enrollment + assertion. We
// support ES256 (most common platform authenticators) and RS256.
//
// We intentionally implement only what we need (no userHandle disambiguation
// since the admin is a single principal). The flow is:
//
//   Registration:
//     POST /api/admin/passkeys/register/begin   -> { challenge, rp, user, ... }
//     navigator.credentials.create(...)
//     POST /api/admin/passkeys/register/finish  -> stores { credId, pubKey, counter }
//
//   Assertion:
//     POST /api/admin/login/passkey/begin       -> { challenge, allowCredentials }
//     navigator.credentials.get(...)
//     POST /api/admin/login/passkey/finish      -> issues admin session
// ═══════════════════════════════════════════════════════════════════════════

import { base64urlDecode, base64urlEncode, sha256Hex } from './crypto';

export type Cose = {
  alg: number; // -7 = ES256, -257 = RS256
  raw: Uint8Array; // SPKI we'll persist
};

interface ParsedAttestation {
  authData: Uint8Array;
  fmt: string;
}

interface AuthDataParsed {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  aaguid?: Uint8Array;
  credentialId?: Uint8Array;
  credentialPublicKey?: Uint8Array; // raw COSE key bytes
}

// ── Tiny CBOR decoder (only what we need for COSE keys + attestation) ────

interface CborResult {
  value: unknown;
  next: number;
}

function cborDecode(buf: Uint8Array, at = 0): CborResult {
  const initial = buf[at];
  const major = initial >> 5;
  const minor = initial & 0x1f;
  let length = minor;
  let cursor = at + 1;
  if (minor === 24) {
    length = buf[cursor];
    cursor += 1;
  } else if (minor === 25) {
    length = (buf[cursor] << 8) | buf[cursor + 1];
    cursor += 2;
  } else if (minor === 26) {
    length =
      buf[cursor] * 0x1000000 +
      (buf[cursor + 1] << 16) +
      (buf[cursor + 2] << 8) +
      buf[cursor + 3];
    cursor += 4;
  } else if (minor === 27) {
    // 64-bit length, unsupported in browser stuff anyway
    throw new Error('CBOR 64-bit lengths unsupported');
  } else if (minor >= 28 && minor !== 31) {
    throw new Error('Unsupported CBOR minor');
  }

  switch (major) {
    case 0:
      return { value: length, next: cursor };
    case 1:
      return { value: -1 - length, next: cursor };
    case 2: {
      const slice = buf.slice(cursor, cursor + length);
      return { value: slice, next: cursor + length };
    }
    case 3: {
      const slice = buf.slice(cursor, cursor + length);
      return { value: new TextDecoder().decode(slice), next: cursor + length };
    }
    case 4: {
      const arr: unknown[] = [];
      for (let i = 0; i < length; i += 1) {
        const r = cborDecode(buf, cursor);
        arr.push(r.value);
        cursor = r.next;
      }
      return { value: arr, next: cursor };
    }
    case 5: {
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < length; i += 1) {
        const k = cborDecode(buf, cursor);
        cursor = k.next;
        const v = cborDecode(buf, cursor);
        cursor = v.next;
        map.set(k.value, v.value);
      }
      return { value: map, next: cursor };
    }
    case 7:
      if (minor === 20) return { value: false, next: cursor };
      if (minor === 21) return { value: true, next: cursor };
      if (minor === 22) return { value: null, next: cursor };
      throw new Error(`Unsupported CBOR simple value ${minor}`);
    default:
      throw new Error(`Unsupported CBOR major ${major}`);
  }
}

// ── Authenticator data ───────────────────────────────────────────────────

function parseAuthData(buf: Uint8Array): AuthDataParsed {
  if (buf.length < 37) throw new Error('authData too short');
  const rpIdHash = buf.slice(0, 32);
  const flags = buf[32];
  const signCount = (buf[33] << 24) | (buf[34] << 16) | (buf[35] << 8) | buf[36];
  let cursor = 37;
  let aaguid: Uint8Array | undefined;
  let credentialId: Uint8Array | undefined;
  let credentialPublicKey: Uint8Array | undefined;
  if (flags & 0x40) {
    aaguid = buf.slice(cursor, cursor + 16);
    cursor += 16;
    const credIdLen = (buf[cursor] << 8) | buf[cursor + 1];
    cursor += 2;
    credentialId = buf.slice(cursor, cursor + credIdLen);
    cursor += credIdLen;
    const cose = cborDecode(buf, cursor);
    credentialPublicKey = buf.slice(cursor, cose.next);
    cursor = cose.next;
  }
  return { rpIdHash, flags, signCount, aaguid, credentialId, credentialPublicKey };
}

// ── COSE key → SPKI conversion (so we can stash and import later) ───────

function coseToSpki(coseBytes: Uint8Array): { alg: number; spki: Uint8Array } {
  const decoded = cborDecode(coseBytes);
  const map = decoded.value as Map<number, unknown>;
  const kty = map.get(1) as number;
  const alg = map.get(3) as number;
  if (kty === 2 && alg === -7) {
    // EC2 P-256
    const x = map.get(-2) as Uint8Array;
    const y = map.get(-3) as Uint8Array;
    if (!x || !y || x.length !== 32 || y.length !== 32) throw new Error('Bad EC key');
    return { alg, spki: ecP256ToSpki(x, y) };
  }
  if (kty === 3 && alg === -257) {
    const n = map.get(-1) as Uint8Array;
    const e = map.get(-2) as Uint8Array;
    if (!n || !e) throw new Error('Bad RSA key');
    return { alg, spki: rsaToSpki(n, e) };
  }
  throw new Error(`Unsupported COSE key alg=${alg}`);
}

function ecP256ToSpki(x: Uint8Array, y: Uint8Array): Uint8Array {
  // SubjectPublicKeyInfo wrapper for prime256v1 with uncompressed point.
  const prefix = new Uint8Array([
    0x30,
    0x59,
    0x30,
    0x13,
    0x06,
    0x07,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x02,
    0x01,
    0x06,
    0x08,
    0x2a,
    0x86,
    0x48,
    0xce,
    0x3d,
    0x03,
    0x01,
    0x07,
    0x03,
    0x42,
    0x00,
    0x04,
  ]);
  const out = new Uint8Array(prefix.length + 64);
  out.set(prefix, 0);
  out.set(x, prefix.length);
  out.set(y, prefix.length + 32);
  return out;
}

function rsaToSpki(n: Uint8Array, e: Uint8Array): Uint8Array {
  // Build SubjectPublicKeyInfo for RSA with PKCS#1 RSAPublicKey inside.
  const nDer = derInteger(n);
  const eDer = derInteger(e);
  const rsaPublicKey = derSequence(concat([nDer, eDer]));
  const algorithm = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  const bitString = derBitString(rsaPublicKey);
  return derSequence(concat([algorithm, bitString]));
}

function derInteger(bytes: Uint8Array): Uint8Array {
  // Strip leading zero bytes that aren't sign-disambiguating.
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0 && (bytes[start + 1] & 0x80) === 0) {
    start += 1;
  }
  let body = bytes.slice(start);
  if (body[0] & 0x80) {
    const padded = new Uint8Array(body.length + 1);
    padded[0] = 0;
    padded.set(body, 1);
    body = padded;
  }
  return concat([new Uint8Array([0x02]), encodeLength(body.length), body]);
}

function derSequence(content: Uint8Array): Uint8Array {
  return concat([new Uint8Array([0x30]), encodeLength(content.length), content]);
}

function derBitString(content: Uint8Array): Uint8Array {
  return concat([new Uint8Array([0x03]), encodeLength(content.length + 1), new Uint8Array([0x00]), content]);
}

function encodeLength(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x100) return new Uint8Array([0x81, n]);
  if (n < 0x10000) return new Uint8Array([0x82, (n >> 8) & 0xff, n & 0xff]);
  if (n < 0x1000000) return new Uint8Array([0x83, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
  return new Uint8Array([0x84, (n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ── Registration ─────────────────────────────────────────────────────────

export interface RegistrationVerifyInput {
  attestationObjectB64: string; // base64url
  clientDataJsonB64: string; // base64url
  expectedChallenge: string; // base64url
  expectedRpId: string;
  expectedOrigins: string[];
}

export interface RegistrationVerifyResult {
  credentialId: string; // base64url
  publicKeyB64: string; // base64url SPKI
  alg: number;
  signCount: number;
  transports: string[] | null;
}

export async function verifyRegistration(
  input: RegistrationVerifyInput
): Promise<RegistrationVerifyResult> {
  const clientData = JSON.parse(
    new TextDecoder().decode(base64urlDecode(input.clientDataJsonB64))
  ) as { type: string; challenge: string; origin: string };
  if (clientData.type !== 'webauthn.create') throw new Error('Invalid type');
  if (clientData.challenge !== input.expectedChallenge) throw new Error('Bad challenge');
  if (!input.expectedOrigins.includes(clientData.origin)) throw new Error('Bad origin');

  const attestation = parseAttestation(base64urlDecode(input.attestationObjectB64));
  const authData = parseAuthData(attestation.authData);

  if (!authData.credentialId || !authData.credentialPublicKey) {
    throw new Error('Missing attested credential data');
  }
  if (!(authData.flags & 0x01)) throw new Error('User presence required');

  const rpHash = await sha256Hex(input.expectedRpId);
  if (!buffersEqual(authData.rpIdHash, hexToBytes(rpHash))) throw new Error('Bad rpId');

  const { alg, spki } = coseToSpki(authData.credentialPublicKey);

  return {
    credentialId: base64urlEncode(authData.credentialId),
    publicKeyB64: base64urlEncode(spki),
    alg,
    signCount: authData.signCount,
    transports: null,
  };
}

function parseAttestation(buf: Uint8Array): ParsedAttestation {
  const decoded = cborDecode(buf);
  const map = decoded.value as Map<string, unknown>;
  const fmt = map.get('fmt') as string;
  const authData = map.get('authData') as Uint8Array;
  if (!fmt || !authData) throw new Error('Bad attestation object');
  return { fmt, authData };
}

// ── Assertion ────────────────────────────────────────────────────────────

export interface AssertionVerifyInput {
  authenticatorDataB64: string;
  clientDataJsonB64: string;
  signatureB64: string;
  expectedChallenge: string;
  expectedRpId: string;
  expectedOrigins: string[];
  storedPublicKeyB64: string;
  alg: number;
  storedSignCount: number;
}

export interface AssertionVerifyResult {
  newSignCount: number;
}

export async function verifyAssertion(
  input: AssertionVerifyInput
): Promise<AssertionVerifyResult> {
  const clientData = JSON.parse(
    new TextDecoder().decode(base64urlDecode(input.clientDataJsonB64))
  ) as { type: string; challenge: string; origin: string };
  if (clientData.type !== 'webauthn.get') throw new Error('Invalid type');
  if (clientData.challenge !== input.expectedChallenge) throw new Error('Bad challenge');
  if (!input.expectedOrigins.includes(clientData.origin)) throw new Error('Bad origin');

  const authData = base64urlDecode(input.authenticatorDataB64);
  const parsed = parseAuthData(authData);
  if (!(parsed.flags & 0x01)) throw new Error('User presence required');

  const rpHash = await sha256Hex(input.expectedRpId);
  if (!buffersEqual(parsed.rpIdHash, hexToBytes(rpHash))) throw new Error('Bad rpId');

  if (parsed.signCount !== 0 && parsed.signCount <= input.storedSignCount) {
    throw new Error('Sign count regression');
  }

  const spki = base64urlDecode(input.storedPublicKeyB64);
  const algorithm = input.alg === -7
    ? ({ name: 'ECDSA', namedCurve: 'P-256' } as EcKeyImportParams)
    : ({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as RsaHashedImportParams);
  const verifyAlgo = input.alg === -7
    ? ({ name: 'ECDSA', hash: 'SHA-256' } as EcdsaParams)
    : ({ name: 'RSASSA-PKCS1-v1_5' } as AlgorithmIdentifier);

  const key = await crypto.subtle.importKey('spki', spki.buffer as ArrayBuffer, algorithm, false, ['verify']);
  const clientDataHash = await crypto.subtle.digest(
    'SHA-256',
    base64urlDecode(input.clientDataJsonB64).buffer as ArrayBuffer
  );
  const signed = concat([authData, new Uint8Array(clientDataHash)]);
  let sig = base64urlDecode(input.signatureB64);
  if (input.alg === -7) sig = derEcdsaToRaw(sig);

  const ok = await crypto.subtle.verify(verifyAlgo, key, sig.buffer as ArrayBuffer, signed.buffer as ArrayBuffer);
  if (!ok) throw new Error('Bad signature');

  return { newSignCount: parsed.signCount };
}

// Convert DER-encoded ECDSA signature to raw r||s for SubtleCrypto.
function derEcdsaToRaw(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) return der; // assume raw already
  let cursor = 2;
  if ((der[1] & 0x80) !== 0) cursor = 2 + (der[1] & 0x7f);
  if (der[cursor] !== 0x02) return der;
  const rLen = der[cursor + 1];
  const rawR = der.slice(cursor + 2, cursor + 2 + rLen);
  cursor += 2 + rLen;
  if (der[cursor] !== 0x02) return der;
  const sLen = der[cursor + 1];
  const rawS = der.slice(cursor + 2, cursor + 2 + sLen);
  const r = padOrTrim(new Uint8Array(rawR), 32);
  const s = padOrTrim(new Uint8Array(rawS), 32);
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}

function padOrTrim(buf: Uint8Array, length: number): Uint8Array {
  if (buf.length === length) return buf;
  if (buf.length > length) return buf.slice(buf.length - length);
  const out = new Uint8Array(length);
  out.set(buf, length - buf.length);
  return out;
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function hexToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function rpOriginsFromEnv(rpId: string): string[] {
  if (rpId === 'localhost') return ['http://localhost:8788', 'http://localhost:3000'];
  return [`https://${rpId}`, `https://www.${rpId}`, `https://api.${rpId}`];
}
