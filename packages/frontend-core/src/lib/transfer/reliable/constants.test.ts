import { describe, expect, it } from 'vitest'

import {
  ACK_TIMEOUT_MS,
  BUFFERED_AMOUNT_HIGH_WATER,
  BUFFERED_AMOUNT_LOW_WATER,
  CHUNK_SIZE,
  MAX_IN_FLIGHT_BYTES,
  MAX_IN_FLIGHT_CHUNKS,
  SEND_READAHEAD_CHUNKS,
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

  it('sizes the in-flight window in bytes so it survives a chunk-size change', () => {
    // The window is the amount of data allowed to be unacknowledged, which is
    // a property of the link, not of the framing. Asserting a chunk count
    // instead couples this to CHUNK_SIZE: the previous ceiling of 64 chunks
    // meant 16 MB at the old 256 KB chunk and 4 MB at the current 64 KB one,
    // and it started failing the moment the chunk size was halved.
    expect(MAX_IN_FLIGHT_BYTES).toBeGreaterThanOrEqual(2 * 1024 * 1024)
    expect(MAX_IN_FLIGHT_BYTES).toBeLessThanOrEqual(32 * 1024 * 1024)

    // Enough chunks to keep the pipe full across one ACK round trip...
    expect(MAX_IN_FLIGHT_CHUNKS).toBeGreaterThanOrEqual(8)
    // ...and the count still follows from the byte budget.
    expect(MAX_IN_FLIGHT_CHUNKS).toBe(Math.ceil(MAX_IN_FLIGHT_BYTES / CHUNK_SIZE))
  })

  it('reads ahead far enough to hide file-read latency behind the wire', () => {
    // Each chunk costs an async Blob read. Reading them strictly one at a time
    // makes throughput a function of that latency rather than of the link.
    expect(SEND_READAHEAD_CHUNKS).toBeGreaterThanOrEqual(2)
    // But the read-ahead buffer is held in memory, so it must stay well inside
    // the in-flight window.
    expect(SEND_READAHEAD_CHUNKS * CHUNK_SIZE).toBeLessThanOrEqual(MAX_IN_FLIGHT_BYTES)
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
