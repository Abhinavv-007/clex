const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion

export function generateRoomCode(length = 6): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => CHARSET[byte % CHARSET.length]).join('')
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/i.test(code)
}
