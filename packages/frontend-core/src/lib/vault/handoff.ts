export function toUrlSafeBase64(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function fromUrlSafeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (normalized.length % 4 || 4)) % 4
  return `${normalized}${'='.repeat(padding)}`
}

export function encodeSecretAccessCode(id: string, keyB64: string): string {
  return `${id}.${toUrlSafeBase64(keyB64)}`
}

export function decodeSecretAccessCode(raw: string): { id: string; keyB64: string } | null {
  const trimmed = raw.trim().replace(/\s+/g, '')
  const divider = trimmed.indexOf('.')
  if (divider <= 0) return null

  const id = trimmed.slice(0, divider).toLowerCase()
  const encodedKey = trimmed.slice(divider + 1)

  if (!/^[a-f0-9]{8,}$/i.test(id) || !/^[A-Za-z0-9_-]+$/.test(encodedKey)) {
    return null
  }

  return {
    id,
    keyB64: fromUrlSafeBase64(encodedKey),
  }
}

export function normalizeRelayCode(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export function formatGroupedCode(raw: string, groupSize = 4): string {
  const normalized = raw.replace(/\s+/g, '').toUpperCase()
  if (!normalized) return ''

  const segments: string[] = []
  for (let index = 0; index < normalized.length; index += groupSize) {
    segments.push(normalized.slice(index, index + groupSize))
  }
  return segments.join(' ')
}
