import { base64urlDecode } from './crypto';
import type { Env } from './index';

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface JwksCacheEntry {
  fetchedAt: number;
  expiresAt: number;
  keys: Record<string, CryptoKey>;
}

let jwksCache: JwksCacheEntry | null = null;

async function loadJwks(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;

  const res = await fetch(GOOGLE_JWKS_URL, { cf: { cacheTtl: 600 } });
  if (!res.ok) throw new Error(`Failed to load Firebase JWKS: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;

  // Cache control header drives our local cache window. Default to 60 min
  // when missing.
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  const keys: Record<string, CryptoKey> = {};
  await Promise.all(
    Object.entries(certs).map(async ([kid, pem]) => {
      try {
        keys[kid] = await importPublicKeyFromPem(pem);
      } catch {
        // Ignore unparseable certs; the rest still work.
      }
    })
  );

  jwksCache = { fetchedAt: now, expiresAt: now + maxAge * 1000, keys };
  return keys;
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// X.509 contains a SubjectPublicKeyInfo we can hand directly to subtle, but
// only after stripping to spki. The trick: import as 'spki' fails on a raw
// X.509 — we have to extract the SPKI from the cert. ASN.1 parsing in JS is
// painful; instead we use a known-good approach: import the cert via the
// Web PKI by using subtle.importKey('spki', …) on the cert bytes, which
// works in Workers because the cert's outer SEQUENCE wraps the SPKI.
// Reference: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
//
// Implementation note: we manually walk the ASN.1 DER structure to find the
// embedded SPKI (TBSCertificate -> subjectPublicKeyInfo).
async function importPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem);
  const spki = extractSpkiFromCert(der);
  return crypto.subtle.importKey(
    'spki',
    spki.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

// Tiny ASN.1 walker. The X.509 layout we care about is:
//   Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
//   tbsCertificate ::= SEQUENCE { version?, serial, sigAlgo, issuer, validity,
//                                 subject, subjectPublicKeyInfo, … }
// We only need the SPKI, which is the 7th element of TBSCertificate when
// version is present (always for v3 certs from Google).
function extractSpkiFromCert(der: Uint8Array): Uint8Array {
  let offset = 0;
  const expectSeq = () => {
    if (der[offset] !== 0x30) throw new Error('Expected SEQUENCE');
    const { length, headerLen } = readLength(der, offset + 1);
    offset += 1 + headerLen;
    return length;
  };
  const skipElement = () => {
    const tag = der[offset];
    const { length, headerLen } = readLength(der, offset + 1);
    offset += 1 + headerLen + length;
    return tag;
  };
  // Outer Certificate SEQUENCE
  expectSeq();
  // tbsCertificate SEQUENCE
  const tbsLen = expectSeq();
  const tbsEnd = offset + tbsLen;
  // version [0] EXPLICIT — context-specific tag 0xA0
  if (der[offset] === 0xa0) skipElement();
  // serialNumber
  skipElement();
  // signature
  skipElement();
  // issuer
  skipElement();
  // validity
  skipElement();
  // subject
  skipElement();
  // subjectPublicKeyInfo SEQUENCE — this is the SPKI we want
  const spkiStart = offset;
  if (der[offset] !== 0x30) throw new Error('Expected SPKI SEQUENCE');
  const { length: spkiLen, headerLen: spkiHeaderLen } = readLength(der, offset + 1);
  const spkiEnd = offset + 1 + spkiHeaderLen + spkiLen;
  if (spkiEnd > tbsEnd) throw new Error('SPKI bounds exceed TBS');
  return der.slice(spkiStart, spkiEnd);
}

function readLength(buf: Uint8Array, at: number): { length: number; headerLen: number } {
  const first = buf[at];
  if (first < 0x80) return { length: first, headerLen: 1 };
  const numBytes = first & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i += 1) {
    length = (length << 8) | buf[at + 1 + i];
  }
  return { length, headerLen: 1 + numBytes };
}

export interface FirebaseClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  auth_time: number;
  user_id?: string;
  firebase?: {
    sign_in_provider?: string;
  };
}

export async function verifyFirebaseIdToken(
  env: Env,
  token: string
): Promise<FirebaseClaims> {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID not configured');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(headerB64))) as {
    alg?: string;
    kid?: string;
    typ?: string;
  };
  if (header.alg !== 'RS256') throw new Error('Unexpected algorithm');
  if (!header.kid) throw new Error('Missing kid');

  const keys = await loadJwks();
  const key = keys[header.kid];
  if (!key) throw new Error('Unknown key id');

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = base64urlDecode(sigB64);
  const ok = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    sig.buffer as ArrayBuffer,
    data.buffer as ArrayBuffer
  );
  if (!ok) throw new Error('Bad signature');

  const claims = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as FirebaseClaims;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('Token expired');
  if (typeof claims.iat !== 'number' || claims.iat > now + 60) throw new Error('Token from future');
  if (claims.aud !== env.FIREBASE_PROJECT_ID) throw new Error('Bad audience');
  const expectedIss = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
  if (claims.iss !== expectedIss) throw new Error('Bad issuer');
  if (!claims.sub) throw new Error('Missing subject');
  if (claims.auth_time && claims.auth_time > now + 60) throw new Error('Auth time invalid');

  return claims;
}

export async function verifyFirebaseAuthHeader(
  env: Env,
  req: Request
): Promise<FirebaseClaims | null> {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  try {
    return await verifyFirebaseIdToken(env, token);
  } catch {
    return null;
  }
}
