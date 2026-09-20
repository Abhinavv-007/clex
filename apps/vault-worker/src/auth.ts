/**
 * Owner authentication for the vault worker.
 *
 * ─── Why this module exists ───────────────────────────────────────────────
 *
 * Every owner-scoped endpoint used to derive the caller's identity like this:
 *
 *     const uid = req.headers.get('X-Vault-UID')
 *     if (!uid) return err('X-Vault-UID required', 401)
 *     // ...then query/modify rows WHERE user_id = uid
 *
 * `X-Vault-UID` is an ordinary request header. Nothing signs it, nothing
 * checks it, and the client chooses its value. Any caller could therefore act
 * as any user simply by sending their id:
 *
 *     curl -H 'X-Vault-UID: <someone-elses-uid>' https://…/vault/api/keys
 *
 * …which listed that user's API keys, and the DELETE route revoked them. The
 * same header governed their uploads and their file-storage quota. Firebase
 * uids are opaque but they are not secrets — they travel through client state
 * and pairing flows — so this was broken access control (OWASP A01), not a
 * theoretical weakness.
 *
 * A verified Firebase ID token is now the only accepted proof of identity.
 * The token is signed by Google, carries `sub`, and is already sent by every
 * browser caller (AccountApp fetches one via getGoogleIdToken() before each
 * request), so requiring it costs nothing on the client.
 *
 * `X-Vault-UID` is still *read*, but only to cross-check: if it is present it
 * must equal the verified subject. That keeps existing clients working while
 * making a mismatched pair an explicit error rather than a silent takeover.
 */

import type { Env } from './index'
import { verifyFirebaseAuthHeader } from './firebase'

export interface Owner {
  uid: string
  email: string | null
}

export type OwnerResult =
  | { ok: true; owner: Owner }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Resolves the authenticated owner of a request, or an error to return.
 *
 * Callers must not fall back to any other source of identity.
 */
export async function requireOwner(req: Request, env: Env): Promise<OwnerResult> {
  const claims = await verifyFirebaseAuthHeader(env, req)

  if (!claims?.sub) {
    return {
      ok: false,
      status: 401,
      error: 'Sign-in required. Send a Firebase ID token as `Authorization: Bearer <token>`.',
    }
  }

  // If the legacy header is present it must agree with the token. A mismatch
  // means the caller is trying to act as somebody else.
  const declared = req.headers.get('X-Vault-UID')
  if (declared && declared !== claims.sub) {
    return {
      ok: false,
      status: 403,
      error: 'X-Vault-UID does not match the authenticated user.',
    }
  }

  return { ok: true, owner: { uid: claims.sub, email: claims.email ?? null } }
}

/**
 * Convenience wrapper for handlers that just want to bail with a JSON error.
 * Returns the owner, or a Response the handler should return as-is.
 */
export async function ownerOrResponse(
  req: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<{ owner: Owner; response?: undefined } | { owner?: undefined; response: Response }> {
  const result = await requireOwner(req, env)
  if (result.ok) return { owner: result.owner }
  return {
    response: new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json', ...cors },
    }),
  }
}
