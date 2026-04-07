import { decryptText, encryptText, type EncryptedBlob, type MasterKey } from './crypto'
import type { StoredFolder, StoredNote } from './db'

export interface BackupSnapshot {
  schemaVersion: 1
  savedAt: number
  notes: StoredNote[]
  folders: StoredFolder[]
}

interface StoredBackupRecord {
  roomId: string
  fingerprint: string
  noteCount: number
  folderCount: number
  updatedAt: number
  snapshot: EncryptedBlob
}

export interface AccountDeviceRecord {
  id: string
  name: string
  lastSeen: number
  pairedAt: number
  roomId: string
  fingerprint: string
}

export async function pushVaultBackup(
  vaultApiUrl: string,
  masterKey: MasterKey,
  notes: StoredNote[],
  folders: StoredFolder[],
): Promise<void> {
  const snapshot: BackupSnapshot = {
    schemaVersion: 1,
    savedAt: Date.now(),
    notes,
    folders,
  }

  const encryptedSnapshot = await encryptText(JSON.stringify(snapshot), masterKey.key)
  const payload = {
    fingerprint: masterKey.fingerprint,
    noteCount: notes.length,
    folderCount: folders.length,
    updatedAt: snapshot.savedAt,
    snapshot: encryptedSnapshot,
  } satisfies Omit<StoredBackupRecord, 'roomId'>

  const response = await fetch(`${vaultApiUrl}/backup/${masterKey.roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error ?? `Backup upload failed (${response.status})`)
  }
}

export async function fetchVaultBackup(
  vaultApiUrl: string,
  masterKey: MasterKey,
): Promise<BackupSnapshot | null> {
  const response = await fetch(`${vaultApiUrl}/backup/${masterKey.roomId}`)
  if (response.status === 404) return null
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error ?? `Backup download failed (${response.status})`)
  }

  const payload = await response.json() as StoredBackupRecord
  const decrypted = await decryptText(payload.snapshot, masterKey.key)
  const parsed = JSON.parse(decrypted) as Partial<BackupSnapshot>

  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.notes) || !Array.isArray(parsed.folders)) {
    throw new Error('Vault backup payload is invalid')
  }

  return {
    schemaVersion: 1,
    savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : payload.updatedAt,
    notes: parsed.notes as StoredNote[],
    folders: parsed.folders as StoredFolder[],
  }
}

export async function upsertAccountDevice(
  vaultApiUrl: string,
  uid: string,
  device: AccountDeviceRecord,
): Promise<void> {
  const response = await fetch(`${vaultApiUrl}/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vault-UID': uid,
    },
    body: JSON.stringify(device),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error ?? `Device sync failed (${response.status})`)
  }
}

export async function fetchAccountDevices(
  vaultApiUrl: string,
  uid: string,
): Promise<AccountDeviceRecord[]> {
  const response = await fetch(`${vaultApiUrl}/devices`, {
    headers: { 'X-Vault-UID': uid },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error ?? `Device load failed (${response.status})`)
  }

  const payload = await response.json() as { devices?: AccountDeviceRecord[] }
  return payload.devices ?? []
}

export async function removeAccountDevice(
  vaultApiUrl: string,
  uid: string,
  deviceId: string,
): Promise<void> {
  const response = await fetch(`${vaultApiUrl}/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: { 'X-Vault-UID': uid },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(data?.error ?? `Device removal failed (${response.status})`)
  }
}
