import { redirect } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { getGoogleOAuthConfigStatus } from '$lib/server/googleAuth'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // OAuth denied
  if (error) {
    throw redirect(302, '/workspace?error=oauth_denied')
  }

  // CSRF check
  const storedState = cookies.get('gdrive_state')
  cookies.delete('gdrive_state', { path: '/' })

  if (!storedState || state !== storedState) {
    throw redirect(302, '/workspace?error=state_mismatch')
  }

  if (!code) {
    throw redirect(302, '/workspace?error=no_code')
  }

  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET
  const redirectUri = env.GOOGLE_REDIRECT_URI
  const config = getGoogleOAuthConfigStatus(env)

  if (!config.configured) {
    throw redirect(302, '/workspace?error=oauth_not_configured')
  }

  // Exchange authorization code for access token
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResp.ok) {
    const body = await tokenResp.text()
    console.error('Token exchange failed:', body)
    throw redirect(302, '/workspace?error=token_exchange_failed')
  }

  const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string }

  if (!tokenData.access_token) {
    throw redirect(302, '/workspace?error=no_access_token')
  }

  // Store token in a short-lived httpOnly cookie; client picks it up via /api/auth/gdrive/token
  // This keeps the access token out of browser history and referrer headers
  cookies.set('gdrive_token_once', tokenData.access_token, {
    path: '/api/auth/gdrive/token',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 120, // 2-minute window to pick it up
  })

  throw redirect(302, '/workspace?gdrive=connected')
}
