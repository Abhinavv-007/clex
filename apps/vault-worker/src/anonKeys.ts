/**
 * Anonymous API keys — no account, no sign-in.
 *
 * ─── What makes this different from the version that didn't work ──────────
 *
 * The developers page used to mint keys in the browser:
 *
 *     state.token = `clex_${fingerprint.slice(0, 12)}_${random}`
 *
 * The server had never heard of that string, so every request carrying it was
 * rejected. A key is only a key if the server stored its hash. So the minting
 * moves here: the client asks, the SERVER generates the secret, stores
 * SHA-256(secret), and returns the plaintext once.
 *
 * ─── What the fingerprint is, and is not ──────────────────────────────────
 *
 * The fingerprint is NOT a credential. It cannot be: it is computed in the
 * browser, so the client picks its value, and a determined caller can send
 * anything. Treating it as identity is exactly the bug that let anyone act as
 * anyone else through `X-Vault-UID` (see auth.ts).
 *
 * The API key is the credential. The fingerprint is only an abuse-mitigation
 * signal, combined server-side with the edge-observed IP to decide how many
 * keys one apparent device may mint. Someone who clears their storage gets a
 * new identity and a fresh allowance — that is understood and acceptable for
 * an anonymous tier, because the meaningful limits (rate, file size) are
 * enforced per key, not per device.
 *
 * Because the anonymous id confers nothing on its own, a key is managed with
 * the key itself — `GET`/`DELETE /vault/api/keys/self` authenticate by
 * presenting the key. There is deliberately no "list every key for this
 * fingerprint" route: that would make the forgeable fingerprint load-bearing
 * again.
 */

import type { Env } from './index'
import { randomBytes, randomHex } from './crypto'

const KEY_PREFIX = 'clex_'
const KEY_PREFIX_VISIBLE_LEN = KEY_PREFIX.length + 8

/** Anonymous tier limits. Deliberately tighter than a signed-in key. */
export const ANON_MAX_FILE_BYTES = 100 * 1024 * 1024 // 100 MB per file
export const ANON_RATE_PER_MINUTE = 60               // 60 requests/min
const ANON_MAX_ACTIVE_KEYS = 3                       // per apparent device
const ANON_MAX_MINTS_PER_IP_PER_DAY = 10             // per source address

const MAX_NAME_LENGTH = 64
const FINGERPRINT_MIN = 16
const FINGERPRINT_MAX = 256

export interface AnonMintResult {
  ok: true
  plaintext: string
  key: {
    id: string
    name: string
    prefix: string
    maxFileBytes: number
    ratePerMinute: number
    createdAt: number
  }
}

export interface AnonMintFailure {
  ok: false
  status: 400 | 429
  error: string
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * HMAC rather than a plain hash so the anonymous id cannot be recomputed
 * offline from a fingerprint and an IP. Falls back to an unkeyed digest when
 * no secret is configured — the id grants nothing on its own, so a guessable
 * id costs confidentiality of nothing, but a keyed one keeps the buckets
 * honest.
 */
async function deriveAnonId(env: Env, fingerprint: string, ip: string): Promise<string> {
  const material = `${fingerprint}|${ip}`
  const secret = env.ANON_KEY_SECRET || env.ADMIN_SECRET || ''

  if (!secret) return `anon_${(await sha256Hex(material)).slice(0, 32)}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(material))
  const hex = Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('')
  return `anon_${hex.slice(0, 32)}`
}

/**
 * The client's real address, as observed by the Cloudflare edge. The edge
 * overwrites CF-Connecting-IP on every inbound request, so unlike an ordinary
 * header a caller cannot choose its own value here.
 */
export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP')
    || req.headers.get('X-Real-IP')
    || 'unknown'
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return 'anonymous key'
  const trimmed = raw.trim().slice(0, MAX_NAME_LENGTH)
  return trimmed || 'anonymous key'
}

/** Accepts only a plausible client-side digest, to keep the bucket key sane. */
function sanitizeFingerprint(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < FINGERPRINT_MIN || trimmed.length > FINGERPRINT_MAX) return null
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null
  return trimmed
}

function generatePlaintextKey(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = randomBytes(28)
  let body = ''
  for (let i = 0; i < bytes.length; i += 1) body += alphabet[bytes[i] % alphabet.length]
  return `${KEY_PREFIX}${body}`
}

/**
 * Mints an anonymous key, or explains why not.
 */
export async function mintAnonymousKey(
  req: Request,
  env: Env,
  body: { fingerprint?: unknown; name?: unknown },
): Promise<AnonMintResult | AnonMintFailure> {
  const fingerprint = sanitizeFingerprint(body.fingerprint)
  if (!fingerprint) {
    return {
      ok: false,
      status: 400,
      error: 'A device fingerprint is required (16-256 chars, [A-Za-z0-9_-]).',
    }
  }

  const ip = clientIp(req)
  const anonId = await deriveAnonId(env, fingerprint, ip)

  // Per-IP daily mint budget. Stops one host from enumerating fingerprints to
  // farm unlimited keys, which the per-device cap alone would not prevent.
  const day = Math.floor(Date.now() / 86_400_000)
  const ipBucket = `anonmint:${await sha256Hex(ip)}:${day}`
  const mintedRaw = await env.UPLOAD_QUOTA.get(ipBucket)
  const minted = mintedRaw ? parseInt(mintedRaw, 10) || 0 : 0
  if (minted >= ANON_MAX_MINTS_PER_IP_PER_DAY) {
    return {
      ok: false,
      status: 429,
      error: `Too many keys created from this network today (${ANON_MAX_MINTS_PER_IP_PER_DAY}). Try again tomorrow, or reuse a key you already have.`,
    }
  }

  // Per-device active-key cap.
  const countRow = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(anonId).first<{ n: number }>()
  if ((countRow?.n ?? 0) >= ANON_MAX_ACTIVE_KEYS) {
    return {
      ok: false,
      status: 429,
      error: `This device already has ${ANON_MAX_ACTIVE_KEYS} active keys. Revoke one before creating another.`,
    }
  }

  const plaintext = generatePlaintextKey()
  const hash = await sha256Hex(plaintext)
  const id = `ck_id_${randomHex(16)}`
  const prefix = plaintext.slice(0, KEY_PREFIX_VISIBLE_LEN)
  const name = sanitizeName(body.name)
  const createdAt = Math.floor(Date.now() / 1000)

  await env.DB.prepare(
    `INSERT INTO api_keys (id, user_id, user_email, name, prefix, hash, max_file_bytes, rate_per_minute, created_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`
  ).bind(id, anonId, name, prefix, hash, ANON_MAX_FILE_BYTES, ANON_RATE_PER_MINUTE, createdAt).run()

  await env.UPLOAD_QUOTA.put(ipBucket, String(minted + 1), { expirationTtl: 2 * 86_400 })

  return {
    ok: true,
    plaintext,
    key: {
      id,
      name,
      prefix,
      maxFileBytes: ANON_MAX_FILE_BYTES,
      ratePerMinute: ANON_RATE_PER_MINUTE,
      createdAt,
    },
  }
}
