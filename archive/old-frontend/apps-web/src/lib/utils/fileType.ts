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

// Color accent per file category — used in FileCard
export function getFileCategoryColor(category: FileCategory): string {
  const map: Record<FileCategory, string> = {
    image: '#22d3ee',   // cyan
    pdf: '#f59e0b',     // amber
    document: '#7c3aed', // violet
    archive: '#8b5cf6', // lighter violet
    video: '#ec4899',   // pink
    audio: '#06d6a0',   // teal
    other: '#64748b',   // slate
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
