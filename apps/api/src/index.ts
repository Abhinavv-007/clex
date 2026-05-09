import {
  handleAdminLogin,
  handleAdminLogout,
  handleAdminMe,
  handleAdminFeed,
  handleAdminUserDetail,
  handleAdminUsers,
  handlePasskeyLoginBegin,
  handlePasskeyLoginFinish,
  handlePasskeyRegisterBegin,
  handlePasskeyRegisterFinish,
  handlePasskeyRevoke,
  handlePasskeys,
} from './adminPanel'
import {
  appendCors,
  buildFrontendRedirect,
  getGoogleOAuthConfigStatus,
  json,
  parseCookies,
  serializeCookie,
  shareableCookieDomain,
  type Env,
} from './googleAuth'
import {
  bumpMetric,
  handleAdminAudit,
  handleAdminHealth,
  handleAdminStats,
  handleAdminSummary,
  handleAdminTransfers,
  handleAppendEvent,
  handleCancelTransfer,
  handleCreateTransfer,
  handleGetTransfer,
} from './transfers'
import {
  handleKeyUsage,
  handleListKeys,
  handleMintKey,
  handleRevokeKey,
} from './apiKeysHandlers'
import { handleDashboard } from './dashboard'

const TOKEN_PICKUP_PATH = '/api/auth/gdrive/token'
const STATE_COOKIE = 'gdrive_state'
const RETURN_TO_COOKIE = 'gdrive_return_to'
const SESSION_COOKIE = 'gdrive_session'

const GDRIVE_SESSION_PREFIX = 'gdrive:session:'
const GDRIVE_ACCOUNT_PREFIX = 'gdrive:account:'
const VAULT_SHARE_PREFIX = 'vault-drive:share:'
const VAULT_SHARE_CODE_PREFIX = 'vault-drive:code:'
const VAULT_SESSION_PREFIX = 'vault-drive:session:'
const VAULT_QUOTA_PREFIX = 'vault-drive:quota:'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const VAULT_MAX_FILE_BYTES = 1024 * 1024 * 1024
const VAULT_DAILY_QUOTA_BYTES = 10 * 1024 * 1024 * 1024
const VAULT_SHARE_DELETE_AFTER_MS = 24 * 60 * 60 * 1000
const QUOTA_KV_TTL_SECONDS = 49 * 60 * 60
const SESSION_TTL_SECONDS = 90 * 24 * 60 * 60
const ACCESS_TOKEN_SKEW_MS = 60_000

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

interface GoogleUserProfile {
  sub: string
  email?: string
  name?: string
  picture?: string
}

interface EncryptedString {
  ciphertextB64: string
  ivB64: string
}

interface GoogleAccountRecord {
  sub: string
  email: string | null
  displayName: string | null
  picture: string | null
  refreshToken: EncryptedString
  scope: string[]
  createdAt: number
  updatedAt: number
}

interface GoogleSessionRecord {
  id: string
  sub: string
  email: string | null
  displayName: string | null
  picture: string | null
  accessToken: string
  accessTokenExpiresAt: number
  scope: string[]
  createdAt: number
  updatedAt: number
}

interface DriveUserPayload {
  sub: string
  email: string | null
  displayName: string | null
  picture: string | null
}

interface VaultDriveFileInput {
  id: string
  name: string
  sizeBytes: number
  mimeType: string
  webViewLink: string
  directLink: string
}

interface VaultDriveFolderInput {
  id: string
  name: string
  webViewLink: string
  directLink: string
}

interface VaultDriveSessionFileRecord extends VaultDriveFileInput {
  shareId: string
  code: string
}

interface VaultDriveSessionFolderRecord extends VaultDriveFolderInput {
  shareId: string
  code: string
}

interface VaultDriveSessionRecord {
  id: string
  ownerSub: string
  email: string | null
  displayName: string | null
  createdAt: number
  deleteAt: number
  totalBytes: number
  rootFolderName: string
  folder: VaultDriveSessionFolderRecord | null
  files: VaultDriveSessionFileRecord[]
}

interface VaultDriveShareRecord {
  id: string
  code: string
  sessionId: string
  ownerSub: string
  kind: 'file' | 'folder'
  driveItemId: string
  name: string
  mimeType: string | null
  sizeBytes: number | null
  webViewLink: string
  directLink: string
  createdAt: number
  deleteAt: number
  fileCount: number
}

function redirect(url: string, headers?: HeadersInit): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      ...headers,
    },
  })
}

function encodeBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function parseScope(scope: string | undefined): string[] {
  return (scope ?? '')
    .split(/\s+/)
    .map(entry => entry.trim())
    .filter(Boolean)
}

function utcDate(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

function randomHex(bytes = 16): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function getGoogleScope(env: Env): string {
  return env.GOOGLE_DRIVE_SCOPE?.trim()
    || 'openid email profile https://www.googleapis.com/auth/drive.file'
}

function appendSetCookie(headers: Headers, value: string): void {
  headers.append('Set-Cookie', value)
}

function normalizeShareToken(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function withNoStore(headers: Headers): Headers {
  headers.set('Cache-Control', 'no-store')
  return headers
}

function getRequiredCookie(cookies: Map<string, string>, name: string): string | null {
  const value = cookies.get(name)
  return value?.trim() ? value.trim() : null
}

async function kvGetJson<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.DRIVE_SESSION_STORE.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function kvPutJson(env: Env, key: string, value: unknown, expirationTtl?: number): Promise<void> {
  await env.DRIVE_SESSION_STORE.put(key, JSON.stringify(value), expirationTtl ? { expirationTtl } : undefined)
}

async function kvDelete(env: Env, ...keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => env.DRIVE_SESSION_STORE.delete(key)))
}

async function listAllKeys(env: Env, prefix: string): Promise<string[]> {
  const keys: string[] = []
  let cursor: string | undefined

  do {
    const page = await env.DRIVE_SESSION_STORE.list({ prefix, cursor })
    keys.push(...page.keys.map(item => item.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  return keys
}

async function importTokenEncryptionKey(env: Env): Promise<CryptoKey> {
  const secret = env.OAUTH_TOKEN_ENCRYPTION_SECRET?.trim() || env.GOOGLE_CLIENT_SECRET?.trim()
  if (!secret) {
    throw new Error('Token encryption secret is not configured')
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encryptOpaqueString(value: string, env: Env): Promise<EncryptedString> {
  const key = await importTokenEncryptionKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value),
  )

  return {
    ciphertextB64: encodeBase64(ciphertext),
    ivB64: encodeBase64(iv),
  }
}

async function decryptOpaqueString(value: EncryptedString, env: Env): Promise<string> {
  const key = await importTokenEncryptionKey(env)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(decodeBase64(value.ivB64)) },
    key,
    decodeBase64(value.ciphertextB64),
  )

  return new TextDecoder().decode(plaintext)
}

async function exchangeGoogleCode(env: Env, code: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: env.GOOGLE_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    throw new Error('token_exchange_failed')
  }

  return await response.json() as GoogleTokenResponse
}

async function refreshGoogleAccessToken(env: Env, refreshToken: string): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('refresh_token_failed')
  }

  return await response.json() as GoogleTokenResponse
}

async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('userinfo_failed')
  }

  const profile = await response.json() as GoogleUserProfile
  if (!profile.sub) {
    throw new Error('userinfo_missing_subject')
  }
  return profile
}

async function readDriveAccount(env: Env, sub: string): Promise<GoogleAccountRecord | null> {
  return kvGetJson<GoogleAccountRecord>(env, `${GDRIVE_ACCOUNT_PREFIX}${sub}`)
}

async function writeDriveAccount(env: Env, record: GoogleAccountRecord): Promise<void> {
  await kvPutJson(env, `${GDRIVE_ACCOUNT_PREFIX}${record.sub}`, record)
}

async function readDriveSession(env: Env, sessionId: string): Promise<GoogleSessionRecord | null> {
  return kvGetJson<GoogleSessionRecord>(env, `${GDRIVE_SESSION_PREFIX}${sessionId}`)
}

async function writeDriveSession(env: Env, session: GoogleSessionRecord): Promise<void> {
  await kvPutJson(env, `${GDRIVE_SESSION_PREFIX}${session.id}`, session, SESSION_TTL_SECONDS)
}

async function deleteDriveSession(env: Env, sessionId: string): Promise<void> {
  await kvDelete(env, `${GDRIVE_SESSION_PREFIX}${sessionId}`)
}

function toDriveUser(session: GoogleSessionRecord): DriveUserPayload {
  return {
    sub: session.sub,
    email: session.email,
    displayName: session.displayName,
    picture: session.picture,
  }
}

async function ensureDriveSession(
  request: Request,
  env: Env,
): Promise<GoogleSessionRecord | null> {
  const cookies = parseCookies(request)
  const sessionId = getRequiredCookie(cookies, SESSION_COOKIE)
  if (!sessionId) return null

  const session = await readDriveSession(env, sessionId)
  if (!session) return null

  if (session.accessToken && session.accessTokenExpiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS) {
    return session
  }

  const account = await readDriveAccount(env, session.sub)
  if (!account) return null

  const refreshToken = await decryptOpaqueString(account.refreshToken, env)
  const refreshed = await refreshGoogleAccessToken(env, refreshToken)
  if (!refreshed.access_token) {
    throw new Error('refresh_token_failed')
  }

  const nextSession: GoogleSessionRecord = {
    ...session,
    email: account.email,
    displayName: account.displayName,
    picture: account.picture,
    accessToken: refreshed.access_token,
    accessTokenExpiresAt: Date.now() + Math.max(60, refreshed.expires_in ?? 3600) * 1000,
    scope: parseScope(refreshed.scope).length > 0 ? parseScope(refreshed.scope) : session.scope,
    updatedAt: Date.now(),
  }

  await writeDriveSession(env, nextSession)
  return nextSession
}

async function requireDriveSession(
  request: Request,
  env: Env,
  cors: Headers,
): Promise<Response | GoogleSessionRecord> {
  try {
    const session = await ensureDriveSession(request, env)
    if (!session) {
      return json({ error: 'google_drive_auth_required' }, {
        status: 401,
        headers: withNoStore(cors),
      })
    }
    return session
  } catch (error) {
    const message = error instanceof Error ? error.message : 'google_drive_auth_required'
    return json({ error: message }, {
      status: 401,
      headers: withNoStore(cors),
    })
  }
}

function createVaultFileShareRecord(
  ownerSub: string,
  sessionId: string,
  createdAt: number,
  deleteAt: number,
  fileCount: number,
  file: VaultDriveSessionFileRecord,
): VaultDriveShareRecord {
  return {
    id: file.shareId,
    code: file.code,
    sessionId,
    ownerSub,
    kind: 'file',
    driveItemId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    webViewLink: file.webViewLink,
    directLink: file.directLink,
    createdAt,
    deleteAt,
    fileCount,
  }
}

function createVaultFolderShareRecord(
  ownerSub: string,
  sessionId: string,
  createdAt: number,
  deleteAt: number,
  fileCount: number,
  folder: VaultDriveSessionFolderRecord,
): VaultDriveShareRecord {
  return {
    id: folder.shareId,
    code: folder.code,
    sessionId,
    ownerSub,
    kind: 'folder',
    driveItemId: folder.id,
    name: folder.name,
    mimeType: null,
    sizeBytes: null,
    webViewLink: folder.webViewLink,
    directLink: folder.directLink,
    createdAt,
    deleteAt,
    fileCount,
  }
}

async function storeVaultDriveSession(env: Env, session: VaultDriveSessionRecord): Promise<void> {
  await kvPutJson(env, `${VAULT_SESSION_PREFIX}${session.ownerSub}:${session.id}`, session)

  const shareWrites: Promise<void>[] = []
  for (const file of session.files) {
    const share = createVaultFileShareRecord(session.ownerSub, session.id, session.createdAt, session.deleteAt, session.files.length, file)
    shareWrites.push(kvPutJson(env, `${VAULT_SHARE_PREFIX}${share.id}`, share))
    shareWrites.push(env.DRIVE_SESSION_STORE.put(`${VAULT_SHARE_CODE_PREFIX}${share.code}`, share.id))
  }

  if (session.folder) {
    const share = createVaultFolderShareRecord(session.ownerSub, session.id, session.createdAt, session.deleteAt, session.files.length, session.folder)
    shareWrites.push(kvPutJson(env, `${VAULT_SHARE_PREFIX}${share.id}`, share))
    shareWrites.push(env.DRIVE_SESSION_STORE.put(`${VAULT_SHARE_CODE_PREFIX}${share.code}`, share.id))
  }

  await Promise.all(shareWrites)
}

async function loadVaultDriveSession(env: Env, ownerSub: string, sessionId: string): Promise<VaultDriveSessionRecord | null> {
  return kvGetJson<VaultDriveSessionRecord>(env, `${VAULT_SESSION_PREFIX}${ownerSub}:${sessionId}`)
}

async function listVaultDriveSessions(env: Env, ownerSub: string): Promise<VaultDriveSessionRecord[]> {
  const keys = await listAllKeys(env, `${VAULT_SESSION_PREFIX}${ownerSub}:`)
  const sessions = await Promise.all(keys.map(key => kvGetJson<VaultDriveSessionRecord>(env, key)))
  const now = Date.now()
  return sessions
    .filter((session): session is VaultDriveSessionRecord => Boolean(session && session.deleteAt > now))
    .sort((left, right) => right.createdAt - left.createdAt)
}

async function cleanupVaultDriveSession(env: Env, session: VaultDriveSessionRecord): Promise<void> {
  const deletions: Promise<void>[] = [
    kvDelete(env, `${VAULT_SESSION_PREFIX}${session.ownerSub}:${session.id}`),
  ]

  for (const file of session.files) {
    deletions.push(kvDelete(env, `${VAULT_SHARE_PREFIX}${file.shareId}`, `${VAULT_SHARE_CODE_PREFIX}${file.code}`))
  }

  if (session.folder) {
    deletions.push(kvDelete(env, `${VAULT_SHARE_PREFIX}${session.folder.shareId}`, `${VAULT_SHARE_CODE_PREFIX}${session.folder.code}`))
  }

  await Promise.all(deletions)
}

async function resolveVaultShare(env: Env, token: string): Promise<VaultDriveShareRecord | null> {
  const normalized = normalizeShareToken(token)
  if (!normalized) return null

  if (normalized.length === 8) {
    const resolvedId = await env.DRIVE_SESSION_STORE.get(`${VAULT_SHARE_CODE_PREFIX}${normalized}`)
    if (resolvedId) {
      const byCode = await kvGetJson<VaultDriveShareRecord>(env, `${VAULT_SHARE_PREFIX}${resolvedId}`)
      if (byCode) return byCode
    }
  }

  return kvGetJson<VaultDriveShareRecord>(env, `${VAULT_SHARE_PREFIX}${normalized}`)
}

async function readQuotaUsage(env: Env, ownerSub: string, now = Date.now()): Promise<number> {
  const raw = await env.DRIVE_SESSION_STORE.get(`${VAULT_QUOTA_PREFIX}${ownerSub}:${utcDate(now)}`)
  return raw ? Number.parseInt(raw, 10) || 0 : 0
}

async function writeQuotaUsage(env: Env, ownerSub: string, usedBytes: number): Promise<void> {
  await env.DRIVE_SESSION_STORE.put(
    `${VAULT_QUOTA_PREFIX}${ownerSub}:${utcDate()}`,
    String(usedBytes),
    { expirationTtl: QUOTA_KV_TTL_SECONDS },
  )
}

async function deleteDriveItem(accessToken: string, itemId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined)
}

async function getAccessTokenForAccount(env: Env, ownerSub: string): Promise<string | null> {
  const account = await readDriveAccount(env, ownerSub)
  if (!account) return null

  try {
    const refreshToken = await decryptOpaqueString(account.refreshToken, env)
    const refreshed = await refreshGoogleAccessToken(env, refreshToken)
    return refreshed.access_token ?? null
  } catch {
    return null
  }
}

async function handleGoogleStatus(request: Request, env: Env): Promise<Response> {
  const headers = new Headers()
  appendCors(headers, request, env)
  return json(getGoogleOAuthConfigStatus(env), { headers })
}

async function handleGoogleAuthStart(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const returnTo = sanitizeOAuthReturnTo(request, env, url.searchParams.get('return_to'))
  const config = getGoogleOAuthConfigStatus(env)
  if (!config.configured) {
    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'oauth_not_configured' })))
  }

  const state = crypto.randomUUID()
  const secure = url.protocol === 'https:'
  const headers = new Headers()

  appendSetCookie(headers, serializeCookie(STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    maxAge: 600,
  }))

  if (returnTo) {
    appendSetCookie(headers, serializeCookie(RETURN_TO_COOKIE, returnTo, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: 1800,
    }))
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID ?? '')
  authUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI ?? '')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', getGoogleScope(env))
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('include_granted_scopes', 'true')

  return redirect(authUrl.toString(), headers)
}

function sanitizeOAuthReturnTo(request: Request, env: Env, raw: string | null): string | null {
  if (!raw) return null

  try {
    const requestUrl = new URL(request.url)
    const frontendBase = env.FRONTEND_BASE_URL?.trim() || requestUrl.origin
    const url = new URL(raw, frontendBase)
    const allowedOrigins = new Set<string>([
      requestUrl.origin,
      new URL(frontendBase).origin,
      'https://api.clex.in',
    ])
    if (env.ALLOWED_ORIGIN !== '*') {
      env.ALLOWED_ORIGIN
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean)
        .forEach(origin => allowedOrigins.add(origin))
    }
    if (env.ALLOWED_ORIGIN === '*' || allowedOrigins.has(url.origin)) {
      return url.toString()
    }
  } catch {
    return null
  }

  return null
}

async function handleGoogleAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const cookies = parseCookies(request)
  const secure = url.protocol === 'https:'
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const storedState = cookies.get(STATE_COOKIE) ?? null
  const returnTo = cookies.get(RETURN_TO_COOKIE) ?? null

  const headers = new Headers()
  appendSetCookie(headers, serializeCookie(STATE_COOKIE, '', { path: '/', httpOnly: true, secure, sameSite: 'Lax', maxAge: 0 }))
  appendSetCookie(headers, serializeCookie(RETURN_TO_COOKIE, '', { path: '/', httpOnly: true, secure, sameSite: 'Lax', maxAge: 0 }))

  if (error) {
    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'oauth_denied' })), headers)
  }

  if (!storedState || state !== storedState) {
    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'state_mismatch' })), headers)
  }

  if (!code) {
    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'no_code' })), headers)
  }

  const config = getGoogleOAuthConfigStatus(env)
  if (!config.configured) {
    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'oauth_not_configured' })), headers)
  }

  try {
    const tokenData = await exchangeGoogleCode(env, code)
    if (!tokenData.access_token) {
      return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'no_access_token' })), headers)
    }

    const profile = await fetchGoogleUserProfile(tokenData.access_token)
    const existingAccount = await readDriveAccount(env, profile.sub)
    const refreshToken = tokenData.refresh_token
      ?? (existingAccount ? await decryptOpaqueString(existingAccount.refreshToken, env) : null)

    if (!refreshToken) {
      return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: 'no_refresh_token' })), headers)
    }

    const now = Date.now()
    const scope = parseScope(tokenData.scope)
    const accountRecord: GoogleAccountRecord = {
      sub: profile.sub,
      email: profile.email ?? existingAccount?.email ?? null,
      displayName: profile.name ?? existingAccount?.displayName ?? null,
      picture: profile.picture ?? existingAccount?.picture ?? null,
      refreshToken: await encryptOpaqueString(refreshToken, env),
      scope: scope.length > 0 ? scope : existingAccount?.scope ?? parseScope(getGoogleScope(env)),
      createdAt: existingAccount?.createdAt ?? now,
      updatedAt: now,
    }

    await writeDriveAccount(env, accountRecord)

    const sessionRecord: GoogleSessionRecord = {
      id: randomHex(18),
      sub: accountRecord.sub,
      email: accountRecord.email,
      displayName: accountRecord.displayName,
      picture: accountRecord.picture,
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: now + Math.max(60, tokenData.expires_in ?? 3600) * 1000,
      scope: accountRecord.scope,
      createdAt: now,
      updatedAt: now,
    }

    await writeDriveSession(env, sessionRecord)

    appendSetCookie(headers, serializeCookie(SESSION_COOKIE, sessionRecord.id, {
      path: '/',
      // Share the session across clex.in / www.clex.in / api.clex.in so
      // the api.clex.in dashboard can read the same gdrive_session that
      // was minted by the OAuth callback on clex.in.
      domain: shareableCookieDomain(request) ?? undefined,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: SESSION_TTL_SECONDS,
    }))

    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ gdrive: 'connected' })), headers)
  } catch (callbackError) {
    const errorCode = callbackError instanceof Error ? callbackError.message : 'oauth_failed'
    return redirect(buildFrontendRedirect(request, env, returnTo, new URLSearchParams({ error: errorCode })), headers)
  }
}

async function handleDriveTokenPickup(request: Request, env: Env): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)

  try {
    const session = await ensureDriveSession(request, env)
    if (!session) {
      return json({ token: null, connected: false, user: null }, { headers })
    }

    return json({
      token: session.accessToken,
      connected: true,
      user: toDriveUser(session),
    }, { headers })
  } catch (error) {
    return json({
      token: null,
      connected: false,
      error: error instanceof Error ? error.message : 'google_drive_auth_required',
    }, { headers })
  }
}

async function handleDriveSessionGet(request: Request, env: Env): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)
  const session = await ensureDriveSession(request, env)
  if (!session) {
    return json({ connected: false, user: null }, { headers })
  }

  return json({
    connected: true,
    user: toDriveUser(session),
    scope: session.scope,
  }, { headers })
}

async function handleDriveSessionDelete(request: Request, env: Env): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)

  const cookies = parseCookies(request)
  const sessionId = getRequiredCookie(cookies, SESSION_COOKIE)
  if (sessionId) {
    await deleteDriveSession(env, sessionId)
  }

  const secure = new URL(request.url).protocol === 'https:'
  appendSetCookie(headers, serializeCookie(SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    maxAge: 0,
  }))

  return json({ ok: true }, { headers })
}

async function handleVaultDrivePreflight(request: Request, env: Env): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)
  const sessionOrError = await requireDriveSession(request, env, headers)
  if (sessionOrError instanceof Response) return sessionOrError

  let body: { files?: Array<{ name?: string; sizeBytes?: number }> }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, { status: 400, headers })
  }

  const files = Array.isArray(body.files) ? body.files : []
  if (files.length === 0) {
    return json({ error: 'files_required' }, { status: 400, headers })
  }

  let totalBytes = 0
  for (const file of files) {
    const sizeBytes = Math.floor(Number(file.sizeBytes ?? 0))
    if (!file.name || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return json({ error: 'invalid_file_entry' }, { status: 400, headers })
    }
    if (sizeBytes > VAULT_MAX_FILE_BYTES) {
      return json({ error: `${file.name} exceeds the 1 GB Vault Drive limit.` }, { status: 413, headers })
    }
    totalBytes += sizeBytes
  }

  const usedBytes = await readQuotaUsage(env, sessionOrError.sub)
  if (usedBytes + totalBytes > VAULT_DAILY_QUOTA_BYTES) {
    return json({
      error: 'daily_quota_exceeded',
      usedBytes,
      quotaBytes: VAULT_DAILY_QUOTA_BYTES,
      remainingBytes: Math.max(0, VAULT_DAILY_QUOTA_BYTES - usedBytes),
    }, { status: 429, headers })
  }

  return json({
    ok: true,
    usedBytes,
    quotaBytes: VAULT_DAILY_QUOTA_BYTES,
    remainingBytes: VAULT_DAILY_QUOTA_BYTES - usedBytes,
  }, { headers })
}

async function handleVaultDriveFinalize(request: Request, env: Env): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)
  const sessionOrError = await requireDriveSession(request, env, headers)
  if (sessionOrError instanceof Response) return sessionOrError

  let body: {
    rootFolderName?: string
    folder?: Partial<VaultDriveFolderInput>
    files?: Partial<VaultDriveFileInput>[]
  }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, { status: 400, headers })
  }

  const filesInput = Array.isArray(body.files) ? body.files : []
  if (filesInput.length === 0) {
    return json({ error: 'files_required' }, { status: 400, headers })
  }

  const files: VaultDriveSessionFileRecord[] = []
  let totalBytes = 0
  for (const file of filesInput) {
    const id = typeof file.id === 'string' ? file.id.trim() : ''
    const name = typeof file.name === 'string' ? file.name.trim() : ''
    const mimeType = typeof file.mimeType === 'string' ? file.mimeType.trim() : 'application/octet-stream'
    const webViewLink = typeof file.webViewLink === 'string' ? file.webViewLink.trim() : ''
    const directLink = typeof file.directLink === 'string' ? file.directLink.trim() : ''
    const sizeBytes = Math.floor(Number(file.sizeBytes ?? 0))

    if (!id || !name || !webViewLink || !directLink || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return json({ error: 'invalid_file_entry' }, { status: 400, headers })
    }
    if (sizeBytes > VAULT_MAX_FILE_BYTES) {
      return json({ error: `${name} exceeds the 1 GB Vault Drive limit.` }, { status: 413, headers })
    }

    totalBytes += sizeBytes
    const shareId = randomHex(16)
    files.push({
      id,
      name,
      sizeBytes,
      mimeType,
      webViewLink,
      directLink,
      shareId,
      code: shareId.slice(0, 8),
    })
  }

  const usedBytes = await readQuotaUsage(env, sessionOrError.sub)
  if (usedBytes + totalBytes > VAULT_DAILY_QUOTA_BYTES) {
    return json({
      error: 'daily_quota_exceeded',
      usedBytes,
      quotaBytes: VAULT_DAILY_QUOTA_BYTES,
      remainingBytes: Math.max(0, VAULT_DAILY_QUOTA_BYTES - usedBytes),
    }, { status: 429, headers })
  }

  const folderId = typeof body.folder?.id === 'string' ? body.folder.id.trim() : ''
  const folderName = typeof body.folder?.name === 'string' ? body.folder.name.trim() : ''
  const folderWebViewLink = typeof body.folder?.webViewLink === 'string' ? body.folder.webViewLink.trim() : ''
  const folderDirectLink = typeof body.folder?.directLink === 'string' ? body.folder.directLink.trim() : folderWebViewLink

  if (!folderId || !folderName || !folderWebViewLink) {
    return json({ error: 'folder_required_for_drive_session' }, { status: 400, headers })
  }

  const folderShareId = randomHex(16)
  const folder: VaultDriveSessionFolderRecord = {
    id: folderId,
    name: folderName,
    webViewLink: folderWebViewLink,
    directLink: folderDirectLink,
    shareId: folderShareId,
    code: folderShareId.slice(0, 8),
  }

  const now = Date.now()
  const sessionRecord: VaultDriveSessionRecord = {
    id: randomHex(12),
    ownerSub: sessionOrError.sub,
    email: sessionOrError.email,
    displayName: sessionOrError.displayName,
    createdAt: now,
    deleteAt: now + VAULT_SHARE_DELETE_AFTER_MS,
    totalBytes,
    rootFolderName: typeof body.rootFolderName === 'string' && body.rootFolderName.trim()
      ? body.rootFolderName.trim()
      : 'Clex Share',
    folder,
    files,
  }

  await storeVaultDriveSession(env, sessionRecord)
  await writeQuotaUsage(env, sessionOrError.sub, usedBytes + totalBytes)

  return json({ ok: true, session: sessionRecord }, { status: 201, headers })
}

async function handleVaultDriveSessionsList(request: Request, env: Env): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)
  const sessionOrError = await requireDriveSession(request, env, headers)
  if (sessionOrError instanceof Response) return sessionOrError

  const sessions = await listVaultDriveSessions(env, sessionOrError.sub)
  return json({ sessions }, { headers })
}

async function handleVaultDriveSessionDelete(request: Request, env: Env, sessionId: string): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)
  const sessionOrError = await requireDriveSession(request, env, headers)
  if (sessionOrError instanceof Response) return sessionOrError

  const session = await loadVaultDriveSession(env, sessionOrError.sub, sessionId)
  if (!session) {
    return json({ error: 'session_not_found' }, { status: 404, headers })
  }

  const accessToken = await getAccessTokenForAccount(env, session.ownerSub)
  if (accessToken) {
    await Promise.all(session.files.map(file => deleteDriveItem(accessToken, file.id)))
    if (session.folder) {
      await deleteDriveItem(accessToken, session.folder.id)
    }
  }

  await cleanupVaultDriveSession(env, session)
  return json({ ok: true }, { headers })
}

async function handleVaultDriveShareResolve(request: Request, env: Env, token: string): Promise<Response> {
  const headers = withNoStore(new Headers())
  appendCors(headers, request, env)

  const share = await resolveVaultShare(env, token)
  if (!share) {
    return json({
      error: 'share_not_found',
      deprecated: true,
      message: 'This Vault link is expired or was created on the retired Supabase relay path.',
    }, { status: 404, headers })
  }

  if (share.deleteAt <= Date.now()) {
    return json({
      error: 'share_expired',
      deprecated: false,
      message: 'This Vault Drive share expired and was removed automatically.',
    }, { status: 410, headers })
  }

  return json({ share }, { headers })
}

async function cleanupExpiredVaultDriveSessions(env: Env): Promise<void> {
  const sessionKeys = await listAllKeys(env, VAULT_SESSION_PREFIX)
  const now = Date.now()
  const accessTokenCache = new Map<string, string | null>()

  for (const key of sessionKeys) {
    const session = await kvGetJson<VaultDriveSessionRecord>(env, key)
    if (!session || session.deleteAt > now) continue

    let accessToken = accessTokenCache.get(session.ownerSub)
    if (typeof accessToken === 'undefined') {
      accessToken = await getAccessTokenForAccount(env, session.ownerSub)
      accessTokenCache.set(session.ownerSub, accessToken)
    }

    if (accessToken) {
      await Promise.all(session.files.map(file => deleteDriveItem(accessToken!, file.id)))
      if (session.folder) {
        await deleteDriveItem(accessToken, session.folder.id)
      }
    }

    await cleanupVaultDriveSession(env, session)
  }
}

async function dispatch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      const headers = new Headers()
      appendCors(headers, request, env)
      return new Response(null, { status: 204, headers })
    }

    // ─── Operator dashboard (HTML SPA at api.clex.in/dashboard) ──────
    // The dashboard is the canonical UI for managing Clex API keys and
    // watching live metrics. Lives at /dashboard so it can also be
    // mounted under clex.in/api on the same worker if api.clex.in isn't
    // routed yet.
    if (
      (url.pathname === '/dashboard' || url.pathname === '/dashboard/') &&
      request.method === 'GET'
    ) {
      return handleDashboard(request, env)
    }
    // On the api.clex.in hostname, treat the bare root as the dashboard
    // entry point (clex.in's marketing site already lives on the apex).
    if (url.pathname === '/' && request.method === 'GET' && url.hostname.startsWith('api.')) {
      return handleDashboard(request, env)
    }

    // ─── API key management ───────────────────────────────────────────
    if (url.pathname === '/api/keys' && request.method === 'GET') {
      return handleListKeys(request, env)
    }
    if (url.pathname === '/api/keys' && request.method === 'POST') {
      return handleMintKey(request, env)
    }
    if (url.pathname === '/api/keys/usage' && request.method === 'GET') {
      return handleKeyUsage(request, env)
    }
    const keyMatch = url.pathname.match(/^\/api\/keys\/([A-Za-z0-9]+)$/)
    if (keyMatch && request.method === 'DELETE') {
      return handleRevokeKey(request, env, keyMatch[1])
    }

    // Public liveness probe consumed by lnch.in's LaunchOps health probe and
    // by external uptime monitors. Cheap, never reveals secrets.
    if (
      (url.pathname === '/api/health' || url.pathname === '/health') &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      const body = JSON.stringify({
        ok: true,
        service: 'clex-api',
        ts: Math.floor(Date.now() / 1000),
        version: 'phase-2-admin-api',
        bindings: {
          kv: typeof (env as { DRIVE_SESSION_STORE?: { put?: unknown } }).DRIVE_SESSION_STORE?.put === 'function',
        },
      })
      const headers = new Headers({
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=10, s-maxage=30',
      })
      appendCors(headers, request, env)
      return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers })
    }

    // ─── Public file-transfer API (clex.in/api/transfers) ─────────────
    // Stable shape that powers the upcoming `clex` CLI and any third-party
    // integrator. Storage is KV-backed; the actual file movement happens
    // browser-to-browser via the signaling worker. See apps/api/src/transfers.ts.
    if (url.pathname === '/api/transfers' && request.method === 'POST') {
      return handleCreateTransfer(request, env)
    }
    const transfersMatch = url.pathname.match(/^\/api\/transfers\/([A-Za-z0-9]+)(\/events)?$/)
    if (transfersMatch) {
      const codeOrId = transfersMatch[1]
      const isEventsSub = Boolean(transfersMatch[2])
      if (isEventsSub) {
        if (request.method === 'POST') return handleAppendEvent(request, env, codeOrId)
        return new Response('Method not allowed', { status: 405 })
      }
      if (request.method === 'GET') return handleGetTransfer(request, env, codeOrId)
      if (request.method === 'DELETE') return handleCancelTransfer(request, env, codeOrId)
      return new Response('Method not allowed', { status: 405 })
    }

    // ─── Admin ────────────────────────────────────────────────────────
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env)
    }
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
      return handleAdminLogout(request, env)
    }
    if (url.pathname === '/api/admin/me' && request.method === 'GET') {
      return handleAdminMe(request, env)
    }
    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      return handleAdminUsers(request, env)
    }
    const adminUserMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
    if (adminUserMatch && request.method === 'GET') {
      return handleAdminUserDetail(request, env, decodeURIComponent(adminUserMatch[1]))
    }
    if (url.pathname === '/api/admin/feeds' && request.method === 'GET') {
      return handleAdminFeed(request, env)
    }
    if (url.pathname === '/api/admin/login/passkey/begin' && request.method === 'POST') {
      return handlePasskeyLoginBegin(request, env)
    }
    if (url.pathname === '/api/admin/login/passkey/finish' && request.method === 'POST') {
      return handlePasskeyLoginFinish(request, env)
    }
    if (url.pathname === '/api/admin/passkeys/register/begin' && request.method === 'POST') {
      return handlePasskeyRegisterBegin(request, env)
    }
    if (url.pathname === '/api/admin/passkeys/register/finish' && request.method === 'POST') {
      return handlePasskeyRegisterFinish(request, env)
    }
    if (url.pathname === '/api/admin/passkeys' && request.method === 'GET') {
      return handlePasskeys(request, env)
    }
    const passkeyMatch = url.pathname.match(/^\/api\/admin\/passkeys\/([A-Za-z0-9]+)$/)
    if (passkeyMatch && request.method === 'DELETE') {
      return handlePasskeyRevoke(request, env, passkeyMatch[1])
    }
    if (url.pathname === '/api/admin/summary' && request.method === 'GET') {
      return handleAdminSummary(request, env)
    }
    if (url.pathname === '/api/admin/transfers' && request.method === 'GET') {
      return handleAdminTransfers(request, env)
    }
    if (url.pathname === '/api/admin/health' && request.method === 'GET') {
      return handleAdminHealth(request, env)
    }
    if (url.pathname === '/api/admin/audit' && request.method === 'GET') {
      return handleAdminAudit(request, env)
    }
    if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
      return handleAdminStats(request, env)
    }

    if (url.pathname === '/api/auth/google/status' && request.method === 'GET') {
      return handleGoogleStatus(request, env)
    }

    if (url.pathname === '/api/auth/google' && request.method === 'GET') {
      return handleGoogleAuthStart(request, env)
    }

    if (url.pathname === '/api/auth/google/callback' && request.method === 'GET') {
      return handleGoogleAuthCallback(request, env)
    }

    if (url.pathname === TOKEN_PICKUP_PATH && request.method === 'GET') {
      return handleDriveTokenPickup(request, env)
    }

    if (url.pathname === '/api/auth/gdrive/session') {
      if (request.method === 'GET') return handleDriveSessionGet(request, env)
      if (request.method === 'DELETE') return handleDriveSessionDelete(request, env)
      return new Response('Method not allowed', { status: 405 })
    }

    if (url.pathname === '/api/drive/vault/preflight' && request.method === 'POST') {
      return handleVaultDrivePreflight(request, env)
    }

    if (url.pathname === '/api/drive/vault/finalize' && request.method === 'POST') {
      return handleVaultDriveFinalize(request, env)
    }

    if (url.pathname === '/api/drive/vault/sessions' && request.method === 'GET') {
      return handleVaultDriveSessionsList(request, env)
    }

    const vaultSessionMatch = url.pathname.match(/^\/api\/drive\/vault\/sessions\/([a-f0-9]+)$/i)
    if (vaultSessionMatch) {
      if (request.method === 'DELETE') {
        return handleVaultDriveSessionDelete(request, env, vaultSessionMatch[1].toLowerCase())
      }
      return new Response('Method not allowed', { status: 405 })
    }

    const vaultShareMatch = url.pathname.match(/^\/api\/drive\/vault\/share\/([a-z0-9]+)$/i)
    if (vaultShareMatch && request.method === 'GET') {
      return handleVaultDriveShareResolve(request, env, vaultShareMatch[1])
    }

    return new Response('Not found', { status: 404 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const t0 = Date.now()
    const res = await dispatch(request, env)
    // Bucket the metrics route by the static prefix so we don't blow out
    // the per-route map with one entry per transfer-id. The transfer-id
    // segment is stripped to `/api/transfers/:id`.
    const route = url.pathname
      .replace(/^\/api\/transfers\/[A-Za-z0-9]+(\/events)?$/, '/api/transfers/:id$1')
    bumpMetric(route, res.status, Date.now() - t0)
    return res
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await cleanupExpiredVaultDriveSessions(env)
  },
} satisfies ExportedHandler<Env>
