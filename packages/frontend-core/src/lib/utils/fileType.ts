import type { ToolId } from '$stores/tools'

export type FileCategory = 'image' | 'pdf' | 'document' | 'archive' | 'video' | 'audio' | 'other'

export function getFileCategory(type: string, name?: string): FileCategory {
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  if (
    type === 'application/msword' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'document'
  if (type === 'application/zip' || type === 'application/x-zip-compressed') return 'archive'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'

  // Fallback to extension
  const ext = name?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'doc' || ext === 'docx') return 'document'
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'archive'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext ?? '')) return 'image'

  return 'other'
}

// Colour per file category — used in FileCard. These are the gems from the
// Clex mark, read from the site's theme so they follow light and dark mode;
// the hex after each is the standalone fallback. Returned as CSS colour
// values, so callers must mix them with color-mix(), not append hex alpha.
export function getFileCategoryColor(category: FileCategory): string {
  const map: Record<FileCategory, string> = {
    image: 'var(--amethyst, #6a54a0)',
    pdf: 'var(--rose, #c06c55)',
    document: 'var(--moon, #5f82ad)',
    archive: 'var(--tiger, #a2741f)',
    video: 'var(--rose, #c06c55)',
    audio: 'var(--jade, #2e6a4f)',
    other: 'var(--ink-3, #6b665c)',
  }
  return map[category]
}

// Emoji icon per category
export function getFileCategoryIcon(category: FileCategory): string {
  const map: Record<FileCategory, string> = {
    image: '🖼',
    pdf: '📄',
    document: '📝',
    archive: '📦',
    video: '🎬',
    audio: '🎵',
    other: '📎',
  }
  return map[category]
}

// Returns a short extension label
export function getExtLabel(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? (parts.pop()?.toUpperCase() ?? '') : '—'
}

// Whether a given tool supports this file type
export function toolAcceptsFile(toolId: ToolId, category: FileCategory, type: string): boolean {
  switch (toolId) {
    case 'image-compress':
    case 'image-convert':
      return category === 'image' && !type.includes('svg')
    case 'pdf-merge':
    case 'pdf-split':
    case 'pdf-to-image':
      return category === 'pdf'
    case 'word-to-pdf':
      return category === 'document'
    case 'zip':
      return true
    default:
      return false
  }
}

// Return a CSS color var / class for a file type badge
export function fileBadgeClass(category: FileCategory): string {
  const map: Record<FileCategory, string> = {
    image: 'badge-cyan',
    pdf: 'badge-amber',
    document: 'badge-violet',
    archive: 'badge-violet',
    video: 'badge',
    audio: 'badge',
    other: 'badge',
  }
  return map[category]
}
