import { describe, expect, it } from 'vitest'

import { isFinalStatus, shouldAdvanceStatus, statusRank } from './types'

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
