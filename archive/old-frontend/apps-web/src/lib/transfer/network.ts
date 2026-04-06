import type { ConnectionKind } from './types'

const DEFAULT_STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
]

interface CandidateTypeSnapshot {
  localCandidateType?: string | null
  remoteCandidateType?: string | null
}

type IceCandidateStats = RTCStats & { candidateType?: string }

export function normalizeStunServerUrls(raw?: string): string[] {
  const source = raw ?? DEFAULT_STUN_SERVERS.join(',')
  const deduped = new Set<string>()

  source
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .forEach(url => deduped.add(url))

  return deduped.size > 0 ? Array.from(deduped) : [...DEFAULT_STUN_SERVERS]
}

export function classifyConnectionKind(snapshot: CandidateTypeSnapshot): ConnectionKind {
  const types = [snapshot.localCandidateType, snapshot.remoteCandidateType].filter(
    (value): value is string => Boolean(value)
  )

  if (types.length === 0) return 'unknown'
  if (types.some(type => type === 'srflx')) return 'internet'
  if (types.every(type => type === 'host' || type === 'prflx')) return 'lan'
  return 'unknown'
}

export function getConnectionKindFromStats(stats: RTCStatsReport): ConnectionKind {
  const pair = getSelectedCandidatePair(stats)
  if (!pair) return 'unknown'

  const local = pair.localCandidateId
    ? (stats.get(pair.localCandidateId) as IceCandidateStats | undefined)
    : undefined
  const remote = pair.remoteCandidateId
    ? (stats.get(pair.remoteCandidateId) as IceCandidateStats | undefined)
    : undefined

  return classifyConnectionKind({
    localCandidateType: local?.candidateType,
    remoteCandidateType: remote?.candidateType,
  })
}

function getSelectedCandidatePair(stats: RTCStatsReport): RTCIceCandidatePairStats | null {
  const entries = Array.from(stats.values())

  const transport = entries.find(
    (entry): entry is RTCTransportStats =>
      entry.type === 'transport' &&
      'selectedCandidatePairId' in entry &&
      typeof entry.selectedCandidatePairId === 'string'
  )

  if (transport?.selectedCandidatePairId) {
    const selected = stats.get(transport.selectedCandidatePairId)
    if (selected?.type === 'candidate-pair') {
      return selected as RTCIceCandidatePairStats
    }
  }

  const selectedPair = entries.find(
    (entry): entry is RTCIceCandidatePairStats =>
      entry.type === 'candidate-pair' &&
      'selected' in entry &&
      entry.selected === true
  )
  if (selectedPair) return selectedPair

  const nominatedPair = entries.find(
    (entry): entry is RTCIceCandidatePairStats =>
      entry.type === 'candidate-pair' &&
      entry.nominated === true &&
      entry.state === 'succeeded'
  )
  return nominatedPair ?? null
}
