import { beforeEach, describe, expect, it, vi } from 'vitest'

// `auth.ts` verifies the caller's Firebase ID token. The signature check
// itself is exercised by Firebase's own JWKS path; what matters here is the
// authorization decision built on top of it, so the verifier is stubbed and
// the decision table is tested directly.
const verifyFirebaseAuthHeader = vi.fn()
vi.mock('./firebase', () => ({
  verifyFirebaseAuthHeader: (...args: unknown[]) => verifyFirebaseAuthHeader(...args),
}))

const { requireOwner } = await import('./auth')

const env = {} as never

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://clex.in/vault/api/keys', { headers })
}

describe('requireOwner', () => {
  beforeEach(() => {
    verifyFirebaseAuthHeader.mockReset()
  })

  it('accepts a request carrying a valid token', async () => {
    verifyFirebaseAuthHeader.mockResolvedValue({ sub: 'uid-alice', email: 'alice@example.com' })
    const result = await requireOwner(req({ Authorization: 'Bearer good' }), env)
    expect(result).toEqual({ ok: true, owner: { uid: 'uid-alice', email: 'alice@example.com' } })
  })

  it('rejects a request with no token at all', async () => {
    verifyFirebaseAuthHeader.mockResolvedValue(null)
    const result = await requireOwner(req(), env)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('rejects a bare X-Vault-UID header — the header is not proof of identity', async () => {
    // This is the regression that matters. The header is chosen by the
    // caller, so treating it as identity let anyone read and revoke another
    // user's API keys, list their uploads and spend their storage quota:
    //     curl -H 'X-Vault-UID: <victim>' https://clex.in/vault/api/keys
    verifyFirebaseAuthHeader.mockResolvedValue(null)
    const result = await requireOwner(req({ 'X-Vault-UID': 'uid-victim' }), env)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('rejects a token whose subject disagrees with the declared uid', async () => {
    verifyFirebaseAuthHeader.mockResolvedValue({ sub: 'uid-attacker', email: null })
    const result = await requireOwner(
      req({ Authorization: 'Bearer good', 'X-Vault-UID': 'uid-victim' }),
      env,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(403)
  })

  it('accepts a matching uid header alongside the token, for existing clients', async () => {
    verifyFirebaseAuthHeader.mockResolvedValue({ sub: 'uid-alice', email: null })
    const result = await requireOwner(
      req({ Authorization: 'Bearer good', 'X-Vault-UID': 'uid-alice' }),
      env,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.owner.uid).toBe('uid-alice')
  })

  it('rejects a verified token that carries no subject', async () => {
    verifyFirebaseAuthHeader.mockResolvedValue({ email: 'nobody@example.com' })
    const result = await requireOwner(req({ Authorization: 'Bearer weird' }), env)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('treats a rejected token as unauthenticated rather than throwing', async () => {
    verifyFirebaseAuthHeader.mockResolvedValue(null)
    await expect(requireOwner(req({ Authorization: 'Bearer expired' }), env)).resolves.toMatchObject({
      ok: false,
      status: 401,
    })
  })
})
