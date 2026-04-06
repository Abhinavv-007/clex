function createDownloadAnchor(blob: Blob, filename: string): HTMLAnchorElement {
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  return anchor
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return

  const anchor = createDownloadAnchor(blob, filename)
  document.body.appendChild(anchor)
  anchor.click()

  window.setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(anchor.href)
  }, 1000)
}

export async function saveBlobWithSystemFallback(
  blob: Blob,
  filename: string,
  mimeType = blob.type || 'application/octet-stream'
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'cancelled'
  }

  const file = new File([blob], filename, { type: mimeType })
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[]; title?: string }) => boolean
  }
  const shareData = { files: [file], title: filename }

  if (typeof nav.share === 'function') {
    try {
      if (!nav.canShare || nav.canShare(shareData)) {
        await nav.share(shareData)
        return 'shared'
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  triggerBlobDownload(blob, filename)
  return 'downloaded'
}
