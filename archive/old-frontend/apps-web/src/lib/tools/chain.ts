import type { ChainSuggestion, ToolId } from '$stores/tools'

interface SuggestionSpec {
  toolId: ToolId | 'share'
  label: string
  description: string
}

/**
 * Given the MIME type and count of the output from a tool operation,
 * return the next logical actions (tool chaining suggestions).
 */
export function getSuggestions(outputMime: string, outputCount: number): ChainSuggestion[] {
  const suggestions: SuggestionSpec[] = []

  if (outputMime === 'application/pdf') {
    if (outputCount === 1) {
      suggestions.push(
        { toolId: 'pdf-split', label: 'Split PDF', description: 'Separate into individual pages' },
        { toolId: 'pdf-to-image', label: 'Export as images', description: 'Convert pages to JPG or PNG' },
      )
    }
    if (outputCount > 1) {
      suggestions.push(
        { toolId: 'pdf-merge', label: 'Merge PDFs', description: 'Combine into one document' },
      )
    }
    suggestions.push(
      { toolId: 'zip', label: 'Package as ZIP', description: 'Bundle for easy sharing' },
      { toolId: 'share', label: 'Share now', description: 'Send directly or upload to Drive' },
    )
  } else if (outputMime.startsWith('image/')) {
    suggestions.push(
      { toolId: 'image-compress', label: 'Compress image', description: 'Reduce file size' },
      { toolId: 'image-convert', label: 'Convert format', description: 'Change to PNG, WebP, AVIF…' },
    )
    if (outputCount > 1) {
      suggestions.push(
        { toolId: 'zip', label: 'Zip all images', description: 'Bundle into a single archive' },
      )
    }
    suggestions.push(
      { toolId: 'share', label: 'Share now', description: 'Send directly or upload to Drive' },
    )
  } else if (
    outputMime === 'application/zip' ||
    outputMime === 'application/x-zip-compressed'
  ) {
    suggestions.push(
      { toolId: 'share', label: 'Share now', description: 'Send directly or upload to Drive' },
    )
  } else if (
    outputMime === 'application/msword' ||
    outputMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    suggestions.push(
      { toolId: 'word-to-pdf', label: 'Convert to PDF', description: 'Universal format for sharing' },
      { toolId: 'share', label: 'Share now', description: 'Send directly or upload to Drive' },
    )
  } else {
    suggestions.push(
      { toolId: 'zip', label: 'Package as ZIP', description: 'Bundle for easy sharing' },
      { toolId: 'share', label: 'Share now', description: 'Send directly or upload to Drive' },
    )
  }

  return suggestions
}

// Tool metadata — name, icon, description, supported input types
export interface ToolMeta {
  id: ToolId
  name: string
  icon: string
  description: string
  accepts: string[] // MIME types or categories
}

export const TOOLS: ToolMeta[] = [
  {
    id: 'image-compress',
    name: 'Compress Image',
    icon: '🗜',
    description: 'Reduce image file size without visible quality loss',
    accepts: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'image-convert',
    name: 'Convert Image',
    icon: '🔄',
    description: 'Convert between JPG, PNG, WebP, and AVIF formats',
    accepts: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
  },
  {
    id: 'pdf-merge',
    name: 'Merge PDFs',
    icon: '📎',
    description: 'Combine multiple PDF files into one document',
    accepts: ['application/pdf'],
  },
  {
    id: 'pdf-split',
    name: 'Split PDF',
    icon: '✂️',
    description: 'Split a PDF into individual pages or sections',
    accepts: ['application/pdf'],
  },
  {
    id: 'pdf-to-image',
    name: 'PDF to Image',
    icon: '🖼',
    description: 'Export PDF pages as PNG or JPEG images',
    accepts: ['application/pdf'],
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    icon: '📄',
    description: 'Convert Word documents to PDF format',
    accepts: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  {
    id: 'zip',
    name: 'Zip Files',
    icon: '📦',
    description: 'Package multiple files into a compressed ZIP archive',
    accepts: ['*'],
  },
]
