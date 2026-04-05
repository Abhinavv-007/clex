import * as PDFJS from 'pdfjs-dist'

// Point the worker at the CDN (avoids bundler issues with pdfjs worker file)
if (typeof window !== 'undefined') {
  PDFJS.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS.version}/pdf.worker.min.mjs`
}

export interface PageImage {
  blob: Blob
  name: string
  pageNumber: number
}

export async function pdfToImages(
  file: File,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
  scale = 2,
  onProgress?: (pct: number) => void
): Promise<PageImage[]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise
  const total = pdf.numPages
  const results: PageImage[] = []
  const baseName = file.name.replace(/\.pdf$/i, '')
  const ext = format === 'image/jpeg' ? 'jpg' : 'png'

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => {
        if (b) resolve(b)
        else reject(new Error('Canvas to blob failed'))
      }, format, format === 'image/jpeg' ? 0.92 : undefined)
    })

    results.push({ blob, name: `${baseName}_p${pageNum}.${ext}`, pageNumber: pageNum })
    onProgress?.(Math.round((pageNum / total) * 100))
  }

  return results
}
