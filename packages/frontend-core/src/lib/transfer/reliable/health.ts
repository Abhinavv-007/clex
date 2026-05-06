import type { ConnectionKind, TransferHealth } from '../types'

export interface HealthInputs {
  totalChunks: number
  ackedChunks: number
  verifiedChunks: number
  retries: number
  failedChunks: number
  bufferedAmount: number
  bufferedHigh: boolean
  averageSpeedBps: number
  connectionKind: ConnectionKind
  connectionStable: boolean
  paused: boolean
  state: 'idle' | 'preparing' | 'waiting_peer' | 'connecting' | 'transferring' | 'complete' | 'failed'
}

const LABEL_BY_STATE: Record<HealthInputs['state'], TransferHealth['label']> = {
  idle: 'idle',
  preparing: 'idle',
  waiting_peer: 'idle',
  connecting: 'recovering',
  transferring: 'stable',
  complete: 'verified',
  failed: 'failed',
}

/**
 * Compose a 0–100 health score from chunk-level signals + connection state.
 *
 * The score is intentionally simple — it's a UI hint, not a controller input.
 * Heuristics:
 *   - Failed chunks are the strongest negative signal (each = -20).
 *   - Retries trim the score progressively but never to zero alone.
 *   - LAN connections add a small bonus (less likely to drop).
 *   - Backpressure (buffered high) drops 8 points while it's active.
 */
export function computeHealthScore(inputs: HealthInputs): TransferHealth {
  if (inputs.state === 'failed') {
    return baseHealth(inputs, 0, 'failed')
  }
  if (inputs.state === 'complete') {
    const verified = inputs.totalChunks > 0 && inputs.verifiedChunks >= inputs.totalChunks
    return baseHealth(inputs, verified ? 100 : 92, verified ? 'verified' : 'stable')
  }
  if (inputs.state === 'idle' || inputs.state === 'preparing' || inputs.state === 'waiting_peer') {
    return baseHealth(inputs, 0, 'idle')
  }

  let score = 100

  if (!inputs.connectionStable) score -= 25
  if (inputs.connectionKind === 'unknown') score -= 6
  if (inputs.connectionKind === 'lan') score += 4

  // Each retry costs 4 points; failed chunk costs 20 (capped to keep score >= 0).
  score -= Math.min(40, inputs.retries * 4)
  score -= Math.min(80, inputs.failedChunks * 20)

  if (inputs.bufferedHigh) score -= 8
  if (inputs.averageSpeedBps === 0 && inputs.state === 'transferring') score -= 6
  if (inputs.paused) score -= 3 // small dock so users still see "in flight" feel

  if (score < 0) score = 0
  if (score > 100) score = 100

  let label: TransferHealth['label'] = LABEL_BY_STATE[inputs.state]
  if (inputs.failedChunks > 0) label = 'unstable'
  else if (inputs.retries > 0 && score >= 60) label = 'recovering'
  else if (inputs.retries > 0) label = 'unstable'
  else if (!inputs.connectionStable && inputs.state !== 'connecting') label = 'reconnecting'

  return baseHealth(inputs, score, label)
}

function baseHealth(
  inputs: HealthInputs,
  score: number,
  label: TransferHealth['label']
): TransferHealth {
  return {
    score,
    label,
    retries: inputs.retries,
    failedChunks: inputs.failedChunks,
    verifiedChunks: inputs.verifiedChunks,
    ackedChunks: inputs.ackedChunks,
    totalChunks: inputs.totalChunks,
    bufferedAmount: inputs.bufferedAmount,
    bufferedHigh: inputs.bufferedHigh,
    averageSpeedBps: inputs.averageSpeedBps,
    connectionStable: inputs.connectionStable,
  }
}

export function healthLabelText(label: TransferHealth['label']): string {
  switch (label) {
    case 'stable': return 'Transfer is stable'
    case 'recovering': return 'Recovering chunks…'
    case 'unstable': return 'Some chunks are retrying'
    case 'reconnecting': return 'Connection dropped — waiting to resume'
    case 'verified': return 'Transfer verified successfully'
    case 'failed': return 'Transfer failed'
    case 'idle': return 'Ready'
    default: return ''
  }
}
