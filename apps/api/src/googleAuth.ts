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
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Vary', 'Origin')
}

export function buildFrontendRedirect(
  request: Request,
  env: Env,
  returnTo: string | null,
  params: URLSearchParams
): string {
  const fallback = env.FRONTEND_BASE_URL?.trim() || new URL(request.url).origin
  const base = sanitizeReturnTo(returnTo) ?? fallback
  const url = new URL('/workspace', base)
  url.search = params.toString()
  return url.toString()
}

function sanitizeReturnTo(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return null
  }
}
