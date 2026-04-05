import { transferStore } from '$stores/transfer'

const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
const DRIVE_FILE_URL = (id: string) => `https://www.googleapis.com/drive/v3/files/${id}`
const DRIVE_PERMISSIONS_URL = (id: string) => `${DRIVE_FILE_URL(id)}/permissions`

const TOKEN_KEY = 'clex_gdrive_token'

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
}

export async function uploadToDrive(
  blob: Blob,
  fileName: string,
  accessToken: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  // Build multipart body — metadata + file
  const metadata = JSON.stringify({ name: fileName, mimeType: blob.type || 'application/octet-stream' })
  const boundary = `clex_${Date.now()}`
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
      blob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  )

  // Use XMLHttpRequest for upload progress support
  const fileId = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', DRIVE_UPLOAD_URL)
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`)

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 80)) // 0–80% for upload
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

  onProgress?.(85)

  // Make file publicly readable (anyone with link)
  const permResp = await fetch(DRIVE_PERMISSIONS_URL(fileId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  if (!permResp.ok) {
    console.warn('Could not set public permissions:', permResp.status)
  }

  onProgress?.(92)

  // Fetch the share link
  const fileResp = await fetch(`${DRIVE_FILE_URL(fileId)}?fields=webViewLink,webContentLink`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!fileResp.ok) throw new Error(`Failed to get file info: ${fileResp.status}`)

  const fileData = (await fileResp.json()) as { webViewLink: string; webContentLink?: string }

  onProgress?.(100)

  return {
    fileId,
    webViewLink: fileData.webViewLink,
    directLink: fileData.webContentLink ?? fileData.webViewLink,
  }
}

// ─── Pick up token from server after OAuth callback ──────────────────────────
// Calls the one-time pickup endpoint that reads + deletes the httpOnly cookie.

export async function pickupToken(): Promise<string | null> {
  try {
    const resp = await fetch('/api/auth/gdrive/token')
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

export function initiateGoogleAuth(): void {
  window.location.href = '/api/auth/google'
}
