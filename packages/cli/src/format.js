/** Small presentation helpers. No dependencies; colour degrades to plain text. */

const useColour =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb' &&
  process.stdout.isTTY === true

const wrap = (code) => (s) => (useColour ? `\u001b[${code}m${s}\u001b[0m` : String(s))

export const bold = wrap('1')
export const dim = wrap('2')
export const red = wrap('31')
export const green = wrap('32')
export const yellow = wrap('33')
export const cyan = wrap('36')

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 0) return 'unlimited'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const decimals = unit === 0 || value >= 100 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unit]}`
}

/** "in 23h", "in 4d", "expired" — relative to now, from a unix-seconds stamp. */
export function formatExpiry(expiresAtSeconds) {
  if (!Number.isFinite(expiresAtSeconds)) return '—'
  const deltaMs = expiresAtSeconds * 1000 - Date.now()
  if (deltaMs <= 0) return 'expired'
  const minutes = Math.round(deltaMs / 60000)
  if (minutes < 60) return `in ${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `in ${hours}h`
  return `in ${Math.round(hours / 24)}d`
}

/**
 * Renders rows as an aligned table. Columns are sized to their widest cell so
 * output stays readable when piped through `less`.
 *
 * @param {string[]} headers
 * @param {string[][]} rows
 */
export function table(headers, rows) {
  if (rows.length === 0) return ''
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)))

  const line = (cells, style = (s) => s) =>
    cells.map((c, i) => style(String(c ?? '').padEnd(widths[i]))).join('  ').trimEnd()

  return [line(headers, dim), ...rows.map((r) => line(r))].join('\n')
}

/**
 * A single-line progress indicator that only draws on a TTY — piped or
 * redirected output stays clean.
 */
export function progress(label) {
  if (!process.stdout.isTTY) {
    return { update() {}, done() {} }
  }
  let last = 0
  return {
    update(fraction) {
      const now = Date.now()
      if (now - last < 80 && fraction < 1) return
      last = now
      const width = 24
      const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width)
      const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
      process.stdout.write(`\r${label} ${bar} ${Math.round(fraction * 100)}%`)
    },
    done() {
      process.stdout.write(`\r${' '.repeat(label.length + 34)}\r`)
    },
  }
}
