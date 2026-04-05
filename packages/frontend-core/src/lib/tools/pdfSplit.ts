import { PDFDocument } from 'pdf-lib'

function toBlobBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = Uint8Array.from(bytes)
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer
}

export interface SplitResult {
  blob: Blob
  name: string
  pageRange: [number, number]
}

/**
 * Split a PDF into one file per page.
 */
export async function splitPdfByPage(
  file: File,
  onProgress?: (pct: number) => void
): Promise<SplitResult[]> {
  const bytes = await file.arrayBuffer()
  const src = await PDFDocument.load(bytes)
  const total = src.getPageCount()
  const results: SplitResult[] = []
  const baseName = file.name.replace(/\.pdf$/i, '')

  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create()
    const [page] = await doc.copyPages(src, [i])
    doc.addPage(page)
    const pdfBytes = await doc.save()
    results.push({
      blob: new Blob([toBlobBytes(pdfBytes)], { type: 'application/pdf' }),
      name: `${baseName}_page${i + 1}.pdf`,
      pageRange: [i + 1, i + 1],
    })
    onProgress?.(Math.round(((i + 1) / total) * 100))
  }

  return results
}

/**
 * Split a PDF into chunks of N pages.
 */
export async function splitPdfByChunk(
  file: File,
  chunkSize: number,
  onProgress?: (pct: number) => void
): Promise<SplitResult[]> {
  const bytes = await file.arrayBuffer()
  const src = await PDFDocument.load(bytes)
  const total = src.getPageCount()
  const results: SplitResult[] = []
  const baseName = file.name.replace(/\.pdf$/i, '')
  let part = 0

  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total)
    const indices = Array.from({ length: end - start }, (_, i) => start + i)
    const doc = await PDFDocument.create()
    const pages = await doc.copyPages(src, indices)
    pages.forEach(p => doc.addPage(p))
    const pdfBytes = await doc.save()
    part++
    results.push({
      blob: new Blob([toBlobBytes(pdfBytes)], { type: 'application/pdf' }),
      name: `${baseName}_part${part}.pdf`,
      pageRange: [start + 1, end],
    })
    onProgress?.(Math.round((end / total) * 100))
  }

  return results
}
