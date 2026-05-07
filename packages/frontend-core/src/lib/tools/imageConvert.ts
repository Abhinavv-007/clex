export type ImageOutputFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

export async function convertImageFormat(
  file: File,
  targetFormat: ImageOutputFormat,
  quality = 0.92
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await canvas.convertToBlob({ type: targetFormat, quality })
  return blob
}

export function formatToExtension(format: ImageOutputFormat): string {
  const map: Record<ImageOutputFormat, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  }
  return map[format]
}

export function swapExtension(fileName: string, newExt: string): string {
  const base = fileName.replace(/\.[^.]+$/, '')
  return `${base}.${newExt}`
}
