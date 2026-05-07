/**
 * Vault Encryption Module
 *
 * Master key: AES-256-GCM, generated once, stored in IndexedDB.
 * Never leaves the device except over an encrypted WebRTC pairing channel.
 *
 * For Google-authenticated users, a deterministic key can also be derived
 * via HKDF(googleUID + deviceSalt) — allowing auto-pairing without codes.
 */

const CRYPTO_DB_NAME = 'vault-crypto-v1'
const CRYPTO_DB_VERSION = 1
const KEY_STORE = 'keys'
const MASTER_KEY_ID = 'master'
const DEVICE_SALT_ID = 'device-salt'

export interface MasterKey {
  key: CryptoKey
  keyHash: string   // SHA-256 hex of raw key material
  fingerprint: string // first 8 chars of keyHash for display
  roomId: string    // first 32 chars of keyHash used as yjs/WebRTC room ID
}

// ── Database ──────────────────────────────────────────────────────────────────

function openCryptoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CRYPTO_DB_NAME, CRYPTO_DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(key: string): Promise<unknown> {
  const db = await openCryptoDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly')
    const req = tx.objectStore(KEY_STORE).get(key)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

async function dbPut(key: string, value: unknown): Promise<void> {
  const db = await openCryptoDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).put(value, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function dbDelete(key: string): Promise<void> {
  const db = await openCryptoDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite')
    tx.objectStore(KEY_STORE).delete(key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes.buffer
}

export function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function deriveKeyHash(rawKey: ArrayBuffer): Promise<string> {
  const hashBuf = await crypto.subtle.digest('SHA-256', rawKey)
  return bufToHex(hashBuf)
}

async function buildMasterKey(rawKey: ArrayBuffer): Promise<MasterKey> {
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
  const keyHash = await deriveKeyHash(rawKey)
  return {
    key,
    keyHash,
    fingerprint: keyHash.slice(0, 8).toUpperCase(),
    roomId: keyHash.slice(0, 32),
  }
}

export async function createMasterKeyFromRaw(rawKey: ArrayBuffer): Promise<MasterKey> {
  return buildMasterKey(rawKey)
}

// ── Master Key Lifecycle ──────────────────────────────────────────────────────

export async function getOrCreateMasterKey(): Promise<MasterKey> {
  const stored = await dbGet(MASTER_KEY_ID) as ArrayBuffer | null
  if (stored) return buildMasterKey(stored)

  // Generate fresh AES-256-GCM key
  const generatedKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const raw = await crypto.subtle.exportKey('raw', generatedKey)
  await dbPut(MASTER_KEY_ID, raw)
  return buildMasterKey(raw)
}

export async function storeMasterKeyFromRaw(raw: ArrayBuffer): Promise<MasterKey> {
  await dbPut(MASTER_KEY_ID, raw)
  return buildMasterKey(raw)
}

export async function persistMasterKey(masterKey: MasterKey): Promise<MasterKey> {
  const raw = await crypto.subtle.exportKey('raw', masterKey.key)
  await dbPut(MASTER_KEY_ID, raw)
  return buildMasterKey(raw)
}

export async function rotateMasterKey(): Promise<MasterKey> {
  await dbDelete(MASTER_KEY_ID)
  return getOrCreateMasterKey()
}

export async function exportKeyAsJson(masterKey: MasterKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', masterKey.key)
  const bytes = Array.from(new Uint8Array(raw))
  return JSON.stringify({
    version: 1,
    keyBytes: bytes,
    fingerprint: masterKey.fingerprint,
    exportedAt: new Date().toISOString(),
  }, null, 2)
}

export async function importKeyFromJson(jsonStr: string): Promise<MasterKey> {
  const data = JSON.parse(jsonStr)
  if (data.version !== 1 || !Array.isArray(data.keyBytes)) {
    throw new Error('Invalid key backup — expected { version: 1, keyBytes: [...] }')
  }
  const raw = new Uint8Array(data.keyBytes).buffer
  return storeMasterKeyFromRaw(raw)
}

// ── HKDF-based Google UID key derivation ──────────────────────────────────────

export async function getOrCreateDeviceSalt(): Promise<Uint8Array> {
  const stored = await dbGet(DEVICE_SALT_ID) as ArrayBuffer | null
  if (stored) return new Uint8Array(stored)

  const salt = crypto.getRandomValues(new Uint8Array(32))
  await dbPut(DEVICE_SALT_ID, salt.buffer)
  return salt
}

export async function deriveGoogleKey(googleUid: string): Promise<MasterKey> {
  // Fixed salt — must be identical across all devices so that the
  // derived key (and therefore the yjs room ID) is deterministic.
  // Any device signed into the same Google account derives the same key.
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(googleUid),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('clex-vault-v1'),         // fixed — same on every device
      info: encoder.encode('vault-master-key-v1'),
    },
    keyMaterial,
    256
  )
  return buildMasterKey(derivedBits)
}

// ── Symmetric Encryption / Decryption ────────────────────────────────────────

export interface EncryptedBlob {
  ciphertextB64: string
  ivB64: string
}

export async function encryptText(plaintext: string, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return {
    ciphertextB64: bufToBase64(ciphertext),
    ivB64: bufToBase64(iv.buffer),
  }
}

export async function decryptText(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const ciphertext = base64ToBuf(blob.ciphertextB64)
  const iv = new Uint8Array(base64ToBuf(blob.ivB64))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

export async function encryptBytes(data: ArrayBuffer, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return {
    ciphertextB64: bufToBase64(ciphertext),
    ivB64: bufToBase64(iv.buffer),
  }
}

export async function decryptBytes(blob: EncryptedBlob, key: CryptoKey): Promise<ArrayBuffer> {
  const ciphertext = base64ToBuf(blob.ciphertextB64)
  const iv = new Uint8Array(base64ToBuf(blob.ivB64))
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
}

// ── One-time Secret Share Encryption (client-side, key in URL hash) ───────────

export async function generateOneTimeKey(): Promise<{ key: CryptoKey; keyB64: string }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const raw = await crypto.subtle.exportKey('raw', key)
  return { key, keyB64: bufToBase64(raw) }
}

export async function importOneTimeKey(keyB64: string): Promise<CryptoKey> {
  const raw = base64ToBuf(keyB64)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function encryptSecret(plaintext: string): Promise<{ encrypted: EncryptedBlob; keyB64: string }> {
  const { key, keyB64 } = await generateOneTimeKey()
  const encrypted = await encryptText(plaintext, key)
  return { encrypted, keyB64 }
}

export async function decryptSecret(blob: EncryptedBlob, keyB64: string): Promise<string> {
  const key = await importOneTimeKey(keyB64)
  return decryptText(blob, key)
}
