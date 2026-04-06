import { writable, derived } from 'svelte/store'
import { generateRoomCode } from '$utils/crypto'
import type { ConnectionKind } from '$transfer/types'

export type TransferState =
  | 'idle'
  | 'preparing'
  | 'waiting_peer'
  | 'connecting'
  | 'transferring'
  | 'complete'
  | 'failed'

export type TransferMethod = 'webrtc' | 'local' | 'drive'

export interface ReceivedFile {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}

export interface TransferStore {
  state: TransferState
  method: TransferMethod
  roomCode: string | null
  progress: number
  bytesSent: number
  bytesTotal: number
  speedBps: number
  nearby: boolean
  connectionKind: ConnectionKind
  diagnosticCode: string | null
  error: string | null
  driveLink: string | null
  receivedFiles: ReceivedFile[]
}

function makeInitial(): TransferStore {
  return {
    state: 'idle',
    method: 'webrtc',
    roomCode: generateRoomCode(),
    progress: 0,
    bytesSent: 0,
    bytesTotal: 0,
    speedBps: 0,
    nearby: false,
    connectionKind: 'unknown',
    diagnosticCode: null,
    error: null,
    driveLink: null,
    receivedFiles: [],
  }
}

function createTransferStore() {
  const { subscribe, update, set } = writable<TransferStore>(makeInitial())

  return {
    subscribe,
    setState(state: TransferState) {
      update(s => ({ ...s, state }))
    },
    setMethod(method: TransferMethod) {
      update(s => ({
        ...s,
        method,
        state: 'idle',
        error: null,
        nearby: false,
        connectionKind: 'unknown',
        diagnosticCode: null,
        driveLink: null,
        receivedFiles: [],
      }))
    },
    setRoomCode(roomCode: string) {
      update(s => ({ ...s, roomCode }))
    },
    setProgress(bytesSent: number, bytesTotal: number) {
      const progress = bytesTotal > 0 ? Math.min(100, Math.round((bytesSent / bytesTotal) * 100)) : 0
      update(s => ({ ...s, bytesSent, bytesTotal, progress }))
    },
    setSpeed(speedBps: number) {
      update(s => ({ ...s, speedBps }))
    },
    setConnectionKind(connectionKind: ConnectionKind) {
      update(s => ({ ...s, connectionKind, nearby: connectionKind === 'lan' }))
    },
    setNearby(nearby: boolean) {
      update(s => ({ ...s, nearby, connectionKind: nearby ? 'lan' : s.connectionKind }))
    },
    setDiagnosticCode(diagnosticCode: string | null) {
      update(s => ({ ...s, diagnosticCode }))
    },
    setError(error: string, diagnosticCode?: string) {
      update(s => ({
        ...s,
        state: 'failed',
        error,
        diagnosticCode: diagnosticCode ?? s.diagnosticCode,
      }))
    },
    setDriveLink(driveLink: string) {
      update(s => ({ ...s, state: 'complete', driveLink, receivedFiles: [] }))
    },
    addReceivedFile(file: ReceivedFile) {
      update(s => ({
        ...s,
        receivedFiles: [
          ...s.receivedFiles.filter(entry => entry.id !== file.id),
          file,
        ],
      }))
    },
    clearReceivedFiles() {
      update(s => ({ ...s, receivedFiles: [] }))
    },
    reset() {
      set(makeInitial())
    },
  }
}

export const transferStore = createTransferStore()
export const isTransferring = derived(transferStore, $t => $t.state === 'transferring')
export const transferFailed = derived(transferStore, $t => $t.state === 'failed')
export const transferComplete = derived(transferStore, $t => $t.state === 'complete')
