const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion

/** The five random characters of a code; the route letter goes in front. */
export function generateRoomCode(length = 5): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => CHARSET[byte % CHARSET.length]).join('')
}

// ── Route letter ────────────────────────────────────────────────────────────
//
// Only the sender chooses between Direct and Local. The code they share leads
// with that choice — DQLTDT is Direct, LQLTDT is Local — so the receiver never
// picks: typing the code tells their browser how to connect before it even
// reaches the server, and the signaling server confirms it (the sender's
// route always wins there). The whole six characters are the room, so a code
// from an older sender or the Android app, which has no letter, still works.

export type RouteLetter = 'D' | 'L'
export type RouteMode = 'webrtc' | 'local'

export function routeLetter(mode: RouteMode): RouteLetter {
  return mode === 'local' ? 'L' : 'D'
}

/** The code as the sender shares it, and the room it names: letter + five. */
export function shareCode(random: string, mode: RouteMode): string {
  return `${routeLetter(mode)}${random}`
}

export interface ParsedCode {
  /** The six character signaling room: the whole code. */
  room: string
  /** The sender's route when the code leads with D or L; null otherwise. */
  mode: RouteMode | null
}

/**
 * Reads what a receiver typed or scanned: `DQLTDT`, `d-qltdt`, `D QLTDT`.
 * Returns null unless it is a whole code.
 */
export function parseRoomCode(input: string): ParsedCode | null {
  const clean = input.replace(/[\s·\-_.]/g, '').toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(clean)) return null
  const mode = clean[0] === 'D' ? 'webrtc' : clean[0] === 'L' ? 'local' : null
  return { room: clean, mode }
}

export function isValidRoomCode(code: string): boolean {
  return parseRoomCode(code) !== null
}
