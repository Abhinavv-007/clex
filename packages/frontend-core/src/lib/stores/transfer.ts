import { writable, derived } from 'svelte/store'
import { generateRoomCode } from '$utils/crypto'
import type {
  ConnectionKind,
  ReliableCapabilities,
  TransferHealth,
  TransferReceipt,
} from '$transfer/types'

export type TransferState =
  | 'idle'
  | 'preparing'
  | 'waiting_peer'
  | 'connecting'
  | 'transferring'
  | 'complete'
  | 'failed'

export type TransferMethod = 'webrtc' | 'local' | 'drive'

/** Which on-wire protocol the active transfer is using. */
export type TransferProtocol = 'legacy' | 'reliable'

export interface ReceivedFile {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}

export interface TransferPreviewFile {
  id: string
  name: string
  type: string
  size: number
}

const IDLE_HEALTH: TransferHealth = {
  score: 0,
  label: 'idle',
  retries: 0,
  failedChunks: 0,
  verifiedChunks: 0,
  ackedChunks: 0,
  totalChunks: 0,
  bufferedAmount: 0,
  bufferedHigh: false,
  averageSpeedBps: 0,
  connectionStable: true,
}

export interface TransferStore {
  state: TransferState
  method: TransferMethod
  roomCode: string | null
  peerChainId: string | null
  progress: number
  bytesSent: number
  bytesTotal: number
  speedBps: number
  nearby: boolean
  connectionKind: ConnectionKind
  diagnosticCode: string | null
  error: string | null
  driveLink: string | null
  currentFile: TransferPreviewFile | null
  receivedFiles: ReceivedFile[]
  /** Reliable transfer additions — all default to safe values for legacy mode. */
  protocol: TransferProtocol
  paused: boolean
  pausedBy: 'sender' | 'receiver' | null
  health: TransferHealth
  totalChunks: number
  ackedChunks: number
  verifiedChunks: number
  retries: number
  failedChunks: number
  receipt: TransferReceipt | null
  capabilities: ReliableCapabilities | null
  transferId: string | null
}

function makeInitial(): TransferStore {
  return {
    state: 'idle',
    method: 'webrtc',
    roomCode: generateRoomCode(),
    peerChainId: null,
    progress: 0,
    bytesSent: 0,
    bytesTotal: 0,
    speedBps: 0,
    nearby: false,
    connectionKind: 'unknown',
    diagnosticCode: null,
    error: null,
    driveLink: null,
    currentFile: null,
    receivedFiles: [],
    protocol: 'legacy',
    paused: false,
    pausedBy: null,
    health: { ...IDLE_HEALTH },
    totalChunks: 0,
    ackedChunks: 0,
    verifiedChunks: 0,
    retries: 0,
    failedChunks: 0,
    receipt: null,
    capabilities: null,
    transferId: null,
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
        peerChainId: null,
        currentFile: null,
        receivedFiles: [],
        protocol: 'legacy',
        paused: false,
        pausedBy: null,
        health: { ...IDLE_HEALTH },
        totalChunks: 0,
        ackedChunks: 0,
        verifiedChunks: 0,
        retries: 0,
        failedChunks: 0,
        receipt: null,
        capabilities: null,
        transferId: null,
      }))
    },
    setRoomCode(roomCode: string) {
      update(s => ({ ...s, roomCode }))
    },
    setPeerChainId(peerChainId: string | null) {
      update(s => ({ ...s, peerChainId }))
    },
    setProgress(bytesSent: number, bytesTotal: number) {
      const progress = bytesTotal > 0 ? Math.min(100, Math.round((bytesSent / bytesTotal) * 100)) : 0
      update(s => ({ ...s, bytesSent, bytesTotal, progress }))
    },
    setSpeed(speedBps: number) {
      update(s => ({ ...s, speedBps }))
    },
    setCurrentFile(currentFile: TransferPreviewFile | null) {
      update(s => ({ ...s, currentFile }))
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
        peerChainId: null,
        currentFile: null,
        diagnosticCode: diagnosticCode ?? s.diagnosticCode,
      }))
    },
    setDriveLink(driveLink: string) {
      update(s => ({ ...s, state: 'complete', driveLink, peerChainId: null, currentFile: null, receivedFiles: [] }))
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
    // ── Reliable transfer setters ──────────────────────────────────────────
    setProtocol(protocol: TransferProtocol) {
      update(s => ({ ...s, protocol }))
    },
    setCapabilities(capabilities: ReliableCapabilities | null) {
      update(s => ({ ...s, capabilities }))
    },
    setTransferId(transferId: string | null) {
      update(s => ({ ...s, transferId }))
    },
    setPaused(paused: boolean, by: 'sender' | 'receiver' | null = null) {
      update(s => ({ ...s, paused, pausedBy: paused ? by : null }))
    },
    setHealth(health: TransferHealth) {
      update(s => ({
        ...s,
        health,
        retries: health.retries,
        failedChunks: health.failedChunks,
        verifiedChunks: health.verifiedChunks,
        ackedChunks: health.ackedChunks,
        totalChunks: health.totalChunks,
      }))
    },
    setReliableCounts(counts: {
      totalChunks: number
      ackedChunks?: number
      verifiedChunks?: number
      retries?: number
      failedChunks?: number
    }) {
      update(s => ({
        ...s,
        totalChunks: counts.totalChunks,
        ackedChunks: counts.ackedChunks ?? s.ackedChunks,
        verifiedChunks: counts.verifiedChunks ?? s.verifiedChunks,
        retries: counts.retries ?? s.retries,
        failedChunks: counts.failedChunks ?? s.failedChunks,
      }))
    },
    setReceipt(receipt: TransferReceipt | null) {
      update(s => ({ ...s, receipt }))
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
export const transferPaused = derived(transferStore, $t => $t.paused)
export const transferHealth = derived(transferStore, $t => $t.health)
