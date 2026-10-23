import { describe, expect, it } from 'vitest'
import { readFilename, tooLarge } from './requestLimits'
import { checkAdmin } from './adminSession'

describe('readFilename', () => {
  it('decodes percent-encoding', () => {
    expect(readFilename('r%C3%A9sum%C3%A9.pdf')).toBe('résumé.pdf')
  })
  it('keeps a header that is not valid percent-encoding instead of throwing', () => {
    expect(readFilename('100%.txt')).toBe('100%.txt')
  })
  it('strips directories and control characters', () => {
    expect(readFilename('..%2F..%2Fetc%2Fpasswd')).toBe('passwd')
    expect(readFilename('a\u0000b\nc.txt')).toBe('abc.txt')
  })
  it('rejects empty and dot names', () => {
    expect(readFilename('')).toBeNull()
    expect(readFilename('..')).toBeNull()
  })
})

describe('tooLarge', () => {
  it('compares the declared length', () => {
    const req = (n: string) => new Request('https://clex.in/x', { method: 'POST', headers: { 'content-length': n } })
    expect(tooLarge(req('11'), 10)).toBe(true)
    expect(tooLarge(req('10'), 10)).toBe(false)
  })
})

describe('checkAdmin (vault side of the console session)', () => {
  const sid = 'a'.repeat(32)
  const kv = {
    async get(key: string) {
      return key === `admin:sess:${sid}` ? JSON.stringify({ expires_at: Math.floor(Date.now() / 1000) + 600 }) : null
    },
  } as unknown as KVNamespace
  const env = { CLEX_ADMIN_SECRET: 's3cret', ALLOWED_ORIGIN: 'https://clex.in' }
  const req = (headers: Record<string, string>, method = 'GET') =>
    new Request('https://clex.in/vault/api/admin/summary', { method, headers })

  it('accepts a live session cookie with the CSRF header', async () => {
    const r = await checkAdmin(req({ cookie: `__Host-clex_admin=${sid}`, 'x-clex-admin': '1' }), env, kv, true)
    expect(r.ok).toBe(true)
  })
  it('refuses a session cookie without the CSRF header', async () => {
    const r = await checkAdmin(req({ cookie: `__Host-clex_admin=${sid}` }), env, kv, true)
    expect(r).toMatchObject({ ok: false, status: 403 })
  })
  it('refuses an unknown session', async () => {
    const r = await checkAdmin(req({ cookie: `__Host-clex_admin=${'b'.repeat(32)}`, 'x-clex-admin': '1' }), env, kv, true)
    expect(r).toMatchObject({ ok: false, status: 401 })
  })
  it('accepts the secret for reads but not for writes', async () => {
    expect((await checkAdmin(req({ 'x-admin-secret': 's3cret' }), env, kv, true)).ok).toBe(true)
    expect((await checkAdmin(req({ 'x-admin-secret': 's3cret' }, 'POST'), env, kv, false)).ok).toBe(false)
  })
})
