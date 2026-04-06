/**
 * Clex Chain ID — privacy-first local identifier
 *
 * Generated entirely in-browser from random bytes. No IP address,
 * no device fingerprinting, no PII involved. If localStorage is
 * cleared a new ID is created automatically.
 */

const STORAGE_KEY = 'clex-chain-id'
const ID_RE = /^[0-9a-f]{32}$/

function generate(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** Return the persisted chain ID, creating one if none exists yet. */
export function getChainId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && ID_RE.test(stored)) return stored
  } catch {
    // localStorage unavailable (SSR, private mode, etc.)
    return generate()
  }

  const id = generate()
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch { /* ignore write failures */ }
  return id
}

/** Return the chain ID only if one already exists (no side-effects). */
export function peekChainId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && ID_RE.test(stored) ? stored : null
  } catch {
    return null
  }
}

/** Human-readable display: split into 4-char groups for readability. */
export function formatChainId(id: string): string {
  return id.match(/.{4}/g)?.join('-') ?? id
}
