/**
 * Small guards shared by the upload routes.
 */

/**
 * Reads an `X-Filename` header: URL-decoded when it can be, kept as sent when
 * it is not valid percent-encoding (decodeURIComponent throws on a stray `%`,
 * which used to crash the request into a CORS-less 500), and reduced to a
 * plain file name — no directories, no control characters.
 */
export function readFilename(raw: string | null): string | null {
  if (!raw) return null
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    // keep the raw header
  }
  name = name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split(/[\\/]/)
    .pop()!
    .trim()
    .slice(0, 255)
  if (!name || name === '.' || name === '..') return null
  return name
}

/** True when the declared body is larger than `max` bytes. */
export function tooLarge(req: Request, max: number): boolean {
  const declared = Number(req.headers.get('Content-Length'))
  return Number.isFinite(declared) && declared > max
}
