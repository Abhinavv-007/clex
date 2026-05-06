export {
  clearPendingDriveReturnTo,
  clearToken,
  consumeDriveAuthError,
  disconnectGoogleDrive,
  getDriveApiBaseUrl,
  getPendingDriveReturnTo,
  getDriveSession,
  getStoredToken,
  hasToken,
  initiateGoogleAuth,
  markDriveAuthCallbackSeen,
  persistPendingDriveReturnTo,
  pickupToken,
  storeToken,
  uploadDriveBatch,
  uploadToDrive,
} from './gdrive'
export type { DriveUploadBatchResult, GoogleDriveUser, UploadResult } from './gdrive'

export {
  classifyConnectionKind,
  getConnectionKindFromStats,
  normalizeStunServerUrls,
} from './network'

export {
  getSignalingBaseUrl,
  SignalingClient,
} from './signaling'
export type {
  ClientMessage,
  ServerMessage,
  SignalingEvent,
} from './signaling'

export {
  CAPABILITY_GRACE_MS,
  CHUNK_SIZE,
  DC_LABEL,
  DEFAULT_RELIABLE_CAPS,
  RECEIVER_PROGRESS_INTERVAL_MS,
  RELIABLE_CHUNK_FLAG_LAST,
  RELIABLE_CHUNK_FLAG_RETRANSMIT,
  RELIABLE_CHUNK_HEADER_BYTES,
  RELIABLE_PROTOCOL_VERSION,
  RETRY_BACKOFF_FACTOR,
  RETRY_INITIAL_DELAY_MS,
  RETRY_MAX_ATTEMPTS,
  getRTCConfig,
} from './types'
export type {
  ConnectionKind,
  DCControlMessage,
  IceCandidatePayload,
  ManifestFileEntry,
  QueueEntry,
  QueueEntryStatus,
  ReliableCapabilities,
  ReliableChunkFrame,
  RTCConfig,
  TransferFile,
  TransferHealth,
  TransferManifest,
  TransferProfile,
  TransferReceipt,
} from './types'

export { WebRTCTransfer } from './webrtc'

// Reliable transfer module — manifests, chunk tracking, health, receipts, queue.
export {
  buildCapabilityMessage,
  buildManifest,
  buildReceipt,
  bufToHex,
  ChunkTracker,
  chunkRange,
  computeChunkCount,
  computeHealthScore,
  decodeChunkFrame,
  digestSha256,
  encodeChunkFrame,
  frameFlags,
  generateTransferId,
  healthLabelText,
  isControlMessage,
  manifestToHumanLabel,
  negotiateCapabilities,
  receiptToChainMeta,
  safeParseControl,
  transferQueueStore,
} from './reliable'
export type {
  BuildManifestOptions,
  BuildReceiptInputs,
  ChunkRecord,
  ChunkStatus,
  ChunkTrackerOptions,
  ChunkTrackerSnapshot,
  HealthInputs,
  TransferQueueStore,
} from './reliable'
