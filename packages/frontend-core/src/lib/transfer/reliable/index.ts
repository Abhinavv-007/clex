export {
  buildManifest,
  bufToHex,
  chunkRange,
  computeChunkCount,
  digestSha256,
  generateTransferId,
  manifestToHumanLabel,
} from './manifest'
export type { BuildManifestOptions } from './manifest'

export { ChunkTracker } from './chunkTracker'
export type {
  ChunkRecord,
  ChunkStatus,
  ChunkTrackerOptions,
  ChunkTrackerSnapshot,
} from './chunkTracker'

export { computeHealthScore, healthLabelText } from './health'
export type { HealthInputs } from './health'

export { buildReceipt, receiptToChainMeta } from './receipt'
export type { BuildReceiptInputs } from './receipt'

export { transferQueueStore } from './queue'
export type { TransferQueueStore } from './queue'

export {
  buildCapabilityMessage,
  decodeChunkFrame,
  encodeChunkFrame,
  frameFlags,
  isControlMessage,
  negotiateCapabilities,
  safeParseControl,
} from './protocol'
