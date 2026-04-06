import { transferStore } from '$stores/transfer'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const DRIVE_FILE_URL = (id: string) => `https://www.googleapis.com/drive/v3/files/${id}`
const DRIVE_PERMISSIONS_URL = (id: string) => `${DRIVE_FILE_URL(id)}/permissions`
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_ROOT_FOLDER_NAME = 'Glex sharing'

const TOKEN_KEY = 'clex_gdrive_token'

function getApiBaseUrl(): string {
  const configured = (import.meta.env.PUBLIC_API_BASE_URL as string | undefined)?.trim()
  if (configured) return configured.replace(/\/$/, '')
  return ''
}

// ─── Token management (sessionStorage only — tab-scoped, not persistent) ────

export function getStoredToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
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
  try {
    const resp = await fetch(`${getApiBaseUrl()}/api/auth/gdrive/token`, { credentials: 'include' })
    if (!resp.ok) return null
    const data = (await resp.json()) as { token: string | null }
    if (data.token) {
      storeToken(data.token)
      return data.token
    }
  } catch {
    // Silently fail — token stays null
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
  const apiBase = getApiBaseUrl()
  const returnTo = typeof window !== 'undefined' ? window.location.origin : ''
  const authUrl = new URL(`${apiBase}/api/auth/google`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  if (returnTo) {
    authUrl.searchParams.set('return_to', returnTo)
  }
  window.location.href = authUrl.toString()
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
