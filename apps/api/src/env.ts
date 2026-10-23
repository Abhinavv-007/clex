/**
 * Shared worker environment and HTTP helpers.
 *
 * This was `googleAuth.ts` and carried the Google Drive OAuth flow alongside
 * the `Env` type and CORS helpers that every other module imports. Drive is
 * gone — Clex transfers are direct P2P and local-network only — and so are the
 * cookie and redirect helpers that only that flow used.
 */
export interface Env {
  /**
   * General-purpose KV store. The name is historical — it was added for Drive
   * OAuth sessions, but admin sessions, passkeys, the sign-in log and transfer
   * records live here now, and the binding name is fixed by wrangler.toml and
   * by the data already in it. The vault worker binds the same namespace as
   * VAULT_TOKENS and the chain worker as ADMIN_SESSIONS, which is how they
   * recognise a console session.
   */
  DRIVE_SESSION_STORE: KVNamespace
  /** Counts admin sign-in attempts per address, atomically. See loginThrottle.ts. */
  LOGIN_THROTTLE?: DurableObjectNamespace
  ALLOWED_ORIGIN: string
  FRONTEND_BASE_URL: string
  WEBAUTHN_RP_ID?: string
  WEBAUTHN_RP_NAME?: string
  /**
   * Server-side admin secret: the console's password sign-in, and what
   * lnch.in's `CLEX_ADMIN_SECRET` proxy forwards as X-Admin-Secret. Falls
   * back to `ADMIN_SECRET` for backward-compat with older wrangler config.
   */
  CLEX_ADMIN_SECRET?: string
  ADMIN_SECRET?: string
}

export function resolveAllowedOrigin(origin: string, allowedOriginsStr: string): string | null {
  if (!origin) return null
  if (allowedOriginsStr === '*') return origin

  const allowedOrigins = allowedOriginsStr
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)

  return allowedOrigins.includes(origin) ? origin : null
}

export function appendCors(headers: Headers, request: Request, env: Env): void {
  const origin = request.headers.get('Origin') ?? ''
  if (!origin) return

  // A wildcard (local dev) answers any origin but never with credentials:
  // reflecting an arbitrary origin together with Allow-Credentials would let
  // any site read responses made with the visitor's cookies.
  if (env.ALLOWED_ORIGIN === '*') {
    headers.set('Access-Control-Allow-Origin', '*')
  } else {
    const allowed = resolveAllowedOrigin(origin, [env.ALLOWED_ORIGIN, 'https://api.clex.in'].join(','))
    if (!allowed) return
    headers.set('Access-Control-Allow-Origin', allowed)
    headers.set('Access-Control-Allow-Credentials', 'true')
    headers.set('Vary', 'Origin')
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Clex-Admin')
  headers.set('Access-Control-Max-Age', '600')
}
