import { get } from 'svelte/store'
import { filesStore, type ProcessedFile } from '$stores/files'
import { transferStore, type TransferMethod } from '$stores/transfer'
import { uiStore } from '$stores/ui'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_PERMISSIONS_URL = (id: string) => `https://www.googleapis.com/drive/v3/files/${id}/permissions`
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_ROOT_FOLDER_NAME = 'Clex Share'

const TOKEN_KEY = 'clex_gdrive_token'
const PENDING_AUTH_KEY = 'clex_gdrive_auth_pending'
const DRIVE_AUTH_DB_NAME = 'clex_drive_auth'
const DRIVE_AUTH_STORE_NAME = 'workspace_state'
const DRIVE_AUTH_STATE_KEY = 'pending_google_drive_auth'
const VAULT_DRIVE_AUTH_STATE_KEY = 'pending_vault_google_drive_auth'
const DRIVE_AUTH_ERROR_KEY = 'clex_gdrive_callback_error'
const PICKUP_RETRY_DELAYS_MS = [0, 150, 350, 700, 1400, 2400]

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

type PersistedVaultDriveAuthState = {
  files: PersistedDriveEntry[]
}

export interface GoogleDriveUser {
  sub: string
  email: string | null
  displayName: string | null
  picture: string | null
}

export interface UploadResult {
  fileId: string
  webViewLink: string
  directLink: string
  folderName?: string
}

export interface DriveUploadItemResult {
  id: string
  name: string
  sizeBytes: number
  mimeType: string
  webViewLink: string
  directLink: string
}

export interface DriveUploadBatchResult {
  folderId: string
  folderName: string
  webViewLink: string
  directLink: string
  files: DriveUploadItemResult[]
}

interface GoogleOAuthStatusResponse {
  configured: boolean
  missing: string[]
}

interface GoogleDriveTokenPickupResponse {
  token: string | null
  connected: boolean
  user?: GoogleDriveUser | null
  error?: string
}

interface GoogleDriveSessionResponse {
  connected: boolean
  user?: GoogleDriveUser | null
  error?: string
}

export function getDriveApiBaseUrl(): string {
  const configured = (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return ''
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

export function getStoredToken(): string | null {
  return getSessionStorage()?.getItem(TOKEN_KEY) ?? getLocalStorage()?.getItem(TOKEN_KEY) ?? null
}

export function storeToken(token: string): void {
  getSessionStorage()?.setItem(TOKEN_KEY, token)
  getLocalStorage()?.setItem(TOKEN_KEY, token)
  clearPendingAuth()
}

export function clearToken(): void {
  getSessionStorage()?.removeItem(TOKEN_KEY)
  getLocalStorage()?.removeItem(TOKEN_KEY)
}

export function hasToken(): boolean {
  return getStoredToken() !== null
}

export function hasPendingAuth(): boolean {
  return getSessionStorage()?.getItem(PENDING_AUTH_KEY) === '1'
    || getLocalStorage()?.getItem(PENDING_AUTH_KEY) === '1'
}

function markPendingAuth(): void {
  getSessionStorage()?.setItem(PENDING_AUTH_KEY, '1')
  getLocalStorage()?.setItem(PENDING_AUTH_KEY, '1')
}

function clearPendingAuth(): void {
  getSessionStorage()?.removeItem(PENDING_AUTH_KEY)
  getLocalStorage()?.removeItem(PENDING_AUTH_KEY)
}

function setCallbackError(code: string): void {
  getSessionStorage()?.setItem(DRIVE_AUTH_ERROR_KEY, code)
}

export function consumeDriveAuthError(): string | null {
  const storage = getSessionStorage()
  const value = storage?.getItem(DRIVE_AUTH_ERROR_KEY) ?? null
  if (value) {
    storage?.removeItem(DRIVE_AUTH_ERROR_KEY)
  }
  return value
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
    return 'Google Drive is not configured on this deployment. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, DRIVE_SESSION_STORE, and the token encryption secret on the API worker, then redeploy.'
  }

  return 'Google Drive is not configured yet. Add the OAuth env vars, DRIVE_SESSION_STORE, and the token encryption secret to the API service before testing this flow.'
}

function mapCallbackError(code: string | null): string | null {
  if (!code) return null

  switch (code) {
    case 'oauth_denied':
      return 'Google Drive access was denied. Approve the Drive permission request to continue.'
    case 'state_mismatch':
      return 'The Google Drive callback could not be verified. Start the connection again from the app.'
    case 'no_code':
      return 'Google completed the redirect without an authorization code. Start the connection again.'
    case 'oauth_not_configured':
      return getGoogleOAuthSetupMessage()
    case 'token_exchange_failed':
    case 'refresh_token_failed':
      return 'Google Drive authentication completed, but Clex could not exchange the token. Try again in a moment.'
    case 'no_refresh_token':
      return 'Google Drive connected without an offline refresh token. Reconnect and approve the full consent screen so timed cleanup can work.'
    case 'userinfo_failed':
    case 'userinfo_missing_subject':
      return 'Google Drive connected, but Clex could not load the account profile needed to finish setup.'
    default:
      return 'Google Drive connection could not be completed. Try again.'
  }
}

export async function getDriveSession(): Promise<{ connected: boolean; user: GoogleDriveUser | null }> {
  try {
    const response = await fetch(`${getDriveApiBaseUrl()}/api/auth/gdrive/session`, {
      credentials: 'include',
    })
    if (!response.ok) {
      return { connected: false, user: null }
    }

    const data = await response.json() as GoogleDriveSessionResponse
    return {
      connected: Boolean(data.connected),
      user: data.user ?? null,
    }
  } catch {
    return { connected: false, user: null }
  }
}

export async function disconnectGoogleDrive(): Promise<void> {
  clearToken()
  clearPendingAuth()
  await fetch(`${getDriveApiBaseUrl()}/api/auth/gdrive/session`, {
    method: 'DELETE',
    credentials: 'include',
  }).catch(() => undefined)
}

export async function pickupToken(): Promise<string | null> {
  const callbackError = consumeDriveAuthError()
  if (callbackError) {
    clearPendingAuth()
    throw new Error(mapCallbackError(callbackError) ?? 'Google Drive callback failed')
  }

  let lastError: string | null = null

  for (const delayMs of PICKUP_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await delay(delayMs)
    }

    try {
      const response = await fetch(`${getDriveApiBaseUrl()}/api/auth/gdrive/token`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const session = await getDriveSession()
        if (session.connected) {
          clearPendingAuth()
          await restorePendingDriveAuthState()
          return getStoredToken()
        }
        continue
      }
      const data = await response.json() as GoogleDriveTokenPickupResponse
      if (data.token) {
        storeToken(data.token)
        await restorePendingDriveAuthState()
        return data.token
      }
      if (data.error && hasPendingAuth()) {
        lastError = mapCallbackError(data.error) ?? data.error
      }
      if (data.connected) {
        clearPendingAuth()
        await restorePendingDriveAuthState()
        return getStoredToken()
      }

      const session = await getDriveSession()
      if (session.connected) {
        clearPendingAuth()
        await restorePendingDriveAuthState()
        return getStoredToken()
      }
    } catch (error) {
      if (error instanceof Error) {
        lastError = error.message
      }
    }
  }

  const existingToken = getStoredToken()
  if (existingToken) {
    clearPendingAuth()
    await restorePendingDriveAuthState()
    return existingToken
  }

  if (hasPendingAuth()) {
    const session = await getDriveSession()
    if (session.connected) {
      clearPendingAuth()
      await restorePendingDriveAuthState()
      return getStoredToken()
    }
    throw new Error(lastError ?? 'Google Drive finished redirecting, but Clex could not restore the connection or your pending files.')
  }

  return null
}

async function ensureGoogleOAuthConfigured(): Promise<void> {
  const response = await fetch(`${getDriveApiBaseUrl()}/api/auth/google/status`, { credentials: 'include' })
  if (!response.ok) {
    throw new Error('Could not verify Google Drive configuration. Try again in a moment.')
  }

  const data = await response.json() as GoogleOAuthStatusResponse
  if (!data.configured) {
    throw new Error(getGoogleOAuthSetupMessage())
  }
}

export async function initiateGoogleAuth(): Promise<void> {
  await ensureGoogleOAuthConfigured()
  await persistPendingDriveAuthState()
  markPendingAuth()

  const apiBase = getDriveApiBaseUrl()
  const returnTo = typeof window !== 'undefined' ? window.location.href : ''
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

async function writeDriveAuthState<T>(state: T, key = DRIVE_AUTH_STATE_KEY): Promise<void> {
  const db = await openDriveAuthDb()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRIVE_AUTH_STORE_NAME, 'readwrite')
    tx.objectStore(DRIVE_AUTH_STORE_NAME).put(state, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not store Drive auth state'))
  })

  db.close()
}

async function readDriveAuthState<T>(key = DRIVE_AUTH_STATE_KEY): Promise<T | null> {
  const db = await openDriveAuthDb()
  if (!db) return null

  const result = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(DRIVE_AUTH_STORE_NAME, 'readonly')
    const request = tx.objectStore(DRIVE_AUTH_STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('Could not read Drive auth state'))
  })

  db.close()
  return result
}

async function clearDriveAuthState(key = DRIVE_AUTH_STATE_KEY): Promise<void> {
  const db = await openDriveAuthDb()
  if (!db) return

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRIVE_AUTH_STORE_NAME, 'readwrite')
    tx.objectStore(DRIVE_AUTH_STORE_NAME).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear Drive auth state'))
  })

  db.close()
}

async function persistPendingDriveAuthState(): Promise<void> {
  const currentFiles = get(filesStore)
  if (currentFiles.length === 0) {
    try {
      await clearDriveAuthState(DRIVE_AUTH_STATE_KEY)
    } catch (error) {
      console.warn('Could not clear empty Drive auth state before redirect.', error)
    }
    return
  }

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
    await writeDriveAuthState(snapshot, DRIVE_AUTH_STATE_KEY)
  } catch (error) {
    console.warn('Could not persist Drive auth state before redirect.', error)
  }
}

async function restorePendingDriveAuthState(): Promise<void> {
  let pendingState: PersistedDriveAuthState | null = null

  try {
    pendingState = await readDriveAuthState<PersistedDriveAuthState>(DRIVE_AUTH_STATE_KEY)
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
    })),
  )

  transferStore.setMethod(pendingState.method)
  uiStore.setPanel('share')

  try {
    await clearDriveAuthState(DRIVE_AUTH_STATE_KEY)
  } catch (error) {
    console.warn('Could not clear restored Drive auth state.', error)
  }
}

export async function persistPendingVaultDriveFiles(files: File[]): Promise<void> {
  if (files.length === 0) {
    try {
      await clearDriveAuthState(VAULT_DRIVE_AUTH_STATE_KEY)
    } catch (error) {
      console.warn('Could not clear empty Vault Drive auth state before redirect.', error)
    }
    return
  }

  const snapshot: PersistedVaultDriveAuthState = {
    files: files.map(file => ({
      id: `${file.name}:${file.size}:${file.lastModified}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  }

  try {
    await writeDriveAuthState(snapshot, VAULT_DRIVE_AUTH_STATE_KEY)
  } catch (error) {
    console.warn('Could not persist Vault Drive file state before redirect.', error)
  }
}

export async function restorePendingVaultDriveFiles(): Promise<File[]> {
  let pendingState: PersistedVaultDriveAuthState | null = null

  try {
    pendingState = await readDriveAuthState<PersistedVaultDriveAuthState>(VAULT_DRIVE_AUTH_STATE_KEY)
  } catch (error) {
    console.warn('Could not read pending Vault Drive auth state.', error)
    return []
  }

  const restoredFiles = pendingState?.files?.map(entry => entry.file).filter(Boolean) ?? []

  if (restoredFiles.length === 0) {
    return []
  }

  try {
    await clearDriveAuthState(VAULT_DRIVE_AUTH_STATE_KEY)
  } catch (error) {
    console.warn('Could not clear restored Vault Drive auth state.', error)
  }

  return restoredFiles
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

  const data = await response.json() as { files?: Array<{ id: string }> }
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

  const data = await response.json() as { id: string }
  return data.id
}

async function uploadFileResumableToFolder(
  item: { blob: Blob; name: string; type?: string },
  accessToken: string,
  parentId: string,
  onProgress?: (loaded: number) => void,
): Promise<string> {
  const mimeType = item.blob.type || item.type || 'application/octet-stream'
  const startResponse = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(item.blob.size),
    },
    body: JSON.stringify({
      name: item.name,
      mimeType,
      parents: [parentId],
    }),
  })

  if (!startResponse.ok) {
    throw new Error(`Drive upload session failed: ${startResponse.status} ${startResponse.statusText}`)
  }

  const uploadUrl = startResponse.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('Drive upload session did not return an upload URL')
  }

  return await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('Content-Type', mimeType)

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
    xhr.send(item.blob)
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

  if (!response.ok && response.status !== 409) {
    throw new Error(`Drive permission update failed: ${response.status} ${response.statusText}`)
  }
}

function createDriveFileLinks(fileId: string): { webViewLink: string; directLink: string } {
  return {
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    directLink: `https://drive.google.com/uc?export=download&id=${fileId}`,
  }
}

function createDriveFolderLinks(folderId: string): { webViewLink: string; directLink: string } {
  const link = `https://drive.google.com/drive/folders/${folderId}`
  return {
    webViewLink: link,
    directLink: link,
  }
}

export async function uploadDriveBatch(
  items: Array<{ blob: Blob; name: string; type?: string }>,
  accessToken: string,
  onProgress?: (pct: number) => void,
): Promise<DriveUploadBatchResult> {
  if (items.length === 0) {
    throw new Error('No files selected for Google Drive upload')
  }

  onProgress?.(4)
  const rootFolderId = await ensureDriveRootFolder(accessToken)
  onProgress?.(10)

  const folderName = getDriveSessionFolderName()
  const folderId = await createFolder(folderName, accessToken, rootFolderId)
  const folderLinks = createDriveFolderLinks(folderId)
  onProgress?.(16)

  const totalBytes = items.reduce((sum, item) => sum + item.blob.size, 0) || 1
  let uploadedBytes = 0
  const uploadedFiles: DriveUploadItemResult[] = []

  for (const item of items) {
    const fileId = await uploadFileResumableToFolder(item, accessToken, folderId, loaded => {
      const pct = Math.round(16 + ((uploadedBytes + loaded) / totalBytes) * 68)
      onProgress?.(Math.min(84, pct))
    })
    uploadedBytes += item.blob.size
    const links = createDriveFileLinks(fileId)
    await setAnyoneWithLinkPermission(fileId, accessToken)
    uploadedFiles.push({
      id: fileId,
      name: item.name,
      sizeBytes: item.blob.size,
      mimeType: item.blob.type || item.type || 'application/octet-stream',
      webViewLink: links.webViewLink,
      directLink: links.directLink,
    })
    const pct = Math.round(16 + (uploadedBytes / totalBytes) * 68)
    onProgress?.(Math.min(84, pct))
  }

  if (items.length > 1) {
    onProgress?.(88)
    await setAnyoneWithLinkPermission(folderId, accessToken)
  }

  onProgress?.(100)

  return {
    folderId,
    folderName,
    webViewLink: folderLinks.webViewLink,
    directLink: folderLinks.directLink,
    files: uploadedFiles,
  }
}

export async function uploadToDrive(
  items: Array<{ blob: Blob; name: string; type?: string }>,
  accessToken: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const batch = await uploadDriveBatch(items, accessToken, onProgress)
  return {
    fileId: batch.folderId,
    webViewLink: batch.webViewLink,
    directLink: batch.directLink,
    folderName: batch.folderName,
  }
}
