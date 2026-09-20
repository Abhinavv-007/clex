import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const CLI = new URL('../bin/clex.js', import.meta.url).pathname

// ── pure helpers ────────────────────────────────────────────────────────────

const { parseDuration, shareTokenFrom } = await import('./commands.js')
const { maskKey } = await import('./config.js')
const { formatBytes, formatExpiry } = await import('./format.js')

describe('parseDuration', () => {
  it('reads bare seconds and suffixed units', () => {
    assert.equal(parseDuration('90'), 90)
    assert.equal(parseDuration('30s'), 30)
    assert.equal(parseDuration('30m'), 1800)
    assert.equal(parseDuration('12h'), 43200)
    assert.equal(parseDuration('7d'), 604800)
    assert.equal(parseDuration('12H'), 43200)
  })

  it('returns undefined when nothing was asked for', () => {
    assert.equal(parseDuration(undefined), undefined)
    assert.equal(parseDuration(''), undefined)
  })

  it('refuses input it cannot read rather than guessing', () => {
    assert.throws(() => parseDuration('soon'), /duration/i)
    assert.throws(() => parseDuration('-5m'), /duration/i)
    assert.throws(() => parseDuration('1.5h'), /duration/i)
  })
})

describe('shareTokenFrom', () => {
  it('passes a bare token through', () => {
    assert.equal(shareTokenFrom('4A3FSQ'), '4A3FSQ')
  })

  it('pulls the token out of share URLs', () => {
    assert.equal(shareTokenFrom('https://clex.in/share/4A3FSQ'), '4A3FSQ')
    assert.equal(shareTokenFrom('https://clex.in/share/4A3FSQ/'), '4A3FSQ')
    assert.equal(shareTokenFrom('https://clex.in/vault/api/uploads/4A3FSQ'), '4A3FSQ')
  })

  it('copes with a URL-shaped string that will not parse', () => {
    assert.equal(shareTokenFrom('clex.in/share/4A3FSQ'), '4A3FSQ')
  })

  it('is empty for empty input', () => {
    assert.equal(shareTokenFrom(''), '')
    assert.equal(shareTokenFrom(undefined), '')
  })
})

describe('maskKey', () => {
  it('never returns the whole key', () => {
    const key = 'clex_abcdefghijklmnopqrstuvwxyz'
    const masked = maskKey(key)
    assert.ok(!masked.includes('mnopqrstu'), 'middle of the key must not appear')
    assert.ok(masked.startsWith('clex_'))
    assert.ok(masked.length < key.length)
  })

  it('handles a short or missing key', () => {
    assert.equal(maskKey(''), '(none)')
    assert.ok(maskKey('clex_ab').endsWith('…'))
  })
})

describe('formatting', () => {
  it('scales byte counts', () => {
    assert.equal(formatBytes(0), '0 B')
    assert.equal(formatBytes(999), '999 B')
    assert.equal(formatBytes(1024), '1.0 KB')
    assert.equal(formatBytes(1024 * 1024 * 5.5), '5.5 MB')
    assert.equal(formatBytes(-1), 'unlimited')
  })

  it('renders expiry relative to now', () => {
    const now = Math.floor(Date.now() / 1000)
    assert.equal(formatExpiry(now - 60), 'expired')
    assert.match(formatExpiry(now + 1800), /^in \d+m$/)
    assert.match(formatExpiry(now + 7200), /^in \d+h$/)
    assert.match(formatExpiry(now + 86400 * 5), /^in \d+d$/)
  })
})

// ── end to end against a stub API ───────────────────────────────────────────

describe('clex against a stub API', () => {
  let server
  let base
  let home
  const received = []

  before(async () => {
    home = await mkdtemp(join(tmpdir(), 'clex-cli-test-'))

    server = createServer((req, res) => {
      const auth = req.headers.authorization || ''
      const send = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }

      // Share resolution is deliberately unauthenticated.
      if (req.method === 'GET' && /^\/uploads\/[A-Z0-9]+$/.test(req.url)) {
        const token = req.url.split('/').pop()
        if (token !== 'GOODTOKEN') return send(404, { error: 'Not found' })
        return send(200, {
          filename: 'hello.txt',
          sizeBytes: 12,
          downloadUrl: `${base}/blob`,
        })
      }

      if (req.url === '/blob') {
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': '12' })
        return res.end('hello world\n')
      }

      // Everything else needs the key.
      if (auth !== 'Bearer clex_testkey') {
        return send(401, { error: 'Invalid or revoked API key' })
      }

      if (req.method === 'POST' && req.url === '/uploads') {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          const body = Buffer.concat(chunks)
          received.push({
            filename: decodeURIComponent(req.headers['x-filename'] || ''),
            bytes: body.length,
            contentType: req.headers['content-type'],
            expiresIn: req.headers['x-expires-in'],
          })
          send(200, {
            id: 'up_test1',
            shareToken: 'GOODTOKEN',
            filename: decodeURIComponent(req.headers['x-filename'] || ''),
            sizeBytes: body.length,
            mimeType: req.headers['content-type'],
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            rate: { remaining: 59, limit: 60, resetSeconds: 42 },
          })
        })
        return undefined
      }

      if (req.method === 'GET' && req.url === '/uploads') {
        return send(200, {
          uploads: [{
            id: 'up_test1',
            filename: 'hello.txt',
            sizeBytes: 12,
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            downloadCount: 2,
            shareToken: 'GOODTOKEN',
          }],
        })
      }

      if (req.method === 'DELETE' && req.url.startsWith('/uploads/')) {
        return send(200, { ok: true })
      }

      return send(404, { error: 'Not found' })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  const env = () => ({
    ...process.env,
    CLEX_API_BASE: base,
    CLEX_CONFIG_HOME: home,
    CLEX_API_KEY: 'clex_testkey',
    NO_COLOR: '1',
  })

  it('sends a file and prints the share link', async () => {
    const file = join(home, 'hello.txt')
    await (await import('node:fs/promises')).writeFile(file, 'hello world\n')

    const { stdout } = await run(process.execPath, [CLI, 'send', file, '--quiet'], { env: env() })
    assert.match(stdout.trim(), /^https:\/\/clex\.in\/share\/GOODTOKEN$/)

    const last = received[received.length - 1]
    assert.equal(last.filename, 'hello.txt')
    assert.equal(last.bytes, 12)
    assert.equal(last.contentType, 'text/plain')
  })

  it('passes --expires through as seconds', async () => {
    const file = join(home, 'hello.txt')
    await run(process.execPath, [CLI, 'send', file, '--expires', '2h', '-q'], { env: env() })
    assert.equal(received[received.length - 1].expiresIn, '7200')
  })

  it('downloads by share token', async () => {
    const out = join(home, 'fetched.txt')
    const { stdout } = await run(
      process.execPath, [CLI, 'get', 'GOODTOKEN', '-o', out, '--quiet'], { env: env() })
    assert.equal(stdout.trim(), out)
    assert.equal(await readFile(out, 'utf8'), 'hello world\n')
    assert.equal((await stat(out)).size, 12)
  })

  it('accepts a full share URL as well as a token', async () => {
    const out = join(home, 'fetched2.txt')
    await run(
      process.execPath,
      [CLI, 'get', 'https://clex.in/share/GOODTOKEN', '-o', out, '-q'],
      { env: env() },
    )
    assert.equal(await readFile(out, 'utf8'), 'hello world\n')
  })

  it('lists uploads as JSON', async () => {
    const { stdout } = await run(process.execPath, [CLI, 'ls', '--json'], { env: env() })
    const rows = JSON.parse(stdout)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].filename, 'hello.txt')
  })

  it('removes an upload', async () => {
    const { stdout } = await run(process.execPath, [CLI, 'rm', 'up_test1'], { env: env() })
    assert.match(stdout, /removed/)
  })

  it('reports a bad key clearly instead of a raw status code', async () => {
    const bad = { ...env(), CLEX_API_KEY: 'clex_wrong' }
    const err = await run(process.execPath, [CLI, 'ls'], { env: bad }).catch((e) => e)
    assert.equal(err.code, 1)
    assert.match(err.stderr, /Invalid or revoked API key/)
  })

  it('explains how to authenticate when no key is set at all', async () => {
    const none = { ...env() }
    delete none.CLEX_API_KEY
    const err = await run(process.execPath, [CLI, 'ls'], { env: none }).catch((e) => e)
    assert.equal(err.code, 1)
    assert.match(err.stderr, /No API key/)
    assert.match(err.stderr, /clex login/)
  })

  it('exits 2 on an unknown command rather than doing something surprising', async () => {
    const err = await run(process.execPath, [CLI, 'frobnicate'], { env: env() }).catch((e) => e)
    assert.equal(err.code, 2)
    assert.match(err.stderr, /Unknown command/)
  })

  it('reports a missing local file without aborting the whole run', async () => {
    const good = join(home, 'hello.txt')
    const err = await run(
      process.execPath,
      [CLI, 'send', join(home, 'nope.txt'), good, '-q'],
      { env: env() },
    ).catch((e) => e)
    assert.equal(err.code, 1)              // one failure
    assert.match(err.stderr, /not found/)
    assert.match(err.stdout, /GOODTOKEN/)  // the other file still went
  })

  it('refuses a directory with a hint instead of a stack trace', async () => {
    const err = await run(process.execPath, [CLI, 'send', home, '-q'], { env: env() }).catch((e) => e)
    assert.equal(err.code, 1)
    assert.match(err.stderr, /is a directory/)
  })

  it('stores a verified key with owner-only permissions', async () => {
    const noKey = { ...env() }
    delete noKey.CLEX_API_KEY
    await run(process.execPath, [CLI, 'login', '--key', 'clex_testkey'], { env: noKey })

    const cfg = join(home, 'clex', 'config.json')
    const mode = (await stat(cfg)).mode & 0o777
    assert.equal(mode, 0o600, 'config holds a credential and must not be group/world readable')
    assert.equal(JSON.parse(await readFile(cfg, 'utf8')).apiKey, 'clex_testkey')
  })

  it('will not store a key the server rejects', async () => {
    const noKey = { ...env() }
    delete noKey.CLEX_API_KEY
    const err = await run(
      process.execPath, [CLI, 'login', '--key', 'clex_bogus'], { env: noKey }).catch((e) => e)
    assert.equal(err.code, 1)
  })
})
