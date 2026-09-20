/**
 * Where the CLI keeps its API key.
 *
 * Resolution order, highest priority first:
 *   1. --key on the command line   (handy for one-off / CI overrides)
 *   2. $CLEX_API_KEY               (the documented way to do it in CI)
 *   3. ~/.config/clex/config.json  (written by `clex login`)
 *
 * The config file holds a credential, so it is written 0600 and its directory
 * 0700. We never log the key itself — only a masked prefix.
 */
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const DEFAULT_API_BASE = 'https://clex.in/vault/api'

export function configPath() {
  // Respect XDG when it's set; fall back to ~/.config on every platform so
  // the path is predictable in docs and scripts.
  const base = process.env.CLEX_CONFIG_HOME
    || process.env.XDG_CONFIG_HOME
    || join(homedir(), '.config')
  return join(base, 'clex', 'config.json')
}

export async function readConfig() {
  try {
    const raw = await readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    if (err?.code === 'ENOENT') return {}
    // A corrupt config shouldn't wedge the CLI — report and carry on unset.
    if (err instanceof SyntaxError) return {}
    throw err
  }
}

export async function writeConfig(patch) {
  const path = configPath()
  const current = await readConfig()
  const next = { ...current, ...patch }

  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  // mkdir/writeFile honour `mode` only on creation, so re-assert it in case
  // the file already existed with looser permissions.
  await chmod(path, 0o600).catch(() => {})
  return next
}

export async function clearConfig() {
  await rm(configPath(), { force: true })
}

/**
 * @param {{ key?: string }} flags
 * @returns {Promise<{ apiKey: string｜'', apiBase: string, source: string }>}
 */
export async function resolveCredentials(flags = {}) {
  const file = await readConfig()

  if (flags.key) return { apiKey: flags.key, apiBase: apiBaseFrom(flags, file), source: '--key' }
  if (process.env.CLEX_API_KEY) {
    return { apiKey: process.env.CLEX_API_KEY, apiBase: apiBaseFrom(flags, file), source: 'CLEX_API_KEY' }
  }
  if (file.apiKey) {
    return { apiKey: file.apiKey, apiBase: apiBaseFrom(flags, file), source: configPath() }
  }
  return { apiKey: '', apiBase: apiBaseFrom(flags, file), source: 'none' }
}

function apiBaseFrom(flags, file) {
  const base = flags.api || process.env.CLEX_API_BASE || file.apiBase || DEFAULT_API_BASE
  return String(base).replace(/\/+$/, '')
}

/** `clex_abcd…wxyz` — enough to recognise a key without disclosing it. */
export function maskKey(key) {
  if (!key) return '(none)'
  if (key.length <= 14) return `${key.slice(0, 6)}…`
  return `${key.slice(0, 10)}…${key.slice(-4)}`
}
