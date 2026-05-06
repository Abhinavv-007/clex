import { describe, expect, it } from 'vitest'

import {
  decodeChunkFrame,
  encodeChunkFrame,
  frameFlags,
  negotiateCapabilities,
  safeParseControl,
} from './protocol'
import { DEFAULT_RELIABLE_CAPS, RELIABLE_CHUNK_FLAG_LAST, RELIABLE_CHUNK_FLAG_RETRANSMIT } from '../types'

describe('chunk frame encoding', () => {
  it('round-trips a payload with header fields intact', () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]).buffer
    const encoded = encodeChunkFrame({
      fileIndex: 7,
      chunkIndex: 42,
      chunkLength: payload.byteLength,
      flags: frameFlags({ retransmit: true, last: true }),
      payload,
    })
    const decoded = decodeChunkFrame(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.fileIndex).toBe(7)
    expect(decoded!.chunkIndex).toBe(42)
    expect(decoded!.chunkLength).toBe(5)
    expect(decoded!.flags & RELIABLE_CHUNK_FLAG_RETRANSMIT).toBeTruthy()
    expect(decoded!.flags & RELIABLE_CHUNK_FLAG_LAST).toBeTruthy()
    expect(new Uint8Array(decoded!.payload)).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  it('returns null when the buffer is shorter than the header', () => {
    expect(decodeChunkFrame(new ArrayBuffer(8))).toBeNull()
  })

  it('returns null when chunkLength does not match the trailer length', () => {
    const payload = new Uint8Array([1, 2, 3]).buffer
    const encoded = encodeChunkFrame({ fileIndex: 0, chunkIndex: 0, chunkLength: 99, flags: 0, payload })
    expect(decodeChunkFrame(encoded)).toBeNull()
  })
})

describe('capability negotiation', () => {
  it('returns null when the peer never sends capabilities', () => {
    expect(negotiateCapabilities(DEFAULT_RELIABLE_CAPS, null)).toBeNull()
  })

  it('takes the minimum protocol version and ANDs feature flags', () => {
    const local = { ...DEFAULT_RELIABLE_CAPS }
    const remote = { ...DEFAULT_RELIABLE_CAPS, version: 0, supportsChunkHash: false }
    const result = negotiateCapabilities(local, remote)
    expect(result).not.toBeNull()
    expect(result!.version).toBe(0)
    expect(result!.supportsChunkHash).toBe(false)
    expect(result!.supportsChunkAck).toBe(true)
  })
})

describe('safeParseControl', () => {
  it('parses well-formed control messages', () => {
    expect(safeParseControl(JSON.stringify({ type: 'pause', transferId: 't', by: 'sender' })))
      .toEqual({ type: 'pause', transferId: 't', by: 'sender' })
  })

  it('returns null for invalid JSON or missing type', () => {
    expect(safeParseControl('not-json')).toBeNull()
    expect(safeParseControl('{"foo":1}')).toBeNull()
  })
})
