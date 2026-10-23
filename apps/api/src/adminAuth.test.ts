import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import { handleAdminLogin, handleAdminLogout, handleAdminMe } from './adminPanel'
import { LOGIN_MAX_ATTEMPTS, listAdminLogins } from './adminAuth'
import { LoginThrottle } from './loginThrottle'

/** In-memory KV with the bits of the API the admin code uses, metadata included. */
function memoryKv() {
  const store = new Map<string, { value: string; metadata?: unknown }>()
  const kv = {
    async get(key: string) { return store.get(key)?.value ?? null },
    async put(key: string, value: string, opts?: { metadata?: unknown }) { store.set(key, { value, metadata: opts?.metadata }) },
    async delete(key: string) { store.delete(key) },
    async list({ prefix = '', limit = 1000 }: { prefix?: string; limit?: number } = {}) {
      const keys = [...store.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit)
      return { keys: keys.map(name => ({ name, metadata: store.get(name)?.metadata })), list_complete: true, cursor: undefined }
    },
  }
  return { kv: kv as unknown as KVNamespace, store }
}

/**
 * A stand-in for the Durable Object namespace that runs the real LoginThrottle
 * class. Its storage awaits on every call and blockConcurrencyWhile is a real
 * mutex, so concurrent requests interleave the way they would without one.
 */
function throttleNamespace() {
  const instances = new Map<string, LoginThrottle>()
  const make = () => {
    const data = new Map<string, unknown>()
    let chain = Promise.resolve()
    const tick = () => new Promise((r) => setTimeout(r, 0))
    const state = {
      storage: {
        async get(k: string) { await tick(); return data.get(k) },
        async put(k: string, v: unknown) { await tick(); data.set(k, v) },
        async deleteAll() { await tick(); data.clear() },
        async setAlarm() { await tick() },
      },
      blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
        const run = chain.then(fn)
        chain = run.then(() => undefined, () => undefined)
        return run
      },
    }
    return new LoginThrottle(state as unknown as DurableObjectState)
  }
  return {
    idFromName: (name: string) => name,
    get: (id: string) => {
      if (!instances.has(id)) instances.set(id, make())
      const obj = instances.get(id)!
      return { fetch: (url: string, init?: RequestInit) => obj.fetch(new Request(url, init)) }
    },
  } as unknown as DurableObjectNamespace
}

function makeEnv(withThrottle = true) {
  const { kv, store } = memoryKv()
  const env = {
    DRIVE_SESSION_STORE: kv,
    LOGIN_THROTTLE: withThrottle ? throttleNamespace() : undefined,
    ALLOWED_ORIGIN: 'https://clex.in, https://www.clex.in',
    FRONTEND_BASE_URL: 'https://clex.in',
    CLEX_ADMIN_SECRET: 'correct horse battery staple',
  } as Env
  return { env, store }
}

const IP = { 'cf-connecting-ip': '203.0.113.7' }

function login(secret: string, headers: Record<string, string> = {}) {
  return new Request('https://clex.in/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://clex.in', ...IP, ...headers },
    body: JSON.stringify({ secret }),
  })
}

function cookieFrom(res: Response): string {
  const set = res.headers.get('set-cookie') || ''
  return set.split(';')[0]
}

describe('admin sign-in', () => {
  it('sets an HttpOnly, Secure, SameSite=Strict host cookie and never returns the session id', async () => {
    const { env } = makeEnv()
    const res = await handleAdminLogin(login('correct horse battery staple'), env)
    expect(res.status).toBe(200)
    const set = res.headers.get('set-cookie') || ''
    expect(set).toMatch(/^__Host-clex_admin=[0-9a-f]{32};/)
    expect(set).toContain('HttpOnly')
    expect(set).toContain('Secure')
    expect(set).toContain('SameSite=Strict')
    const body = await res.json() as { session: { session_id: string } }
    expect(body.session.session_id).toHaveLength(12)
    expect(set).not.toContain(`=${body.session.session_id};`)
  })

  it('rejects a wrong secret and logs the attempt', async () => {
    const { env } = makeEnv()
    const res = await handleAdminLogin(login('nope'), env)
    expect(res.status).toBe(401)
    const logins = await listAdminLogins(env, 10)
    expect(logins[0]).toMatchObject({ method: 'password', result: 'failure', ip: '203.0.113.7' })
  })

  it('locks an address out after repeated failures, even with the right secret', async () => {
    const { env } = makeEnv()
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) await handleAdminLogin(login('nope'), env)
    const res = await handleAdminLogin(login('correct horse battery staple'), env)
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  it('bounds parallel guesses: no more than the limit are ever checked', async () => {
    const { env } = makeEnv()
    const results = await Promise.all(Array.from({ length: 25 }, () => handleAdminLogin(login('nope'), env)))
    const checked = results.filter(r => r.status === 401).length
    const refused = results.filter(r => r.status === 429).length
    expect(checked).toBe(LOGIN_MAX_ATTEMPTS)
    expect(refused).toBe(25 - LOGIN_MAX_ATTEMPTS)
  })

  it('a successful sign-in clears the count', async () => {
    const { env } = makeEnv()
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i += 1) await handleAdminLogin(login('nope'), env)
    expect((await handleAdminLogin(login('correct horse battery staple'), env)).status).toBe(200)
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i += 1) await handleAdminLogin(login('nope'), env)
    expect((await handleAdminLogin(login('correct horse battery staple'), env)).status).toBe(200)
  })

  it('still locks out on the KV fallback when the Durable Object is not bound', async () => {
    const { env } = makeEnv(false)
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) await handleAdminLogin(login('nope'), env)
    expect((await handleAdminLogin(login('correct horse battery staple'), env)).status).toBe(429)
  })

  it('refuses sign-ins from another site without counting them', async () => {
    const { env } = makeEnv()
    for (let i = 0; i < 20; i += 1) {
      const res = await handleAdminLogin(login('nope', { origin: 'https://evil.example' }), env)
      expect(res.status).toBe(403)
    }
    // A simple text/plain POST (no CORS preflight) is refused too.
    const plain = await handleAdminLogin(new Request('https://clex.in/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'text/plain', ...IP },
      body: JSON.stringify({ secret: 'nope' }),
    }), env)
    expect(plain.status).toBe(415)
    // None of that spent the operator's attempts.
    expect((await handleAdminLogin(login('correct horse battery staple'), env)).status).toBe(200)
  })

  it('shows sign-ins recorded in the old log format after the new ones', async () => {
    const { env, store } = makeEnv()
    store.set('admin:login:1700000000:aaaa', { value: JSON.stringify({ id: 'aaaa', created_at: 1700000000, method: 'password', result: 'failure', reason: 'bad_secret', ip: '198.51.100.9', ua: 'old', passkey_id: null }) })
    store.set('admin:login:1700000500:bbbb', { value: JSON.stringify({ id: 'bbbb', created_at: 1700000500, method: 'passkey', result: 'success', reason: null, ip: '198.51.100.9', ua: 'old', passkey_id: 'pk' }) })
    await handleAdminLogin(login('nope'), env)
    const logins = await listAdminLogins(env, 10)
    expect(logins.map(l => l.id).slice(1)).toEqual(['bbbb', 'aaaa'])
    expect(logins[0]).toMatchObject({ ip: '203.0.113.7', result: 'failure' })
  })

  it('ignores X-Forwarded-For when counting failures', async () => {
    const { env } = makeEnv()
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i += 1) {
      await handleAdminLogin(login('nope', { 'x-forwarded-for': `198.51.100.${i}` }), env)
    }
    const res = await handleAdminLogin(login('correct horse battery staple'), env)
    expect(res.status).toBe(429)
  })
})

describe('admin session guard', () => {
  async function signedIn() {
    const { env } = makeEnv()
    const res = await handleAdminLogin(login('correct horse battery staple'), env)
    return { env, cookie: cookieFrom(res) }
  }

  it('accepts the cookie with the CSRF header from the same origin', async () => {
    const { env, cookie } = await signedIn()
    const res = await handleAdminMe(new Request('https://clex.in/api/admin/me', {
      headers: { cookie, 'x-clex-admin': '1' },
    }), env)
    expect(res.status).toBe(200)
  })

  it('refuses the cookie without the CSRF header', async () => {
    const { env, cookie } = await signedIn()
    const res = await handleAdminMe(new Request('https://clex.in/api/admin/me', { headers: { cookie } }), env)
    expect(res.status).toBe(403)
  })

  it('refuses the cookie from a foreign origin', async () => {
    const { env, cookie } = await signedIn()
    const res = await handleAdminMe(new Request('https://clex.in/api/admin/me', {
      headers: { cookie, 'x-clex-admin': '1', origin: 'https://evil.example' },
    }), env)
    expect(res.status).toBe(403)
  })

  it('signs out: the session stops working and the cookie is cleared', async () => {
    const { env, cookie } = await signedIn()
    const out = await handleAdminLogout(new Request('https://clex.in/api/admin/logout', {
      method: 'POST', headers: { cookie, 'x-clex-admin': '1', origin: 'https://clex.in' },
    }), env)
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
    const res = await handleAdminMe(new Request('https://clex.in/api/admin/me', {
      headers: { cookie, 'x-clex-admin': '1' },
    }), env)
    expect(res.status).toBe(401)
  })
})
