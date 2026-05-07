import { json, type RequestHandler } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { getGoogleOAuthConfigStatus } from '$lib/server/googleAuth'

export const GET: RequestHandler = async () => {
  return json(getGoogleOAuthConfigStatus(env))
}
