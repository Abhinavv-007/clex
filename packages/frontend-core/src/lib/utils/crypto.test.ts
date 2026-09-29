import { describe, expect, it } from 'vitest'
import { generateRoomCode, isValidRoomCode, parseRoomCode, routeLetter, shareCode } from './crypto'

describe('room codes', () => {
  it('makes five random characters, without the easily confused ones', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/)
    }
  })

  it('leads the shared code with the route: D for Direct, L for Local', () => {
    expect(routeLetter('webrtc')).toBe('D')
    expect(routeLetter('local')).toBe('L')
    expect(shareCode('QLTDT', 'webrtc')).toBe('DQLTDT')
    expect(shareCode('QLTDT', 'local')).toBe('LQLTDT')
  })

  it('reads the route back from what the receiver types', () => {
    expect(parseRoomCode('DQLTDT')).toEqual({ room: 'DQLTDT', mode: 'webrtc' })
    expect(parseRoomCode('lqltdt')).toEqual({ room: 'LQLTDT', mode: 'local' })
    expect(parseRoomCode(' D-QLTDT ')).toEqual({ room: 'DQLTDT', mode: 'webrtc' })
  })

  it('still takes a code with no route letter, and lets the server say the route', () => {
    expect(parseRoomCode('46NKSC')).toEqual({ room: '46NKSC', mode: null })
  })

  it('rejects anything that is not a whole code', () => {
    expect(parseRoomCode('DQLT')).toBeNull()
    expect(parseRoomCode('DQLTDTX')).toBeNull()
    expect(isValidRoomCode('')).toBe(false)
    expect(isValidRoomCode('DQLTDT')).toBe(true)
  })
})
