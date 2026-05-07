export interface GoogleOAuthConfigStatus {
  configured: boolean
  missing: string[]
}

function hasConfiguredValue(value: string | undefined): boolean {
  if (!value) return false

  const normalized = value.trim()
  if (!normalized) return false

  return !/^your_[a-z0-9_]+$/i.test(normalized)
}

export function getGoogleOAuthConfigStatus(source: Record<string, string | undefined>): GoogleOAuthConfigStatus {
  const missing: string[] = []

  if (!hasConfiguredValue(source.GOOGLE_CLIENT_ID)) {
    missing.push('GOOGLE_CLIENT_ID')
  }
  if (!hasConfiguredValue(source.GOOGLE_CLIENT_SECRET)) {
    missing.push('GOOGLE_CLIENT_SECRET')
  }
  if (!hasConfiguredValue(source.GOOGLE_REDIRECT_URI)) {
    missing.push('GOOGLE_REDIRECT_URI')
  }

  return {
    configured: missing.length === 0,
    missing,
  }
}
