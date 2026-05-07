import { describe, expect, it } from 'vitest'

import { normalizeRequestedMode, planJoin } from './room-session'

describe('room-session', () => {
  it('makes the room ready when sender joins first and receiver joins second', () => {
    const senderJoin = planJoin({ sender: 0, receiver: 0 }, 'sender', 'local', null)
    expect(senderJoin).toEqual({
      ok: true,
      mode: 'local',
      roomReady: false,
      becameReady: false,
    })

    const receiverJoin = planJoin({ sender: 1, receiver: 0 }, 'receiver', null, 'local')
    expect(receiverJoin).toEqual({
      ok: true,
      mode: 'local',
      roomReady: true,
      becameReady: true,
    })
  })

  it('makes the room ready when receiver joins first and sender joins second', () => {
    const receiverJoin = planJoin({ sender: 0, receiver: 0 }, 'receiver', 'webrtc', null)
    expect(receiverJoin).toEqual({
      ok: true,
      mode: 'webrtc',
      roomReady: false,
      becameReady: false,
    })

    const senderJoin = planJoin({ sender: 0, receiver: 1 }, 'sender', null, 'webrtc')
    expect(senderJoin).toEqual({
      ok: true,
      mode: 'webrtc',
      roomReady: true,
      becameReady: true,
    })
  })

  it('rejects duplicate joins for the same role', () => {
    expect(planJoin({ sender: 1, receiver: 0 }, 'sender', null, 'webrtc')).toEqual({
      ok: false,
      code: 'ROOM_FULL',
    })

    expect(planJoin({ sender: 0, receiver: 1 }, 'receiver', null, 'webrtc')).toEqual({
      ok: false,
      code: 'ROOM_FULL',
    })
  })

  it('normalizes only supported room modes', () => {
    expect(normalizeRequestedMode('local')).toBe('local')
    expect(normalizeRequestedMode('webrtc')).toBe('webrtc')
    expect(normalizeRequestedMode('')).toBeNull()
    expect(normalizeRequestedMode('drive')).toBeNull()
  })
})
