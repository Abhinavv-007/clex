import { writable, derived } from 'svelte/store'

export interface ProcessedFile {
  blob: Blob
  name: string
  type: string
  operation: string
  url: string
}

export interface FileEntry {
  id: string
  file: File
  name: string
  size: number
  type: string
  previewUrl?: string
  processed?: ProcessedFile
}

function createFilesStore() {
  const { subscribe, update, set } = writable<FileEntry[]>([])

  function createEntry(file: File): FileEntry {
    const id = crypto.randomUUID()
    const entry: FileEntry = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    }
    // Generate preview URL for images
    if (file.type.startsWith('image/')) {
      entry.previewUrl = URL.createObjectURL(file)
    }
    return entry
  }

  return {
    subscribe,
    add(files: File[]) {
      update(entries => {
        const newEntries = files.map(createEntry)
        return [...entries, ...newEntries]
      })
    },
    remove(id: string) {
      update(entries => {
        const entry = entries.find(e => e.id === id)
        if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl)
        if (entry?.processed?.url) URL.revokeObjectURL(entry.processed.url)
        return entries.filter(e => e.id !== id)
      })
    },
    setProcessed(id: string, processed: Omit<ProcessedFile, 'url'> & { url?: string }) {
      update(entries =>
        entries.map(e => {
          if (e.id !== id) return e
          const url = processed.url ?? URL.createObjectURL(processed.blob)
          return { ...e, processed: { ...processed, url } }
        })
      )
    },
    clear() {
      update(entries => {
        entries.forEach(e => {
          if (e.previewUrl) URL.revokeObjectURL(e.previewUrl)
          if (e.processed?.url) URL.revokeObjectURL(e.processed.url)
        })
        return []
      })
    },
    reset() {
      set([])
    },
  }
}

export const filesStore = createFilesStore()
export const fileCount = derived(filesStore, $f => $f.length)
export const hasFiles = derived(filesStore, $f => $f.length > 0)
