/** Command implementations. Each returns a process exit code. */
import { createWriteStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname, resolve as resolvePath } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { ClexApiError, deleteUpload, listUploads, resolveShare, uploadFile } from './api.js'
import { clearConfig, configPath, maskKey, readConfig, resolveCredentials, writeConfig } from './config.js'
import { bold, cyan, dim, formatBytes, formatExpiry, green, progress, red, table, yellow } from './format.js'

const SHARE_BASE = 'https://clex.in/share'

/** Minimal extension → MIME map; anything unknown ships as octet-stream. */
const MIME = {
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
  '.json': 'application/json', '.xml': 'application/xml', '.html': 'text/html',
  '.pdf': 'application/pdf', '.zip': 'application/zip', '.gz': 'application/gzip',
  '.tar': 'application/x-tar', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const mimeFor = (name) => MIME[extname(name).toLowerCase()] || 'application/octet-stream'

function requireKey(creds) {
  if (creds.apiKey) return null
  process.stderr.write(
    `${red('No API key.')}\n` +
    `  Create one at ${cyan('https://clex.in/developers')}, then either:\n` +
    `    ${bold('clex login')}                 store it in ${dim(configPath())}\n` +
    `    ${bold('export CLEX_API_KEY=clex_…')}  use it for this shell only\n`,
  )
  return 1
}

/** Accepts "1h", "30m", "7d", or a bare number of seconds. */
export function parseDuration(input) {
  if (input === undefined || input === null || input === '') return undefined
  const match = String(input).trim().match(/^(\d+)\s*([smhd]?)$/i)
  if (!match) throw new Error(`Cannot read "${input}" as a duration. Try 30m, 12h or 7d.`)
  const n = Number(match[1])
  const unit = (match[2] || 's').toLowerCase()
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit]
  return n * factor
}

/** Pulls the share token out of a token, a /share/ URL, or an api URL. */
export function shareTokenFrom(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  if (!raw.includes('/')) return raw
  try {
    const segments = new URL(raw).pathname.split('/').filter(Boolean)
    return segments[segments.length - 1] || ''
  } catch {
    const segments = raw.split('/').filter(Boolean)
    return segments[segments.length - 1] || ''
  }
}

// ── send ────────────────────────────────────────────────────────────────────

export async function cmdSend(files, flags) {
  const creds = await resolveCredentials(flags)
  const missing = requireKey(creds)
  if (missing) return missing

  if (files.length === 0) {
    process.stderr.write(`${red('Nothing to send.')} Usage: clex send <file> [file…]\n`)
    return 2
  }

  let expiresIn
  try {
    expiresIn = parseDuration(flags.expires)
  } catch (err) {
    process.stderr.write(`${red(err.message)}\n`)
    return 2
  }

  let failures = 0
  for (const file of files) {
    const path = resolvePath(file)
    let info
    try {
      info = await stat(path)
    } catch {
      process.stderr.write(`${red('not found')}  ${file}\n`)
      failures += 1
      continue
    }
    if (info.isDirectory()) {
      process.stderr.write(
        `${red('is a directory')}  ${file}${dim(' — archive it first, e.g. tar -czf out.tgz ' + file)}\n`,
      )
      failures += 1
      continue
    }

    const name = basename(path)
    const bar = progress(`  ${name}`)
    try {
      // Read fully: the worker wants a known Content-Length, and the per-key
      // ceiling keeps this well inside memory.
      const bytes = await readFile(path)
      bar.update(0.35)
      const result = await uploadFile({
        apiBase: creds.apiBase,
        apiKey: creds.apiKey,
        filename: name,
        bytes,
        mimeType: mimeFor(name),
        expiresIn,
      })
      bar.update(1)
      bar.done()

      const url = result.shareToken ? `${SHARE_BASE}/${result.shareToken}` : result.downloadUrl
      if (flags.json) {
        process.stdout.write(`${JSON.stringify({ ...result, shareUrl: url })}\n`)
      } else if (flags.quiet) {
        process.stdout.write(`${url}\n`)
      } else {
        process.stdout.write(
          `${green('✓')} ${bold(name)} ${dim(`(${formatBytes(result.sizeBytes ?? info.size)})`)}\n` +
          `  ${cyan(url)}\n` +
          `  ${dim(`expires ${formatExpiry(result.expiresAt)}`)}\n`,
        )
        if (result.rate && result.rate.limit > 0 && result.rate.remaining <= 5) {
          process.stderr.write(
            `  ${yellow(`${result.rate.remaining} of ${result.rate.limit} requests left this minute`)}\n`,
          )
        }
      }
    } catch (err) {
      bar.done()
      process.stderr.write(`${red('✗')} ${name}: ${err.message}\n`)
      failures += 1
    }
  }

  return failures === 0 ? 0 : 1
}

// ── get ─────────────────────────────────────────────────────────────────────

export async function cmdGet(target, flags) {
  if (!target) {
    process.stderr.write(`${red('Nothing to fetch.')} Usage: clex get <share-token|url>\n`)
    return 2
  }
  const token = shareTokenFrom(target)
  if (!token) {
    process.stderr.write(`${red(`Could not read a share token from "${target}".`)}\n`)
    return 2
  }

  const creds = await resolveCredentials(flags)
  let meta
  try {
    meta = await resolveShare({ apiBase: creds.apiBase, token })
  } catch (err) {
    process.stderr.write(
      `${red('✗')} ${err instanceof ClexApiError && err.status === 404
        ? 'That share link has expired or was revoked.'
        : err.message}\n`,
    )
    return 1
  }

  const url = meta.downloadUrl || meta.signedUrl
  if (!url) {
    process.stderr.write(`${red('✗')} The server did not return a download URL.\n`)
    return 1
  }

  const outPath = resolvePath(flags.output || meta.filename || token)
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    process.stderr.write(`${red('✗')} Download failed (HTTP ${res.status}).\n`)
    return 1
  }

  const total = Number(res.headers.get('content-length') || meta.sizeBytes || 0)
  const bar = progress(`  ${basename(outPath)}`)
  let received = 0
  const counter = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength
      if (total) bar.update(received / total)
      controller.enqueue(chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(res.body.pipeThrough(counter)), createWriteStream(outPath))
  } catch (err) {
    bar.done()
    process.stderr.write(`${red('✗')} Could not write ${outPath}: ${err.message}\n`)
    return 1
  }
  bar.done()

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ path: outPath, bytes: received, filename: meta.filename })}\n`)
  } else if (flags.quiet) {
    process.stdout.write(`${outPath}\n`)
  } else {
    process.stdout.write(`${green('✓')} ${bold(outPath)} ${dim(`(${formatBytes(received)})`)}\n`)
  }
  return 0
}

// ── ls ──────────────────────────────────────────────────────────────────────

export async function cmdList(flags) {
  const creds = await resolveCredentials(flags)
  const missing = requireKey(creds)
  if (missing) return missing

  let data
  try {
    data = await listUploads({ apiBase: creds.apiBase, apiKey: creds.apiKey })
  } catch (err) {
    process.stderr.write(`${red('✗')} ${err.message}\n`)
    return 1
  }

  const uploads = data?.uploads ?? []
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(uploads)}\n`)
    return 0
  }
  if (uploads.length === 0) {
    process.stdout.write(`${dim('No active uploads.')}\n`)
    return 0
  }

  process.stdout.write(
    `${table(
      ['ID', 'FILE', 'SIZE', 'EXPIRES', 'GETS', 'LINK'],
      uploads.map((u) => [
        u.id,
        u.filename,
        formatBytes(u.sizeBytes),
        formatExpiry(u.expiresAt),
        String(u.downloadCount ?? 0),
        u.shareUrl || `${SHARE_BASE}/${u.shareToken}`,
      ]),
    )}\n`,
  )
  return 0
}

// ── rm ──────────────────────────────────────────────────────────────────────

export async function cmdRemove(ids, flags) {
  const creds = await resolveCredentials(flags)
  const missing = requireKey(creds)
  if (missing) return missing

  if (ids.length === 0) {
    process.stderr.write(`${red('Nothing to remove.')} Usage: clex rm <id> [id…]\n`)
    return 2
  }

  let failures = 0
  for (const id of ids) {
    try {
      await deleteUpload({ apiBase: creds.apiBase, apiKey: creds.apiKey, id })
      if (!flags.quiet) process.stdout.write(`${green('✓')} removed ${bold(id)}\n`)
    } catch (err) {
      process.stderr.write(`${red('✗')} ${id}: ${err.message}\n`)
      failures += 1
    }
  }
  return failures === 0 ? 0 : 1
}

// ── login / logout / whoami ─────────────────────────────────────────────────

export async function cmdLogin(flags) {
  let key = flags.key || ''

  if (!key) {
    if (!process.stdin.isTTY) {
      process.stderr.write(
        `${red('No key given.')} Pipe one in with --key, or run interactively.\n`,
      )
      return 2
    }
    process.stdout.write(
      `Create a key at ${cyan('https://clex.in/developers')} (sign in with Google).\n`,
    )
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      key = (await rl.question('Paste your API key: ')).trim()
    } finally {
      rl.close()
    }
  }

  if (!key.startsWith('clex_')) {
    process.stderr.write(`${red('That does not look like a Clex API key — they start with "clex_".')}\n`)
    return 2
  }

  // Prove the key works before saving it, so a typo fails here rather than at
  // the next upload.
  try {
    await listUploads({ apiBase: (await resolveCredentials(flags)).apiBase, apiKey: key })
  } catch (err) {
    process.stderr.write(`${red('✗')} ${err.message}\n`)
    return 1
  }

  await writeConfig({ apiKey: key, ...(flags.api ? { apiBase: flags.api } : {}) })
  process.stdout.write(
    `${green('✓')} Saved ${bold(maskKey(key))} to ${dim(configPath())}\n`,
  )
  return 0
}

export async function cmdLogout() {
  await clearConfig()
  process.stdout.write(`${green('✓')} Signed out — ${dim(configPath())} removed.\n`)
  return 0
}

export async function cmdWhoami(flags) {
  const creds = await resolveCredentials(flags)
  if (!creds.apiKey) {
    process.stdout.write(`${dim('Not signed in.')} Run ${bold('clex login')}.\n`)
    return 1
  }

  const file = await readConfig()
  process.stdout.write(
    `key      ${bold(maskKey(creds.apiKey))}\n` +
    `source   ${creds.source}\n` +
    `endpoint ${creds.apiBase}\n` +
    (file.apiBase ? `config   ${configPath()}\n` : ''),
  )

  try {
    const data = await listUploads({ apiBase: creds.apiBase, apiKey: creds.apiKey })
    process.stdout.write(`status   ${green('valid')} · ${data?.uploads?.length ?? 0} active upload(s)\n`)
    return 0
  } catch (err) {
    process.stdout.write(`status   ${red('rejected')} — ${err.message}\n`)
    return 1
  }
}
