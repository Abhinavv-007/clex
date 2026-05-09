/**
 * Clex API key management.
 *
 * KV layout
 * ---------
 *   apikey:meta:{id}                 -> ApiKeyRecord (JSON, no plaintext key)
 *   apikey:lookup:{prefix}           -> id           (prefix = first 12 chars
 *                                                     of the key, kept long
 *                                                     enough to be effectively
 *                                                     unique, never secret)
 *   apikey:owner:{ownerSub}:{id}     -> "1"          (cheap list-by-owner)
 *   apikey:usage:{id}:{utcDate}      -> "<n>"        (per-day request counter)
 *
 */
import type { Env } from './googleAuth'

export const API_KEY_PREFIX = 'apikey:'
const META_PREFIX = `${API_KEY_PREFIX}meta:`
const LOOKUP_PREFIX = `${API_KEY_PREFIX}lookup:`
const OWNER_PREFIX = `${API_KEY_PREFIX}owner:`
const USAGE_PREFIX = `${API_KEY_PREFIX}usage:`

const KEY_TTL_SECONDS = 60 * 60 * 24 * 365 * 5 // 5y; keys live until revoked.
const USAGE_TTL_SECONDS = 60 * 60 * 24 * 90 // keep ~3 months of daily counters.
const MAX_KEYS_PER_OWNER = 5

const PLAN_LIMITS = {
  free: { ratePerMin: -1, sizeBytes: -1, label: 'Unlimited' },
  starter: { ratePerMin: -1, sizeBytes: -1, label: 'Unlimited' },
  pro: { ratePerMin: -1, sizeBytes: -1, label: 'Unlimited' },
  unlimited: { ratePerMin: 1000, sizeBytes: -1, label: 'Unlimited' },
} as const

export type Plan = keyof typeof PLAN_LIMITS

export interface ApiKeyRecord {
  id: string
  ownerSub: string
  ownerEmail: string | null
  label: string
  plan: Plan
  prefix: string
  /** SHA-256 hex of the full key. Plaintext is never stored. */
  hash: string
  createdAt: number
  lastUsedAt: number | null
  revoked: boolean
  revokedAt: number | null
}

export interface PublicApiKey {
  id: string
  label: string
  plan: Plan
  prefix: string
  createdAt: number
  lastUsedAt: number | null
  revoked: boolean
  revokedAt: number | null
  limits: {
    ratePerMin: number
    /** -1 means unlimited. */
    sizeBytes: number
    label: string
  }
  usageToday: number
  usageLast7d: number
}

const ENCODE_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789'

function randomBase32(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ENCODE_ALPHABET[b % ENCODE_ALPHABET.length]
  return out
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function utcDateKey(when: number = Date.now()): string {
  const d = new Date(when)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
}

function planLimits(plan: Plan): { ratePerMin: number; sizeBytes: number; label: string } {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
}

function metaKey(id: string): string {
  return `${META_PREFIX}${id}`
}

function lookupKey(prefix: string): string {
  return `${LOOKUP_PREFIX}${prefix}`
}

function ownerKey(ownerSub: string, id: string): string {
  return `${OWNER_PREFIX}${ownerSub}:${id}`
}

function usageKey(id: string, day: string): string {
  return `${USAGE_PREFIX}${id}:${day}`
}

export async function listKeys(env: Env, ownerSub: string): Promise<PublicApiKey[]> {
  const list = await env.DRIVE_SESSION_STORE.list({ prefix: `${OWNER_PREFIX}${ownerSub}:`, limit: 200 })
  const ids = list.keys.map((k) => k.name.slice(`${OWNER_PREFIX}${ownerSub}:`.length))
  const records = await Promise.all(
    ids.map(async (id) => {
      const raw = await env.DRIVE_SESSION_STORE.get(metaKey(id))
      if (!raw) return null
      try {
        return JSON.parse(raw) as ApiKeyRecord
      } catch {
        return null
      }
    }),
  )
  const usable = records.filter((r): r is ApiKeyRecord => r != null && r.ownerSub === ownerSub)
  // Hydrate per-key usage (today + 7d window).
  const today = utcDateKey()
  const sevenDays = Array.from({ length: 7 }, (_, i) =>
    utcDateKey(Date.now() - i * 24 * 60 * 60 * 1000),
  )
  const enriched = await Promise.all(
    usable.map(async (rec) => {
      const todayCount = Number((await env.DRIVE_SESSION_STORE.get(usageKey(rec.id, today))) ?? 0)
      const weekly = await Promise.all(
        sevenDays.map((day) => env.DRIVE_SESSION_STORE.get(usageKey(rec.id, day))),
      )
      const weeklyTotal = weekly.reduce<number>((acc, v) => acc + Number(v ?? 0), 0)
      return toPublic(rec, todayCount, weeklyTotal)
    }),
  )
  return enriched.sort((a, b) => b.createdAt - a.createdAt)
}

export interface MintResult {
  /** Full plaintext key — surfaced exactly once. */
  key: string
  record: PublicApiKey
}

export async function mintKey(
  env: Env,
  ownerSub: string,
  ownerEmail: string | null,
  label: string,
  plan: Plan,
): Promise<MintResult> {
  const existing = await env.DRIVE_SESSION_STORE.list({
    prefix: `${OWNER_PREFIX}${ownerSub}:`,
    limit: MAX_KEYS_PER_OWNER + 1,
  })
  const activeCount = await countActiveOwnerKeys(env, existing.keys.map(key => key.name))
  if (activeCount >= MAX_KEYS_PER_OWNER) {
    throw new Error(`Per-account limit reached (${MAX_KEYS_PER_OWNER} keys).`)
  }

  const id = randomBase32(16)
  const payload = randomBase32(36)
  const fullKey = `ck_live_${payload}`
  const prefix = fullKey.slice(0, 12)
  const hash = await sha256Hex(fullKey)
  const planKey = (plan in PLAN_LIMITS ? plan : 'free') as Plan

  const record: ApiKeyRecord = {
    id,
    ownerSub,
    ownerEmail,
    label: label.slice(0, 80) || 'Untitled key',
    plan: planKey,
    prefix,
    hash,
    createdAt: Math.floor(Date.now() / 1000),
    lastUsedAt: null,
    revoked: false,
    revokedAt: null,
  }

  await Promise.all([
    env.DRIVE_SESSION_STORE.put(metaKey(id), JSON.stringify(record), {
      expirationTtl: KEY_TTL_SECONDS,
    }),
    env.DRIVE_SESSION_STORE.put(lookupKey(prefix), id, { expirationTtl: KEY_TTL_SECONDS }),
    env.DRIVE_SESSION_STORE.put(ownerKey(ownerSub, id), '1', { expirationTtl: KEY_TTL_SECONDS }),
  ])

  return { key: fullKey, record: toPublic(record, 0, 0) }
}

async function countActiveOwnerKeys(env: Env, ownerKeys: string[]): Promise<number> {
  let active = 0
  await Promise.all(ownerKeys.map(async (key) => {
    const id = key.split(':').pop()
    if (!id) return
    const raw = await env.DRIVE_SESSION_STORE.get(metaKey(id))
    if (!raw) return
    try {
      const rec = JSON.parse(raw) as ApiKeyRecord
      if (!rec.revoked) active += 1
    } catch {
      // ignore malformed records
    }
  }))
  return active
}

export async function revokeKey(env: Env, ownerSub: string, id: string): Promise<boolean> {
  const raw = await env.DRIVE_SESSION_STORE.get(metaKey(id))
  if (!raw) return false
  let rec: ApiKeyRecord
  try {
    rec = JSON.parse(raw) as ApiKeyRecord
  } catch {
    return false
  }
  if (rec.ownerSub !== ownerSub) return false
  rec.revoked = true
  rec.revokedAt = Math.floor(Date.now() / 1000)
  await env.DRIVE_SESSION_STORE.put(metaKey(id), JSON.stringify(rec), {
    expirationTtl: KEY_TTL_SECONDS,
  })
  await env.DRIVE_SESSION_STORE.delete(lookupKey(rec.prefix))
  return true
}

export interface ResolvedKey {
  record: ApiKeyRecord
  /** UTC daily counter post-increment. */
  usageToday: number
}

export async function resolveAndStamp(env: Env, plaintext: string): Promise<ResolvedKey | null> {
  if (!plaintext.startsWith('ck_live_')) return null
  const prefix = plaintext.slice(0, 12)
  const id = await env.DRIVE_SESSION_STORE.get(lookupKey(prefix))
  if (!id) return null
  const rawMeta = await env.DRIVE_SESSION_STORE.get(metaKey(id))
  if (!rawMeta) return null
  let rec: ApiKeyRecord
  try {
    rec = JSON.parse(rawMeta) as ApiKeyRecord
  } catch {
    return null
  }
  if (rec.revoked) return null
  const expected = rec.hash
  const got = await sha256Hex(plaintext)
  if (!safeEqual(expected, got)) return null

  // Stamp last-used + bump today's counter. KV writes are best-effort —
  // if the stamp lags by a few seconds it doesn't affect correctness of
  // the request being served.
  const day = utcDateKey()
  const counterKey = usageKey(id, day)
  const current = Number((await env.DRIVE_SESSION_STORE.get(counterKey)) ?? 0)
  const next = current + 1
  rec.lastUsedAt = Math.floor(Date.now() / 1000)
  await Promise.all([
    env.DRIVE_SESSION_STORE.put(metaKey(id), JSON.stringify(rec), {
      expirationTtl: KEY_TTL_SECONDS,
    }),
    env.DRIVE_SESSION_STORE.put(counterKey, String(next), { expirationTtl: USAGE_TTL_SECONDS }),
  ])
  return { record: rec, usageToday: next }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export function toPublic(
  rec: ApiKeyRecord,
  usageToday: number,
  usageLast7d: number,
): PublicApiKey {
  return {
    id: rec.id,
    label: rec.label,
    plan: rec.plan,
    prefix: rec.prefix,
    createdAt: rec.createdAt,
    lastUsedAt: rec.lastUsedAt,
    revoked: rec.revoked,
    revokedAt: rec.revokedAt,
    limits: planLimits(rec.plan),
    usageToday,
    usageLast7d,
  }
}

export async function dailyUsageWindow(
  env: Env,
  ownerSub: string,
  days: number = 30,
): Promise<{ day: string; count: number }[]> {
  // Aggregate usage across every key the owner has minted so the dashboard
  // can render a single "all my keys" daily strip.
  const ownerList = await env.DRIVE_SESSION_STORE.list({
    prefix: `${OWNER_PREFIX}${ownerSub}:`,
    limit: 200,
  })
  const ids = ownerList.keys.map((k) => k.name.slice(`${OWNER_PREFIX}${ownerSub}:`.length))
  if (ids.length === 0) return []
  const window = Array.from({ length: days }, (_, i) =>
    utcDateKey(Date.now() - i * 24 * 60 * 60 * 1000),
  ).reverse()
  const cells = await Promise.all(
    window.map(async (day) => {
      const perKey = await Promise.all(
        ids.map((id) => env.DRIVE_SESSION_STORE.get(usageKey(id, day))),
      )
      return { day, count: perKey.reduce<number>((acc, v) => acc + Number(v ?? 0), 0) }
    }),
  )
  return cells
}
