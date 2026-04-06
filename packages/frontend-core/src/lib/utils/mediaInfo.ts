import { formatDuration } from './format'

type FileLike = {
  name: string
  type: string
  blob: Blob
}

function getFormatLabel(name: string, type: string): string | null {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex > -1 && dotIndex < name.length - 1) {
    return name.slice(dotIndex + 1).toUpperCase()
  }

  const subtype = type.split('/')[1]
  if (!subtype) return null
  return subtype.split('+')[0].toUpperCase()
}

function loadImageInfo(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }

    image.onerror = () => {
      reject(new Error('Image metadata unavailable'))
      URL.revokeObjectURL(url)
    }

    image.src = url
  })
}

function loadMediaInfo(
  blob: Blob,
  tagName: 'video' | 'audio'
): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const media = document.createElement(tagName)
    media.preload = 'metadata'

    media.onloadedmetadata = () => {
      const payload =
        tagName === 'video'
          ? {
              duration: media.duration,
              width: (media as HTMLVideoElement).videoWidth,
              height: (media as HTMLVideoElement).videoHeight,
            }
          : { duration: media.duration }

      resolve(payload)
      URL.revokeObjectURL(url)
    }

    media.onerror = () => {
      reject(new Error('Media metadata unavailable'))
      URL.revokeObjectURL(url)
    }

    media.src = url
  })
}

export async function detectReceivedFileFacts(file: FileLike): Promise<string[]> {
  const facts: string[] = []
  const formatLabel = getFormatLabel(file.name, file.type)

  if (formatLabel) {
    facts.push(formatLabel)
  }

  try {
    if (file.type.startsWith('image/')) {
      const { width, height } = await loadImageInfo(file.blob)
      facts.push(`${width}×${height}`)
      return facts
    }

    if (file.type.startsWith('video/')) {
      const { duration, width, height } = await loadMediaInfo(file.blob, 'video')
      if (width && height) {
        facts.push(`${width}×${height}`)
      }
      if (Number.isFinite(duration) && duration > 0) {
        facts.push(formatDuration(Math.round(duration * 1000)))
      }
      return facts
    }

    if (file.type.startsWith('audio/')) {
      const { duration } = await loadMediaInfo(file.blob, 'audio')
      if (Number.isFinite(duration) && duration > 0) {
        facts.push(formatDuration(Math.round(duration * 1000)))
      }
    }
  } catch {
    return facts
  }

  return facts
}
