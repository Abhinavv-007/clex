import { redirect } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, cookies }) => {
  const clientId = env.GOOGLE_CLIENT_ID
  const redirectUri = env.GOOGLE_REDIRECT_URI
  const scope = env.GOOGLE_DRIVE_SCOPE ?? 'https://www.googleapis.com/auth/drive.file'

  if (!clientId || !redirectUri) {
    return new Response('Google OAuth not configured', { status: 503 })
  }

  // Generate CSRF state token and store in a short-lived cookie
  const state = crypto.randomUUID()
  cookies.set('gdrive_state', state, {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'online') // no refresh token needed
  authUrl.searchParams.set('prompt', 'consent')

  throw redirect(302, authUrl.toString())
}
