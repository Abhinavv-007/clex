import { writable } from 'svelte/store'

export type WorkspacePanel = 'files' | 'tools' | 'share'
export type ModalContent = 'receive' | 'drive-auth' | null

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

export interface UIStore {
  activePanel: WorkspacePanel
  toasts: Toast[]
  modalOpen: boolean
  modalContent: ModalContent
}

function createUIStore() {
  const { subscribe, update } = writable<UIStore>({
    activePanel: 'files',
    toasts: [],
    modalOpen: false,
    modalContent: null,
  })

  return {
    subscribe,
    setPanel(panel: WorkspacePanel) {
      update(s => ({ ...s, activePanel: panel }))
    },
    toast(opts: Omit<Toast, 'id'>) {
      const id = crypto.randomUUID()
      const duration = opts.duration ?? 4000
      const toast: Toast = { id, duration, type: opts.type, message: opts.message }
      update(s => ({ ...s, toasts: [...s.toasts, toast] }))
      setTimeout(() => {
        update(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }))
      }, duration)
    },
    dismissToast(id: string) {
      update(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) }))
    },
    openModal(content: ModalContent) {
      update(s => ({ ...s, modalOpen: true, modalContent: content }))
    },
    closeModal() {
      update(s => ({ ...s, modalOpen: false, modalContent: null }))
    },
  }
}

export const uiStore = createUIStore()
