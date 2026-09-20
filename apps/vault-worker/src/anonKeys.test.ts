import { beforeEach, describe, expect, it } from 'vitest'

import { mintAnonymousKey, clientIp, ANON_MAX_FILE_BYTES, ANON_RATE_PER_MINUTE } from './anonKeys'

/**
 * These cover the properties that make anonymous keys safe to hand out
 * without an account:
 *
 *   · the SERVER generates the secret and stores its hash — the previous
 *     implementation minted keys in the browser and never told the server,
 *     so every key it produced was rejected on first use;
 *   · the device fingerprint is validated, never trusted, and never used as
 *     identity — it only meters how many keys one apparent device may hold;
 *   · minting is capped per device and per source address.
 */

const VALID_FP = 'abcdef0123456789abcdef0123456789'

/** Minimal D1 + KV doubles — enough for the mint path. */
function makeEnv(opts: { activeKeys?: number; mintedToday?: number } = {}) {
  const inserted: unknown[][] = []
  const kv = new Map<string, string>()

  const env = {
    DB: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first<T>() {
                if (sql.includes('COUNT(*)')) return { n: opts.activeKeys ?? 0 } as T
                return null as T
              },
              async run() {
                if (sql.trim().startsWith('INSERT')) inserted.push(args)
                return { meta: { changes: 1 } }
              },
            }
          },
        }
      },
    },
    UPLOAD_QUOTA: {
      async get(k: string) {
        if (k.startsWith('anonmint:') && opts.mintedToday !== undefined) {
          return String(opts.mintedToday)
        }
        return kv.get(k) ?? null
      },
      async put(k: string, v: string) { kv.set(k, v) },
    },
    ANON_KEY_SECRET: 'unit-test-secret',
  } as never

  return { env, inserted, kv }
}

const req = (ip = '203.0.113.9') =>
  new Request('https://clex.in/vault/api/keys/anonymous', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': ip },
  })

describe('clientIp', () => {
  it('reads the edge-set header, which a caller cannot choose', () => {
    expect(clientIp(req('198.51.100.4'))).toBe('198.51.100.4')
  })

  it('falls back rather than throwing when the edge header is absent', () => {
    expect(clientIp(new Request('https://clex.in/'))).toBe('unknown')
  })
})

describe('mintAnonymousKey', () => {
  let ctx: ReturnType<typeof makeEnv>
  beforeEach(() => { ctx = makeEnv() })

  it('has the server generate the key and persist its hash', async () => {
    const result = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.plaintext.startsWith('clex_')).toBe(true)
    expect(result.plaintext.length).toBeGreaterThan(20)

    // One row written, and it must carry a hash — never the plaintext.
    expect(ctx.inserted).toHaveLength(1)
    const row = ctx.inserted[0]
    expect(row).not.toContain(result.plaintext)
    const hash = row.find(v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v))
    expect(hash, 'a SHA-256 hex digest must be stored').toBeTruthy()
  })

  it('issues a distinct secret every time', async () => {
    const a = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
    const b = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(a.plaintext).not.toBe(b.plaintext)
  })

  it('applies the advertised anonymous limits', async () => {
    const result = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.key.ratePerMinute).toBe(ANON_RATE_PER_MINUTE)
    expect(result.key.maxFileBytes).toBe(ANON_MAX_FILE_BYTES)
    // Not unlimited — that was the old behaviour, and it meant no rate limit
    // was ever enforced.
    expect(result.key.ratePerMinute).toBeGreaterThan(0)
    expect(result.key.maxFileBytes).toBeGreaterThan(0)
  })

  it('only exposes the visible prefix, not the secret', async () => {
    const result = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
    if (!result.ok) throw new Error('expected a key')
    expect(result.plaintext.startsWith(result.key.prefix)).toBe(true)
    expect(result.key.prefix.length).toBeLessThan(result.plaintext.length)
  })

  describe('fingerprint validation', () => {
    const rejected: Array<[string, unknown]> = [
      ['missing', undefined],
      ['empty', ''],
      ['too short', 'abc123'],
      ['not a string', 12345],
      ['markup', '<script>alert(1)</script>aaaaaaaaaa'],
      ['path traversal', '../../../etc/passwd_aaaaaaaaaaaa'],
      ['sql-ish', "' OR 1=1 --aaaaaaaaaaaaaaaaaaaaaa"],
      ['whitespace padded to length', '                                '],
      ['over-long', 'a'.repeat(300)],
    ]

    for (const [label, fingerprint] of rejected) {
      it(`rejects a ${label} fingerprint`, async () => {
        const result = await mintAnonymousKey(req(), ctx.env, { fingerprint })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.status).toBe(400)
      })
    }

    it('accepts a plain hex digest', async () => {
      const result = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
      expect(result.ok).toBe(true)
    })
  })

  describe('abuse limits', () => {
    it('refuses once the device holds its cap of active keys', async () => {
      const full = makeEnv({ activeKeys: 3 })
      const result = await mintAnonymousKey(req(), full.env, { fingerprint: VALID_FP })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(429)
        expect(result.error).toMatch(/3 active keys/)
      }
      expect(full.inserted, 'nothing may be written when refused').toHaveLength(0)
    })

    it('refuses once the source address has hit its daily mint budget', async () => {
      const spent = makeEnv({ mintedToday: 10 })
      const result = await mintAnonymousKey(req(), spent.env, { fingerprint: VALID_FP })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(429)
        expect(result.error).toMatch(/this network/i)
      }
      expect(spent.inserted).toHaveLength(0)
    })

    it('counts the IP budget per address, not globally', async () => {
      // A different address must not inherit another's spent budget. The
      // bucket key is derived from the IP, so this checks the derivation is
      // actually address-scoped.
      const a = makeEnv()
      await mintAnonymousKey(req('203.0.113.1'), a.env, { fingerprint: VALID_FP })
      const keysA = [...a.kv.keys()]

      const b = makeEnv()
      await mintAnonymousKey(req('198.51.100.2'), b.env, { fingerprint: VALID_FP })
      const keysB = [...b.kv.keys()]

      expect(keysA[0]).not.toBe(keysB[0])
    })

    it('does not put the raw IP in the quota key', async () => {
      const ip = '203.0.113.77'
      await mintAnonymousKey(req(ip), ctx.env, { fingerprint: VALID_FP })
      for (const k of ctx.kv.keys()) expect(k).not.toContain(ip)
    })
  })

  it('names a key sanely when none is given', async () => {
    const result = await mintAnonymousKey(req(), ctx.env, { fingerprint: VALID_FP })
    if (!result.ok) throw new Error('expected a key')
    expect(result.key.name.length).toBeGreaterThan(0)
    expect(result.key.name.length).toBeLessThanOrEqual(64)
  })

  it('truncates an over-long name rather than storing it whole', async () => {
    const result = await mintAnonymousKey(req(), ctx.env, {
      fingerprint: VALID_FP,
      name: 'n'.repeat(500),
    })
    if (!result.ok) throw new Error('expected a key')
    expect(result.key.name.length).toBeLessThanOrEqual(64)
  })
})
