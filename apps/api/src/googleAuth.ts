export interface GoogleOAuthConfigStatus {
  configured: boolean
  missing: string[]
}

export interface Env {
  ALLOWED_ORIGIN: string
  FRONTEND_BASE_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_REDIRECT_URI?: string
  GOOGLE_DRIVE_SCOPE?: string
  OAUTH_TOKEN_ENCRYPTION_SECRET?: string
  DRIVE_SESSION_STORE: KVNamespace
  /**
   * Server-side admin secret consumed by /api/admin/* and forwarded by
   * lnch.in's `CLEX_ADMIN_SECRET` proxy. Falls back to `ADMIN_SECRET` for
   * backward-compat with any pre-existing wrangler config.
   */
  CLEX_ADMIN_SECRET?: string
  ADMIN_SECRET?: string
}

export function getGoogleOAuthConfigStatus(source: Env): GoogleOAuthConfigStatus {
  const missing: string[] = []

  if (!hasConfiguredValue(source.GOOGLE_CLIENT_ID)) missing.push('GOOGLE_CLIENT_ID')
  if (!hasConfiguredValue(source.GOOGLE_CLIENT_SECRET)) missing.push('GOOGLE_CLIENT_SECRET')
  if (!hasConfiguredValue(source.GOOGLE_REDIRECT_URI)) missing.push('GOOGLE_REDIRECT_URI')

  return {
    configured: missing.length === 0,
    missing,
  }
}

function hasConfiguredValue(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim()
  if (!normalized) return false
  return !/^your_[a-z0-9_]+$/i.test(normalized)
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

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function parseCookies(request: Request): Map<string, string> {
  const header = request.headers.get('Cookie') ?? ''
  const result = new Map<string, string>()

  header.split(';').forEach(part => {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName) return
    result.set(rawName, decodeURIComponent(rawValue.join('=')))
  })

  return result
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    path?: string
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
    maxAge?: number
  } = {}
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`]

  segments.push(`Path=${options.path ?? '/'}`)
  if (options.httpOnly) segments.push('HttpOnly')
  if (options.secure) segments.push('Secure')
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`)
  if (typeof options.maxAge === 'number') segments.push(`Max-Age=${options.maxAge}`)

  return segments.join('; ')
}

export function appendCors(headers: Headers, request: Request, env: Env): void {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = resolveAllowedOrigin(origin, env.ALLOWED_ORIGIN)
  if (!allowed) return

  headers.set('Access-Control-Allow-Origin', allowed)
  headers.set('Access-Control-Allow-Credentials', 'true')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Vary', 'Origin')
}

export function buildFrontendRedirect(
  request: Request,
  env: Env,
  returnTo: string | null,
  params: URLSearchParams
): string {
  const fallbackBase = env.FRONTEND_BASE_URL?.trim() || new URL(request.url).origin
  const fallback = new URL('/workspace', fallbackBase)
  const target = sanitizeReturnTo(request, env, returnTo) ?? fallback.toString()
  const url = new URL(target)

  params.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  return url.toString()
}

function sanitizeReturnTo(request: Request, env: Env, value: string | null): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    const requestOrigin = new URL(request.url).origin
    const frontendOrigin = getOptionalOrigin(env.FRONTEND_BASE_URL)
    const allowedOrigins = new Set<string>([
      requestOrigin,
      ...(frontendOrigin ? [frontendOrigin] : []),
    ])

    if (env.ALLOWED_ORIGIN !== '*') {
      env.ALLOWED_ORIGIN
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean)
        .forEach(origin => allowedOrigins.add(origin))
    }

    if (env.ALLOWED_ORIGIN === '*' || allowedOrigins.has(url.origin)) {
      return url.toString()
    }
  } catch {
    try {
      const fallbackBase = env.FRONTEND_BASE_URL?.trim() || new URL(request.url).origin
      const url = new URL(value, fallbackBase)
      return url.toString()
    } catch {
      return null
    }
  }

  return null
}

function getOptionalOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}
