import imageCompression from 'browser-image-compression'

export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  quality?: number
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const opts = {
    maxSizeMB: options.maxSizeMB ?? 1,
    maxWidthOrHeight: options.maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: options.quality ?? 0.8,
    onProgress,
  }

  const result = await imageCompression(file, opts)
  return result
}
