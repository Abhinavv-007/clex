import {
  appendCors,
  buildFrontendRedirect,
  getGoogleOAuthConfigStatus,
  json,
  parseCookies,
  serializeCookie,
  type Env,
} from './googleAuth'

const TOKEN_PICKUP_PATH = '/api/auth/gdrive/token'
const STATE_COOKIE = 'gdrive_state'
const TOKEN_COOKIE = 'gdrive_token_once'
const RETURN_TO_COOKIE = 'gdrive_return_to'

function redirect(url: string, headers?: HeadersInit): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...headers,
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      const headers = new Headers()
      appendCors(headers, request, env)
      return new Response(null, { status: 204, headers })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (url.pathname === '/api/auth/google/status') {
      const headers = new Headers()
      appendCors(headers, request, env)
      return json(getGoogleOAuthConfigStatus(env), { headers })
    }

    if (url.pathname === '/api/auth/google') {
      const returnTo = url.searchParams.get('return_to')
      const config = getGoogleOAuthConfigStatus(env)
      if (!config.configured) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'oauth_not_configured' })))
      }

      const state = crypto.randomUUID()
      const secure = url.protocol === 'https:'

      const headers = new Headers()
      headers.append('Set-Cookie', serializeCookie(STATE_COOKIE, state, {
        path: '/',
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        maxAge: 600,
      }))
      if (returnTo) {
        headers.append('Set-Cookie', serializeCookie(RETURN_TO_COOKIE, returnTo, {
          path: '/',
          httpOnly: true,
          secure,
          sameSite: 'Lax',
          maxAge: 600,
        }))
      }

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID ?? '')
      authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI ?? '')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', env.GOOGLE_DRIVE_SCOPE ?? 'https://www.googleapis.com/auth/drive.file')
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('access_type', 'online')

      return redirect(authUrl.toString(), headers)
    }

    if (url.pathname === '/api/auth/google/callback') {
      const cookies = parseCookies(request)
      const secure = url.protocol === 'https:'
      const state = url.searchParams.get('state')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const storedState = cookies.get(STATE_COOKIE) ?? null
      const returnTo = cookies.get(RETURN_TO_COOKIE) ?? null

      const headers = new Headers()
      headers.append('Set-Cookie', serializeCookie(STATE_COOKIE, '', { path: '/', httpOnly: true, secure, sameSite: 'Lax', maxAge: 0 }))
      headers.append('Set-Cookie', serializeCookie(RETURN_TO_COOKIE, '', { path: '/', httpOnly: true, secure, sameSite: 'Lax', maxAge: 0 }))

      if (error) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'oauth_denied' })), headers)
      }

      if (!storedState || state !== storedState) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'state_mismatch' })), headers)
      }

      if (!code) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'no_code' })), headers)
      }

      const config = getGoogleOAuthConfigStatus(env)
      if (!config.configured) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'oauth_not_configured' })), headers)
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID ?? '',
          client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
          redirect_uri: env.GOOGLE_REDIRECT_URI ?? '',
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'token_exchange_failed' })), headers)
      }

      const tokenData = (await tokenResponse.json()) as { access_token?: string }
      if (!tokenData.access_token) {
        return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'no_access_token' })), headers)
      }

      headers.append('Set-Cookie', serializeCookie(TOKEN_COOKIE, tokenData.access_token, {
        path: TOKEN_PICKUP_PATH,
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        maxAge: 120,
      }))

      return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ gdrive: 'connected' })), headers)
    }

    if (url.pathname === TOKEN_PICKUP_PATH) {
      const cookies = parseCookies(request)
      const secure = url.protocol === 'https:'
      const token = cookies.get(TOKEN_COOKIE) ?? null
      const headers = new Headers()
      appendCors(headers, request, env)

      if (token) {
        headers.append('Set-Cookie', serializeCookie(TOKEN_COOKIE, '', {
          path: TOKEN_PICKUP_PATH,
          httpOnly: true,
          secure,
          sameSite: 'Lax',
          maxAge: 0,
        }))
      }

      return json({ token }, { headers })
    }

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
