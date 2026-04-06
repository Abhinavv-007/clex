import { get } from 'svelte/store'
import { filesStore, type ProcessedFile } from '$stores/files'
import { transferStore, type TransferMethod } from '$stores/transfer'
import { uiStore } from '$stores/ui'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const DRIVE_FILE_URL = (id: string) => `https://www.googleapis.com/drive/v3/files/${id}`
const DRIVE_PERMISSIONS_URL = (id: string) => `${DRIVE_FILE_URL(id)}/permissions`
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_ROOT_FOLDER_NAME = 'Glex sharing'

const TOKEN_KEY = 'clex_gdrive_token'
const DRIVE_AUTH_DB_NAME = 'clex_drive_auth'
const DRIVE_AUTH_STORE_NAME = 'workspace_state'
const DRIVE_AUTH_STATE_KEY = 'pending_google_drive_auth'
const PICKUP_RETRY_DELAYS_MS = [0, 150, 350, 700]

function getApiBaseUrl(): string {
  const configured = (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return ''
}

type PersistedDriveEntry = {
  id: string
  file: File
  name: string
  size: number
  type: string
  processed?: Omit<ProcessedFile, 'url'>
}

type PersistedDriveAuthState = {
  files: PersistedDriveEntry[]
  method: TransferMethod
}

function getSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// ─── Token management ────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return getSessionStorage()?.getItem(TOKEN_KEY) ?? getLocalStorage()?.getItem(TOKEN_KEY) ?? null
}

export function storeToken(token: string): void {
  getSessionStorage()?.setItem(TOKEN_KEY, token)
  getLocalStorage()?.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  getSessionStorage()?.removeItem(TOKEN_KEY)
  getLocalStorage()?.removeItem(TOKEN_KEY)
}

export function hasToken(): boolean {
  return getStoredToken() !== null
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export interface UploadResult {
  fileId: string
  webViewLink: string
  directLink: string
  folderName?: string
}

interface GoogleOAuthStatusResponse {
  configured: boolean
  missing: string[]
}

function isLocalSetupHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

function getGoogleOAuthSetupMessage(): string {
  if (typeof window !== 'undefined' && !isLocalSetupHost(window.location.hostname)) {
    return 'Google Drive is not configured on this deployment. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI on the API worker, then redeploy. Also add that redirect URI in Google Cloud Console.'
  }

  return 'Google Drive is not configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to the API service env, then restart development.'
}

export async function uploadToDrive(
  items: Array<{ blob: Blob; name: string; type?: string }>,
  accessToken: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (items.length === 0) {
    throw new Error('No files selected for Google Drive upload')
  }

  onProgress?.(4)
  const rootFolderId = await ensureDriveRootFolder(accessToken)
  onProgress?.(10)

  const folderName = getDriveSessionFolderName()
  const sessionFolderId = await createFolder(folderName, accessToken, rootFolderId)
  onProgress?.(16)

  const totalBytes = items.reduce((sum, item) => sum + item.blob.size, 0) || 1
  let uploadedBytes = 0

  for (const item of items) {
    await uploadFileToFolder(item, accessToken, sessionFolderId, (loaded) => {
      const pct = Math.round(16 + ((uploadedBytes + loaded) / totalBytes) * 68)
      onProgress?.(Math.min(84, pct))
    })
    uploadedBytes += item.blob.size
    const pct = Math.round(16 + (uploadedBytes / totalBytes) * 68)
    onProgress?.(Math.min(84, pct))
  }

  onProgress?.(88)
  await setAnyoneWithLinkPermission(sessionFolderId, accessToken)

  onProgress?.(100)

  const folderLink = `https://drive.google.com/drive/folders/${sessionFolderId}`

  return {
    fileId: sessionFolderId,
    webViewLink: folderLink,
    directLink: folderLink,
    folderName,
  }
}

// ─── Pick up token from server after OAuth callback ──────────────────────────
// Calls the one-time pickup endpoint that reads + deletes the httpOnly cookie.

export async function pickupToken(): Promise<string | null> {
  for (const delayMs of PICKUP_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await delay(delayMs)
    }

    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/auth/gdrive/token`, { credentials: 'include' })
      if (!resp.ok) continue
      const data = (await resp.json()) as { token: string | null }
      if (data.token) {
        storeToken(data.token)
        await restorePendingDriveAuthState()
        return data.token
      }
    } catch {
      // retry
    }
  }

  const existingToken = getStoredToken()
  if (existingToken) {
    await restorePendingDriveAuthState()
    return existingToken
  }

  return null
}

// ─── Initiate OAuth from the workspace ───────────────────────────────────────

async function ensureGoogleOAuthConfigured(): Promise<void> {
  const resp = await fetch(`${getApiBaseUrl()}/api/auth/google/status`, { credentials: 'include' })
  if (!resp.ok) {
    throw new Error('Could not verify Google Drive configuration. Try again in a moment.')
  }

  const data = (await resp.json()) as GoogleOAuthStatusResponse
  if (!data.configured) {
    throw new Error(getGoogleOAuthSetupMessage())
  }
}

export async function initiateGoogleAuth(): Promise<void> {
  await ensureGoogleOAuthConfigured()
  await persistPendingDriveAuthState()
  const apiBase = getApiBaseUrl()
  const returnTo = typeof window !== 'undefined' ? window.location.origin : ''
  const authUrl = new URL(`${apiBase}/api/auth/google`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  if (returnTo) {
    authUrl.searchParams.set('return_to', returnTo)
  }
  window.location.href = authUrl.toString()
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined'
}

async function openDriveAuthDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return null

  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DRIVE_AUTH_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRIVE_AUTH_STORE_NAME)) {
        db.createObjectStore(DRIVE_AUTH_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open Drive auth database'))
  })
}

async function writeDriveAuthState(state: PersistedDriveAuthState): Promise<void> {
  const db = await openDriveAuthDb()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRIVE_AUTH_STORE_NAME, 'readwrite')
    tx.objectStore(DRIVE_AUTH_STORE_NAME).put(state, DRIVE_AUTH_STATE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not store Drive auth state'))
  })

  db.close()
}

async function readDriveAuthState(): Promise<PersistedDriveAuthState | null> {
  const db = await openDriveAuthDb()
  if (!db) return null

  const result = await new Promise<PersistedDriveAuthState | null>((resolve, reject) => {
    const tx = db.transaction(DRIVE_AUTH_STORE_NAME, 'readonly')
    const request = tx.objectStore(DRIVE_AUTH_STORE_NAME).get(DRIVE_AUTH_STATE_KEY)
    request.onsuccess = () => resolve((request.result as PersistedDriveAuthState | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Could not read Drive auth state'))
  })

  db.close()
  return result
}

async function clearDriveAuthState(): Promise<void> {
  const db = await openDriveAuthDb()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRIVE_AUTH_STORE_NAME, 'readwrite')
    tx.objectStore(DRIVE_AUTH_STORE_NAME).delete(DRIVE_AUTH_STATE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear Drive auth state'))
  })

  db.close()
}

async function persistPendingDriveAuthState(): Promise<void> {
  const currentFiles = get(filesStore)
  if (currentFiles.length === 0) return

  const snapshot: PersistedDriveAuthState = {
    files: currentFiles.map(entry => ({
      id: entry.id,
      file: entry.file,
      name: entry.name,
      size: entry.size,
      type: entry.type,
      processed: entry.processed
        ? {
            blob: entry.processed.blob,
            name: entry.processed.name,
            type: entry.processed.type,
            operation: entry.processed.operation,
          }
        : undefined,
    })),
    method: 'drive',
  }

  try {
    await writeDriveAuthState(snapshot)
  } catch (error) {
    console.warn('Could not persist Drive auth state before redirect.', error)
  }
}

async function restorePendingDriveAuthState(): Promise<void> {
  let pendingState: PersistedDriveAuthState | null = null

  try {
    pendingState = await readDriveAuthState()
  } catch (error) {
    console.warn('Could not read pending Drive auth state.', error)
    return
  }

  if (!pendingState || pendingState.files.length === 0) return

  filesStore.hydrate(
    pendingState.files.map(entry => ({
      id: entry.id,
      file: entry.file,
      name: entry.name,
      size: entry.size,
      type: entry.type,
      processed: entry.processed,
    }))
  )

  transferStore.setMethod(pendingState.method)
  uiStore.setPanel('share')

  try {
    await clearDriveAuthState()
  } catch (error) {
    console.warn('Could not clear restored Drive auth state.', error)
  }
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function getDriveSessionFolderName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

async function ensureDriveRootFolder(accessToken: string): Promise<string> {
  const existingFolderId = await findFolderIdByName(DRIVE_ROOT_FOLDER_NAME, accessToken)
  if (existingFolderId) return existingFolderId
  return createFolder(DRIVE_ROOT_FOLDER_NAME, accessToken)
}

async function findFolderIdByName(name: string, accessToken: string, parentId?: string): Promise<string | null> {
  const url = new URL(DRIVE_FILES_URL)
  const queryParts = [
    `name='${escapeDriveQueryValue(name)}'`,
    `mimeType='${DRIVE_FOLDER_MIME}'`,
    'trashed=false',
  ]

  if (parentId) {
    queryParts.push(`'${escapeDriveQueryValue(parentId)}' in parents`)
  }

  url.searchParams.set('q', queryParts.join(' and '))
  url.searchParams.set('fields', 'files(id,name)')
  url.searchParams.set('pageSize', '1')
  url.searchParams.set('spaces', 'drive')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Drive folder lookup failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { files?: Array<{ id: string }> }
  return data.files?.[0]?.id ?? null
}

async function createFolder(name: string, accessToken: string, parentId?: string): Promise<string> {
  const response = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: DRIVE_FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })

  if (!response.ok) {
    throw new Error(`Drive folder creation failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as { id: string }
  return data.id
}

async function uploadFileToFolder(
  item: { blob: Blob; name: string; type?: string },
  accessToken: string,
  parentId: string,
  onProgress?: (loaded: number) => void
): Promise<string> {
  const metadata = JSON.stringify({
    name: item.name,
    mimeType: item.blob.type || item.type || 'application/octet-stream',
    parents: [parentId],
  })
  const boundary = `clex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${item.blob.type || item.type || 'application/octet-stream'}\r\n\r\n`,
      item.blob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  )

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', DRIVE_UPLOAD_URL)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`)

    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { id: string }
          resolve(data.id)
        } catch {
          reject(new Error('Invalid Drive API response'))
        }
      } else {
        reject(new Error(`Drive upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => reject(new Error('Drive upload network error'))
    xhr.send(body)
  })
}

async function setAnyoneWithLinkPermission(itemId: string, accessToken: string): Promise<void> {
  const response = await fetch(DRIVE_PERMISSIONS_URL(itemId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  if (!response.ok) {
    throw new Error(`Drive permission update failed: ${response.status} ${response.statusText}`)
  }
}
