import { writable, derived } from 'svelte/store'
import { generateRoomCode } from '$utils/crypto'

export type TransferState =
  | 'idle'
  | 'preparing'
  | 'waiting_peer'
  | 'connecting'
  | 'transferring'
  | 'complete'
  | 'failed'

export type TransferMethod = 'webrtc' | 'local' | 'drive'

export interface TransferStore {
  state: TransferState
  method: TransferMethod
  roomCode: string | null
  progress: number
  bytesSent: number
  bytesTotal: number
  speedBps: number
  nearby: boolean
  error: string | null
  driveLink: string | null
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
  error: null,
    driveLink: null,
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
      update(s => ({ ...s, method, state: 'idle', error: null }))
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
    setNearby(nearby: boolean) {
      update(s => ({ ...s, nearby }))
    },
    setError(error: string) {
      update(s => ({ ...s, state: 'failed', error }))
    },
    setDriveLink(driveLink: string) {
      update(s => ({ ...s, state: 'complete', driveLink }))
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
