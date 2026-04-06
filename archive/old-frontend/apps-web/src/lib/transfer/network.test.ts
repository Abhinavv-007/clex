import { describe, expect, it } from 'vitest'

import { classifyConnectionKind, normalizeStunServerUrls } from './network'

describe('transfer network helpers', () => {
  it('normalizes and deduplicates configured STUN servers', () => {
    expect(
      normalizeStunServerUrls(
        ' stun:stun.l.google.com:19302 ,stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302 '
      )
    ).toEqual([
      'stun:stun.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
    ])
  })

  it('classifies host/prflx pairs as lan', () => {
    expect(
      classifyConnectionKind({
        localCandidateType: 'host',
        remoteCandidateType: 'prflx',
      })
    ).toBe('lan')
  })

  it('classifies pairs with srflx as internet', () => {
    expect(
      classifyConnectionKind({
        localCandidateType: 'host',
        remoteCandidateType: 'srflx',
      })
    ).toBe('internet')
  })

  it('falls back to unknown when candidate types are missing or unsupported', () => {
    expect(classifyConnectionKind({})).toBe('unknown')
    expect(
      classifyConnectionKind({
        localCandidateType: 'relay',
        remoteCandidateType: 'relay',
      })
    ).toBe('unknown')
  })
})
