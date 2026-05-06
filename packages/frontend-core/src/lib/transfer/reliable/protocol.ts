import {
  DEFAULT_RELIABLE_CAPS,
  RELIABLE_CHUNK_FLAG_LAST,
  RELIABLE_CHUNK_FLAG_RETRANSMIT,
  RELIABLE_CHUNK_HEADER_BYTES,
  type DCControlMessage,
  type ReliableCapabilities,
  type ReliableChunkFrame,
} from '../types'

/**
 * The reliable protocol pieces that are pure (no DOM, no I/O) — kept here so
 * tests can exercise them without spinning up a real WebRTC channel.
 */

export function buildCapabilityMessage(caps: ReliableCapabilities = DEFAULT_RELIABLE_CAPS): DCControlMessage {
  return { type: 'capability', caps }
}

export function negotiateCapabilities(
  local: ReliableCapabilities,
  remote: ReliableCapabilities | null
): ReliableCapabilities | null {
  if (!remote) return null
  if (!remote.reliable || !local.reliable) return null
  return {
    reliable: true,
    version: Math.min(local.version, remote.version),
    supportsChunkAck: local.supportsChunkAck && remote.supportsChunkAck,
    supportsResume: local.supportsResume && remote.supportsResume,
    supportsChunkHash: local.supportsChunkHash && remote.supportsChunkHash,
    supportsTransferReceipt: local.supportsTransferReceipt && remote.supportsTransferReceipt,
    supportsTransferQueue: local.supportsTransferQueue && remote.supportsTransferQueue,
  }
}

export function encodeChunkFrame(frame: ReliableChunkFrame): ArrayBuffer {
  const out = new ArrayBuffer(RELIABLE_CHUNK_HEADER_BYTES + frame.payload.byteLength)
  const view = new DataView(out)
  view.setUint32(0, frame.fileIndex >>> 0, true)
  view.setUint32(4, frame.chunkIndex >>> 0, true)
  view.setUint32(8, frame.chunkLength >>> 0, true)
  view.setUint32(12, frame.flags >>> 0, true)
  new Uint8Array(out, RELIABLE_CHUNK_HEADER_BYTES).set(new Uint8Array(frame.payload))
  return out
}

export function decodeChunkFrame(buffer: ArrayBuffer): ReliableChunkFrame | null {
  if (buffer.byteLength < RELIABLE_CHUNK_HEADER_BYTES) return null
  const view = new DataView(buffer)
  const fileIndex = view.getUint32(0, true)
  const chunkIndex = view.getUint32(4, true)
  const chunkLength = view.getUint32(8, true)
  const flags = view.getUint32(12, true)
  if (RELIABLE_CHUNK_HEADER_BYTES + chunkLength !== buffer.byteLength) return null

  // .slice() returns an ArrayBuffer view that doesn't share memory with the
  // original — important because the WebRTC stack reuses message buffers.
  const payload = buffer.slice(RELIABLE_CHUNK_HEADER_BYTES, RELIABLE_CHUNK_HEADER_BYTES + chunkLength)
  return { fileIndex, chunkIndex, chunkLength, flags, payload }
}

export function frameFlags(opts: { retransmit?: boolean; last?: boolean }): number {
  let flags = 0
  if (opts.retransmit) flags |= RELIABLE_CHUNK_FLAG_RETRANSMIT
  if (opts.last) flags |= RELIABLE_CHUNK_FLAG_LAST
  return flags
}

export function isControlMessage(data: unknown): data is string {
  return typeof data === 'string'
}

export function safeParseControl(payload: string): DCControlMessage | null {
  try {
    const parsed = JSON.parse(payload)
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed as DCControlMessage
    }
    return null
  } catch {
    return null
  }
}
