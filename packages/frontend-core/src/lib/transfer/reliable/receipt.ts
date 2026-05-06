import type { TransferHealth, TransferManifest, TransferReceipt } from '../types'

export interface BuildReceiptInputs {
  manifest: TransferManifest
  health: TransferHealth
  startedAt: number
  completedAt: number
  route: string
  retryCount: number
  failedChunkCount: number
  verified: boolean
  rootHash?: string
}

const RECEIPT_REVISION = 1

/**
 * Builds a privacy-preserving local receipt object for a completed transfer.
 *
 * The receipt deliberately omits filenames and any per-file payload so it can
 * also be safely surfaced to the optional Chain `meta` channel. Filenames live
 * in the manifest only; receipts are content-free metadata.
 */
export function buildReceipt(inputs: BuildReceiptInputs): TransferReceipt {
  const { manifest } = inputs
  const completedAt = Math.max(inputs.completedAt, inputs.startedAt)
  return {
    transferId: manifest.transferId,
    totalSize: manifest.totalSize,
    totalChunks: manifest.totalChunks,
    chunkSize: manifest.chunkSize,
    fileCount: manifest.files.length,
    verified: inputs.verified,
    startedAt: inputs.startedAt,
    completedAt,
    durationMs: completedAt - inputs.startedAt,
    route: inputs.route,
    retryCount: inputs.retryCount,
    failedChunkCount: inputs.failedChunkCount,
    rootHash: inputs.rootHash ?? manifest.rootHash,
    healthScore: inputs.health.score,
    rev: RECEIPT_REVISION,
  }
}

/**
 * The Chain worker accepts an optional `meta` field that's forward-compatible
 * with older deployments (which silently drop it). We strip everything that
 * could leak filenames or content even though the receipt already omits them,
 * to keep the privacy boundary explicit.
 */
export function receiptToChainMeta(receipt: TransferReceipt): Record<string, unknown> {
  return {
    transfer_id: receipt.transferId,
    verified: receipt.verified,
    chunk_count: receipt.totalChunks,
    chunk_size: receipt.chunkSize,
    retry_count: receipt.retryCount,
    failed_chunk_count: receipt.failedChunkCount,
    duration_ms: receipt.durationMs,
    completed_at: receipt.completedAt,
    health_score: receipt.healthScore,
    proof_root_hash: receipt.rootHash ?? null,
    rev: receipt.rev,
  }
}
