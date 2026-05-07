import { describe, expect, it } from 'vitest'

import { computeHealthScore, healthLabelText, type HealthInputs } from './health'

function inputs(overrides: Partial<HealthInputs> = {}): HealthInputs {
  return {
    totalChunks: 100,
    ackedChunks: 50,
    verifiedChunks: 50,
    retries: 0,
    failedChunks: 0,
    bufferedAmount: 0,
    bufferedHigh: false,
    averageSpeedBps: 1024 * 1024,
    connectionKind: 'lan',
    connectionStable: true,
    paused: false,
    state: 'transferring',
    ...overrides,
  }
}

describe('computeHealthScore', () => {
  it('returns a high score when everything is stable', () => {
    const h = computeHealthScore(inputs())
    expect(h.score).toBeGreaterThanOrEqual(95)
    expect(h.label).toBe('stable')
  })

  it('drops score and label when retries appear', () => {
    const h = computeHealthScore(inputs({ retries: 2 }))
    expect(h.score).toBeLessThan(100)
    expect(h.label).toBe('recovering')
  })

  it('marks unstable when chunks have failed', () => {
    const h = computeHealthScore(inputs({ failedChunks: 2 }))
    expect(h.score).toBeLessThan(80)
    expect(h.label).toBe('unstable')
  })

  it('marks reconnecting when the connection is unstable mid-transfer', () => {
    const h = computeHealthScore(inputs({ connectionStable: false }))
    expect(h.score).toBeLessThan(80)
    expect(h.label).toBe('reconnecting')
  })

  it('returns verified for completed transfers with full verification', () => {
    const h = computeHealthScore(inputs({
      state: 'complete',
      ackedChunks: 100,
      verifiedChunks: 100,
    }))
    expect(h.score).toBe(100)
    expect(h.label).toBe('verified')
  })

  it('returns failed score for failed transfers', () => {
    const h = computeHealthScore(inputs({ state: 'failed' }))
    expect(h.score).toBe(0)
    expect(h.label).toBe('failed')
  })

  it('clamps score to [0, 100]', () => {
    const veryBad = computeHealthScore(inputs({
      retries: 100,
      failedChunks: 100,
      connectionStable: false,
      bufferedHigh: true,
      averageSpeedBps: 0,
    }))
    expect(veryBad.score).toBe(0)
  })

  it('exposes label text for UI', () => {
    expect(healthLabelText('verified')).toMatch(/verified/i)
    expect(healthLabelText('reconnecting')).toMatch(/reconnect|connection/i)
  })
})
