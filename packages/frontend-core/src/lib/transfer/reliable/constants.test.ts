import { describe, expect, it } from 'vitest'

import {
  ACK_TIMEOUT_MS,
  BUFFERED_AMOUNT_HIGH_WATER,
  BUFFERED_AMOUNT_LOW_WATER,
  CHUNK_SIZE,
  MAX_IN_FLIGHT_CHUNKS,
  RELIABLE_CHUNK_HEADER_BYTES,
  RETRY_BACKOFF_FACTOR,
  RETRY_BACKOFF_MS,
  RETRY_INITIAL_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  UI_UPDATE_INTERVAL_MS,
} from '../types'

describe('reliable transfer constants', () => {
  it('uses a chunk size that stays safely below browser datachannel message limits', () => {
    // The reliable frame adds a header to the payload. Keeping the payload at
    // 64 KB avoids the generic DataChannel errors seen when a 256 KB payload
    // plus framing crosses browser or network SCTP message limits.
    expect(CHUNK_SIZE).toBe(64 * 1024)
    expect(CHUNK_SIZE + RELIABLE_CHUNK_HEADER_BYTES).toBeLessThanOrEqual(64 * 1024 + 64)
  })

  it('lets the low watermark sit comfortably below the high watermark', () => {
    expect(BUFFERED_AMOUNT_LOW_WATER).toBeLessThan(BUFFERED_AMOUNT_HIGH_WATER)
    // The drain gap must be at least one chunk wide, otherwise the bufferedamountlow
    // event fires immediately after every send and we degrade to per-chunk pacing.
    expect(BUFFERED_AMOUNT_HIGH_WATER - BUFFERED_AMOUNT_LOW_WATER).toBeGreaterThanOrEqual(CHUNK_SIZE * 4)
  })

  it('caps in-flight chunks high enough to amortize ACK latency', () => {
    expect(MAX_IN_FLIGHT_CHUNKS).toBeGreaterThanOrEqual(8)
    // Sanity ceiling — past ~64 we'd push DataChannel queues hard with no benefit.
    expect(MAX_IN_FLIGHT_CHUNKS).toBeLessThanOrEqual(64)
  })

  it('throttles UI updates to a value that reads as smooth but does not churn the store', () => {
    // 60 fps is 16.7 ms — we don't need to update the store any faster than
    // ~150 ms because formatBytes/formatSpeed don't change visibly faster.
    expect(UI_UPDATE_INTERVAL_MS).toBeGreaterThanOrEqual(60)
    expect(UI_UPDATE_INTERVAL_MS).toBeLessThanOrEqual(500)
  })

  it('exposes ACK + retry knobs that match the protocol prose', () => {
    expect(RETRY_MAX_ATTEMPTS).toBe(4)
    expect(RETRY_BACKOFF_MS).toBe(RETRY_INITIAL_DELAY_MS)
    expect(RETRY_BACKOFF_FACTOR).toBeGreaterThan(1)
    expect(ACK_TIMEOUT_MS).toBeGreaterThanOrEqual(2000)
  })
})
