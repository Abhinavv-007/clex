import { describe, expect, it } from 'vitest'

import { isFinalStatus, shouldAdvanceStatus, statusRank, statusesBelow } from './types'

describe('chain status precedence', () => {
  it('ranks the lifecycle in order', () => {
    expect(statusRank('registered')).toBeLessThan(statusRank('waiting_peer'))
    expect(statusRank('waiting_peer')).toBeLessThan(statusRank('connecting'))
    expect(statusRank('connecting')).toBeLessThan(statusRank('transferring'))
    expect(statusRank('transferring')).toBeLessThan(statusRank('completed'))
  })

  it('treats all terminal states as the same top rank', () => {
    expect(statusRank('completed')).toBe(statusRank('failed'))
    expect(statusRank('completed')).toBe(statusRank('cancelled'))
    expect(statusRank('completed')).toBe(statusRank('abandoned'))
  })

  it('lets statuses move forward', () => {
    expect(shouldAdvanceStatus('connecting', 'transferring')).toBe(true)
    expect(shouldAdvanceStatus('transferring', 'completed')).toBe(true)
    expect(shouldAdvanceStatus('registered', 'waiting_peer')).toBe(true)
  })

  it('refuses to regress to an earlier status (the receiver-hash bug fix)', () => {
    // A late "connecting" event arriving after "completed" must not roll back.
    expect(shouldAdvanceStatus('completed', 'connecting')).toBe(false)
    expect(shouldAdvanceStatus('transferring', 'connecting')).toBe(false)
    expect(shouldAdvanceStatus('connecting', 'waiting_peer')).toBe(false)
  })

  it('locks terminal states (sticky)', () => {
    expect(shouldAdvanceStatus('completed', 'failed')).toBe(false)
    expect(shouldAdvanceStatus('failed', 'completed')).toBe(false)
    expect(shouldAdvanceStatus('cancelled', 'transferring')).toBe(false)
    expect(isFinalStatus('completed')).toBe(true)
    expect(isFinalStatus('connecting')).toBe(false)
  })

  it('treats identical consecutive statuses as no-advance (dedupe)', () => {
    expect(shouldAdvanceStatus('connecting', 'connecting')).toBe(false)
    expect(shouldAdvanceStatus('completed', 'completed')).toBe(false)
  })
})

describe('statusesBelow — atomic UPDATE guard set', () => {
  it('lists every strictly-lower-ranked status', () => {
    expect(statusesBelow('registered')).toEqual([])
    expect(statusesBelow('waiting_peer')).toEqual(['registered'])
    expect(statusesBelow('connecting')).toEqual(['registered', 'waiting_peer'])
    expect(statusesBelow('transferring')).toEqual(['registered', 'waiting_peer', 'connecting'])
  })

  it('lets terminal statuses advance from any non-terminal status', () => {
    const expected = ['registered', 'waiting_peer', 'connecting', 'transferring']
    expect(statusesBelow('completed')).toEqual(expected)
    expect(statusesBelow('failed')).toEqual(expected)
    expect(statusesBelow('cancelled')).toEqual(expected)
    expect(statusesBelow('abandoned')).toEqual(expected)
  })

  it('never includes a peer terminal status (sticky terminals)', () => {
    // Same rank → not strictly below, so an "abandoned" cannot replace a
    // "completed" via this guard set.
    expect(statusesBelow('completed')).not.toContain('failed')
    expect(statusesBelow('failed')).not.toContain('completed')
  })
})
