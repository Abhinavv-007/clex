import { PDFDocument } from 'pdf-lib'

function toBlobBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = Uint8Array.from(bytes)
  return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer
}

export async function mergePdfs(
  files: File[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const merged = await PDFDocument.create()
  const step = 100 / (files.length + 1)
  let done = 0

  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(page => merged.addPage(page))
    done += step
    onProgress?.(Math.round(done))
  }

  onProgress?.(95)
  const pdfBytes = await merged.save()
  onProgress?.(100)
  return new Blob([toBlobBytes(pdfBytes)], { type: 'application/pdf' })
}
