import { writable } from 'svelte/store'

export type ToolId =
  | 'image-compress'
  | 'image-convert'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-to-image'
  | 'word-to-pdf'
  | 'zip'

export interface ChainSuggestion {
  toolId: ToolId | 'share'
  label: string
  description: string
}

export interface ToolResult {
  toolId: ToolId
  inputFileIds: string[]
  outputBlob: Blob
  outputName: string
  outputType: string
  outputUrl: string
  completedAt: number
  suggestions: ChainSuggestion[]
}

export interface ToolsStore {
  activeTool: ToolId | null
  isProcessing: boolean
  progress: number
  result: ToolResult | null
  error: string | null
}

const initial: ToolsStore = {
  activeTool: null,
  isProcessing: false,
  progress: 0,
  result: null,
  error: null,
}

function createToolsStore() {
  const { subscribe, update, set } = writable<ToolsStore>(initial)

  return {
    subscribe,
    startTool(toolId: ToolId) {
      update(s => {
        // Revoke old output URL
        if (s.result?.outputUrl) URL.revokeObjectURL(s.result.outputUrl)
        return { ...s, activeTool: toolId, isProcessing: true, progress: 0, result: null, error: null }
      })
    },
    setProgress(progress: number) {
      update(s => ({ ...s, progress: Math.min(100, Math.round(progress)) }))
    },
    setResult(result: Omit<ToolResult, 'outputUrl' | 'completedAt'>) {
      const outputUrl = URL.createObjectURL(result.outputBlob)
      update(s => ({
        ...s,
        isProcessing: false,
        activeTool: null,
        result: { ...result, outputUrl, completedAt: Date.now() },
      }))
    },
    setError(error: string) {
      update(s => ({ ...s, isProcessing: false, error }))
    },
    reset() {
      update(s => {
        if (s.result?.outputUrl) URL.revokeObjectURL(s.result.outputUrl)
        return { ...initial }
      })
    },
    clear() {
      set(initial)
    },
  }
}

export const toolsStore = createToolsStore()
