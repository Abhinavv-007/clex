/**
 * LoginThrottle — one Durable Object per client address (by hash), counting
 * admin sign-in attempts.
 *
 * KV cannot do this: a read-increment-write there loses updates when guesses
 * arrive in parallel, and it is eventually consistent across locations, so a
 * burst of concurrent guesses could slip past any limit. A Durable Object is
 * a single instance, and every operation below runs inside
 * blockConcurrencyWhile, so attempts are counted strictly one after another.
 *
 * An attempt reserves its slot BEFORE the secret or passkey is checked
 * (`/attempt`). Checking first and counting afterwards would let N parallel
 * requests all pass the check before any of them was counted.
 *
 *   POST /peek     current state, counts nothing
 *   POST /attempt  take a slot if one is free; refused once the window is used up
 *   POST /clear    a successful sign-in resets the address
 *
 * Every reply is { allowed, attempts, retryAfter }.
 */

export const LOGIN_MAX_ATTEMPTS = 8
export const LOGIN_WINDOW_SECONDS = 15 * 60

interface Window {
  attempts: number
  first_at: number
}

export interface ThrottleReply {
  allowed: boolean
  attempts: number
  retryAfter: number
}

/** The decision, separated from storage so it is easy to reason about and test. */
export function decide(
  current: Window | null,
  op: 'peek' | 'attempt' | 'clear',
  now: number,
): { next: Window | null; reply: ThrottleReply } {
  let win = current && current.first_at + LOGIN_WINDOW_SECONDS > now ? current : null
  if (op === 'clear') return { next: null, reply: { allowed: true, attempts: 0, retryAfter: 0 } }

  const used = win?.attempts ?? 0
  const retryAfter = win ? Math.max(1, win.first_at + LOGIN_WINDOW_SECONDS - now) : 0
  if (used >= LOGIN_MAX_ATTEMPTS) {
    return { next: win, reply: { allowed: false, attempts: used, retryAfter } }
  }
  if (op === 'peek') return { next: win, reply: { allowed: true, attempts: used, retryAfter: 0 } }

  win = win ? { ...win, attempts: used + 1 } : { attempts: 1, first_at: now }
  return { next: win, reply: { allowed: true, attempts: win.attempts, retryAfter: 0 } }
}

export class LoginThrottle implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const op = new URL(request.url).pathname.slice(1)
    if (op !== 'peek' && op !== 'attempt' && op !== 'clear') {
      return new Response('Not found', { status: 404 })
    }

    const reply = await this.state.blockConcurrencyWhile(async () => {
      const now = Math.floor(Date.now() / 1000)
      const current = (await this.state.storage.get<Window>('w')) ?? null
      const { next, reply } = decide(current, op, now)
      if (next) {
        await this.state.storage.put('w', next)
        // Clean up after the window, so idle addresses keep no state.
        await this.state.storage.setAlarm((next.first_at + LOGIN_WINDOW_SECONDS) * 1000)
      } else if (current) {
        await this.state.storage.deleteAll()
      }
      return reply
    })

    return Response.json(reply)
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll()
  }
}
