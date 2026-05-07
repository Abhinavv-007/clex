import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

/** One-time token pickup endpoint.
 *  Reads the gdrive_token_once httpOnly cookie, deletes it immediately, returns the token.
 *  The 2-minute maxAge on the cookie prevents stale pickups.
 */
export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get('gdrive_token_once')

  // Consume immediately — single-use
  if (token) {
    cookies.delete('gdrive_token_once', { path: '/api/auth/gdrive/token' })
    return json({ token })
  }

  return json({ token: null })
}
