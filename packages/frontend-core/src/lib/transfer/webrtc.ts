import { transferStore } from '$stores/transfer'

import { getConnectionKindFromStats } from './network'
import { SignalingClient } from './signaling'
import {
  CHUNK_SIZE,
  DC_LABEL,
  getRTCConfig,
  type ConnectionKind,
  type DCControlMessage,
  type IceCandidatePayload,
  type TransferFile,
  type TransferProfile,
} from './types'

const BUFFER_HIGH_WATERMARK = 1 * 1024 * 1024 // 1 MB — stop sending
const BUFFER_DRAIN_INTERVAL = 20 // ms poll interval while waiting for drain
const PROFILE_CONNECT_TIMEOUT_MS: Record<TransferProfile, number> = {
  local: 15_000,
  webrtc: 20_000,
}
const CONNECTION_KIND_RETRY_ATTEMPTS = 6
const CONNECTION_KIND_RETRY_DELAY_MS = 250

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class WebRTCTransfer {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private readonly signaling: SignalingClient
  private readonly role: 'sender' | 'receiver'
  private readonly roomCode: string

  private profile: TransferProfile
  private signalingUnsubscribe: (() => void) | null = null

  // Sender state
  private sendQueue: TransferFile[] = []
  private sendStarted = false
  private offerSent = false

  // Receiver state
  private receiveBuffers = new Map<string, ArrayBuffer[]>()
  private receiveMeta = new Map<
    string,
    { name: string; type: string; totalChunks: number; totalSize: number; received: number }
  >()

  // Connection state
  private connectionTimer: ReturnType<typeof setTimeout> | null = null
  private pendingIceCandidates: IceCandidatePayload[] = []
  private connectionAccepted = false
  private transferCompleted = false
  private failed = false
  private connectionKind: ConnectionKind = 'unknown'

  // Speed tracking
  private lastBytesSent = 0
  private lastSpeedTs = Date.now()
  private speedTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    signalingUrl: string,
    roomCode: string,
    role: 'sender' | 'receiver',
    profile: TransferProfile = 'webrtc'
  ) {
    this.signaling = new SignalingClient(signalingUrl, roomCode)
    this.roomCode = roomCode
    this.role = role
    this.profile = profile
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async initSender(files: TransferFile[]): Promise<void> {
    transferStore.clearReceivedFiles()
    this.sendQueue = files
    transferStore.setState('preparing')
    transferStore.setConnectionKind('unknown')
    transferStore.setDiagnosticCode(null)

    this.setupPC()
    this.setupSenderDC()
    this.bindSignalingEvents()

    await this.signaling.connect('sender', this.profile)
    transferStore.setState('waiting_peer')
    this.logDiagnostic('sender_joined')
  }

  async initReceiver(): Promise<void> {
    transferStore.clearReceivedFiles()
    transferStore.setState('preparing')
    transferStore.setConnectionKind('unknown')
    transferStore.setDiagnosticCode(null)

    this.setupPC()
    this.bindSignalingEvents()

    await this.signaling.connect('receiver', this.profile)
    transferStore.setState('waiting_peer')
    this.logDiagnostic('receiver_joined')
  }

  destroy(): void {
    this.clearConnectionTimer()
    this.stopSpeedTimer()

    this.signalingUnsubscribe?.()
    this.signalingUnsubscribe = null
    this.signaling.disconnect()

    if (this.dc) {
      this.dc.onopen = null
      this.dc.onmessage = null
      this.dc.onerror = null
      try { this.dc.close() } catch { /* ignore */ }
    }
    if (this.pc) {
      this.pc.ondatachannel = null
      this.pc.onicecandidate = null
      this.pc.oniceconnectionstatechange = null
      try { this.pc.close() } catch { /* ignore */ }
    }

    this.dc = null
    this.pc = null
  }

  // ─── RTCPeerConnection setup ───────────────────────────────────────────────

  private setupPC(): void {
    this.pc = new RTCPeerConnection(getRTCConfig(this.profile))

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.send({ type: 'ice', candidate: candidate.toJSON() as IceCandidatePayload })
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState
      this.logDiagnostic(`ice_${state ?? 'unknown'}`)

      if (state === 'connected' || state === 'completed') {
        void this.evaluateConnectionKind()
      } else if (state === 'failed') {
        this.failTransfer(
          this.profile === 'local'
            ? 'Local mode could not establish a same-Wi-Fi connection. Try Direct or Drive instead.'
            : 'Direct connection failed. The devices may be on incompatible networks. Try Drive instead.',
          this.profile === 'local' ? 'ice_failed_local' : 'ice_failed_direct'
        )
      } else if (state === 'disconnected' && !this.transferCompleted && !this.failed) {
        this.failTransfer('Connection lost. The transfer may be incomplete.', 'ice_disconnected')
      }
    }

    if (this.role === 'receiver') {
      this.pc.ondatachannel = ({ channel }) => {
        this.dc = channel
        this.setupReceiverDC()
      }
    }
  }

  private setupSenderDC(): void {
    this.dc = this.pc!.createDataChannel(DC_LABEL, { ordered: true })
    this.dc.binaryType = 'arraybuffer'
    this.dc.onopen = () => {
      void this.handleDataChannelOpen()
    }
    this.dc.onerror = () => {
      this.failTransfer('Data channel error. Transfer failed.', 'sender_dc_error')
    }
  }

  private setupReceiverDC(): void {
    const dc = this.dc!
    dc.binaryType = 'arraybuffer'

    let currentFileId: string | null = null
    let totalBytesReceived = 0
    let grandTotalSize = 0

    dc.onopen = () => {
      void this.handleDataChannelOpen()
    }

    dc.onmessage = ({ data }) => {
      if (typeof data === 'string') {
        const msg = JSON.parse(data) as DCControlMessage

        if (msg.type === 'file-start') {
          currentFileId = msg.fileId
          grandTotalSize += msg.totalSize
          this.receiveBuffers.set(msg.fileId, [])
          this.receiveMeta.set(msg.fileId, {
            name: msg.name,
            type: msg.mimeType,
            totalChunks: msg.totalChunks,
            totalSize: msg.totalSize,
            received: 0,
          })
          transferStore.setState('transferring')
        } else if (msg.type === 'file-end') {
          if (msg.fileId) this.assembleAndDownload(msg.fileId)
        } else if (msg.type === 'transfer-complete') {
          this.transferCompleted = true
          transferStore.setState('complete')
          this.stopSpeedTimer()
        }
      } else if (currentFileId) {
        const chunk = data as ArrayBuffer
        this.receiveBuffers.get(currentFileId)?.push(chunk)
        const meta = this.receiveMeta.get(currentFileId)
        if (meta) {
          meta.received += chunk.byteLength
          totalBytesReceived += chunk.byteLength
          transferStore.setProgress(totalBytesReceived, grandTotalSize)
        }
      }
    }

    dc.onerror = () => {
      this.failTransfer('Receive channel error.', 'receiver_dc_error')
    }
  }

  private async handleDataChannelOpen(): Promise<void> {
    this.logDiagnostic('datachannel_open')

    const connectionKind = await this.evaluateConnectionKind(true)
    if (this.profile === 'local' && connectionKind === 'internet') {
      this.failTransfer(
        'Local mode requires both devices to stay on the same Wi-Fi network. Switch to Direct or Drive instead.',
        'local_mode_non_lan'
      )
      return
    }

    this.acceptConnection()

    if (this.role === 'sender' && !this.sendStarted) {
      this.sendStarted = true
      transferStore.setState('transferring')
      void this.startSending()
    }
  }

  private acceptConnection(): void {
    if (this.connectionAccepted) return
    this.connectionAccepted = true
    this.clearConnectionTimer()
  }

  // ─── Sending ───────────────────────────────────────────────────────────────

  private async startSending(): Promise<void> {
    const totalBytes = this.sendQueue.reduce((sum, file) => sum + file.size, 0)
    let bytesSent = 0

    this.startSpeedTimer(() => bytesSent)

    for (const file of this.sendQueue) {
      const buf = await file.blob.arrayBuffer()
      const totalChunks = Math.ceil(buf.byteLength / CHUNK_SIZE)

      const startMsg: DCControlMessage = {
        type: 'file-start',
        fileId: file.id,
        name: file.name,
        mimeType: file.type,
        totalChunks,
        totalSize: file.size,
      }
      this.dc!.send(JSON.stringify(startMsg))

      for (let i = 0; i < totalChunks; i++) {
        await this.drainBuffer()
        const chunk = buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        this.dc!.send(chunk)
        bytesSent += chunk.byteLength
        transferStore.setProgress(bytesSent, totalBytes)
      }

      const endMsg: DCControlMessage = { type: 'file-end', fileId: file.id }
      this.dc!.send(JSON.stringify(endMsg))
    }

    const doneMsg: DCControlMessage = { type: 'transfer-complete' }
    this.dc!.send(JSON.stringify(doneMsg))

    this.transferCompleted = true
    this.stopSpeedTimer()
    transferStore.setState('complete')
  }

  private drainBuffer(): Promise<void> {
    const dc = this.dc
    if (!dc || dc.bufferedAmount < BUFFER_HIGH_WATERMARK) return Promise.resolve()

    return new Promise(resolve => {
      const check = () => {
        if (!dc || dc.readyState !== 'open') {
          resolve()
          return
        }
        if (dc.bufferedAmount < BUFFER_HIGH_WATERMARK) {
          resolve()
          return
        }
        setTimeout(check, BUFFER_DRAIN_INTERVAL)
      }

      setTimeout(check, BUFFER_DRAIN_INTERVAL)
    })
  }

  // ─── Receiving ─────────────────────────────────────────────────────────────

  private assembleAndDownload(fileId: string): void {
    const buffers = this.receiveBuffers.get(fileId) ?? []
    const meta = this.receiveMeta.get(fileId)
    if (!meta) return

    const blob = new Blob(buffers, { type: meta.type || 'application/octet-stream' })
    transferStore.addReceivedFile({
      id: fileId,
      name: meta.name,
      type: meta.type,
      size: meta.totalSize,
      blob,
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = meta.name
    a.style.display = 'none'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 1000)

    this.receiveBuffers.delete(fileId)
    this.receiveMeta.delete(fileId)
  }

  // ─── Signaling events ──────────────────────────────────────────────────────

  private bindSignalingEvents(): void {
    if (this.signalingUnsubscribe) return

    this.signalingUnsubscribe = this.signaling.on(async event => {
      try {
        switch (event.type) {
          case 'joined':
            this.profile = event.mode
            this.logDiagnostic(`joined_${event.role}`)
            break

          case 'peer_joined':
            this.profile = event.mode
            transferStore.setState('connecting')
            this.logDiagnostic('peer_joined')
            this.startConnectionTimer()
            if (this.role === 'sender') {
              await this.createOfferIfNeeded()
            }
            break

          case 'offer':
            this.logDiagnostic('offer_received')
            await this.pc!.setRemoteDescription({ type: 'offer', sdp: event.sdp })
            await this.flushPendingIceCandidates()
            const answer = await this.pc!.createAnswer()
            await this.pc!.setLocalDescription(answer)
            this.signaling.send({ type: 'answer', sdp: answer.sdp! })
            this.logDiagnostic('answer_sent')
            break

          case 'answer':
            this.logDiagnostic('answer_received')
            if (this.pc!.signalingState !== 'stable') {
              await this.pc!.setRemoteDescription({ type: 'answer', sdp: event.sdp })
              await this.flushPendingIceCandidates()
            }
            break

          case 'ice':
            await this.handleRemoteIceCandidate(event.candidate)
            break

          case 'peer_left':
            if (!this.transferCompleted && !this.failed) {
              this.failTransfer('Peer disconnected before the transfer could complete.', 'peer_left')
            }
            break

          case 'error':
            this.failTransfer(this.getSignalingErrorMessage(event.code), `signaling_${event.code}`)
            break

          case 'pong':
            this.logDiagnostic('pong')
            break
        }
      } catch (err) {
        console.error('Error handling signaling event:', err)
        this.failTransfer('Transfer negotiation failed unexpectedly.', 'signaling_event_error')
      }
    })
  }

  private async createOfferIfNeeded(): Promise<void> {
    if (this.offerSent || !this.pc) return

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    this.signaling.send({ type: 'offer', sdp: offer.sdp! })
    this.offerSent = true
    this.logDiagnostic('offer_created')
  }

  private async handleRemoteIceCandidate(candidate: IceCandidatePayload): Promise<void> {
    if (!this.pc) return

    if (!this.pc.remoteDescription) {
      this.pendingIceCandidates.push(candidate)
      this.logDiagnostic('ice_buffered')
      return
    }

    await this.pc.addIceCandidate(candidate)
    this.logDiagnostic('ice_applied')
  }

  private async flushPendingIceCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription || this.pendingIceCandidates.length === 0) return

    const pending = [...this.pendingIceCandidates]
    this.pendingIceCandidates = []

    for (const candidate of pending) {
      await this.pc.addIceCandidate(candidate)
    }

    this.logDiagnostic('ice_flushed')
  }

  private startConnectionTimer(): void {
    if (this.connectionTimer || this.connectionAccepted || this.failed) return

    const timeoutMs = PROFILE_CONNECT_TIMEOUT_MS[this.profile]
    this.connectionTimer = setTimeout(() => {
      const diagnosticCode = this.profile === 'local' ? 'connect_timeout_local' : 'connect_timeout_direct'
      const message =
        this.profile === 'local'
          ? 'Local mode could not verify a same-Wi-Fi connection in time. Try Direct or Drive instead.'
          : 'Direct connection could not be established in time. Try Drive instead.'
      this.failTransfer(message, diagnosticCode)
    }, timeoutMs)

    this.logDiagnostic(`connect_timeout_started_${this.profile}`)
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer !== null) {
      clearTimeout(this.connectionTimer)
      this.connectionTimer = null
    }
  }

  private async evaluateConnectionKind(retryForStats = false): Promise<ConnectionKind> {
    if (!this.pc) return 'unknown'

    let nextKind: ConnectionKind = 'unknown'
    const attempts = retryForStats ? CONNECTION_KIND_RETRY_ATTEMPTS : 1

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        nextKind = getConnectionKindFromStats(await this.pc.getStats())
      } catch {
        nextKind = 'unknown'
      }

      if (nextKind !== 'unknown' || attempt === attempts - 1) {
        break
      }

      await wait(CONNECTION_KIND_RETRY_DELAY_MS)
    }

    this.connectionKind = nextKind
    transferStore.setConnectionKind(nextKind)
    this.logDiagnostic(`connection_kind_${nextKind}`)

    return nextKind
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  private logDiagnostic(code: string): void {
    transferStore.setDiagnosticCode(code)
    console.info('[clex-transfer]', {
      code,
      role: this.role,
      roomCode: this.roomCode,
      profile: this.profile,
      connectionKind: this.connectionKind,
    })
  }

  private failTransfer(message: string, diagnosticCode: string): void {
    if (this.failed || this.transferCompleted) return

    this.failed = true
    this.clearConnectionTimer()
    this.stopSpeedTimer()
    transferStore.setError(message, diagnosticCode)
    this.logDiagnostic(diagnosticCode)
    this.destroy()
  }

  private getSignalingErrorMessage(code: string): string {
    switch (code) {
      case 'ROOM_FULL':
        return 'This room already has both peers connected. Start a new transfer code.'
      case 'NO_PEER':
        return 'The other device is not connected yet.'
      case 'WS_ERROR':
        return 'Signaling connection failed. Make sure the signaling server is running and reachable from this device.'
      default:
        return `Signaling error: ${code}`
    }
  }

  // ─── Speed tracking ────────────────────────────────────────────────────────

  private startSpeedTimer(getBytesSent: () => number): void {
    this.lastBytesSent = 0
    this.lastSpeedTs = Date.now()
    this.speedTimer = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - this.lastSpeedTs) / 1000
      const sent = getBytesSent()
      const speed = elapsed > 0 ? (sent - this.lastBytesSent) / elapsed : 0
      transferStore.setSpeed(speed)
      this.lastBytesSent = sent
      this.lastSpeedTs = now
    }, 800)
  }

  private stopSpeedTimer(): void {
    if (this.speedTimer !== null) {
      clearInterval(this.speedTimer)
      this.speedTimer = null
    }
  }
}
