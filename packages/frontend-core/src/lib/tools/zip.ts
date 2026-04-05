import JSZip from 'jszip'

export async function zipFiles(
  files: { blob: Blob; name: string }[],
  zipName = 'clex-files.zip',
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const zip = new JSZip()

  // Add all files to zip
  for (const { blob, name } of files) {
    zip.file(name, blob)
  }

  // Generate with progress reporting
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    metadata => {
      onProgress?.(Math.round(metadata.percent))
    }
  )

  return blob
}
