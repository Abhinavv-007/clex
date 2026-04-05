import { SignalingClient } from './signaling'
import { getDefaultRTCConfig, CHUNK_SIZE, DC_LABEL, type TransferFile, type DCControlMessage } from './types'
import { transferStore } from '$stores/transfer'

const BUFFER_HIGH_WATERMARK = 1 * 1024 * 1024 // 1 MB — stop sending
const BUFFER_DRAIN_INTERVAL = 20 // ms poll interval while waiting for drain

export class WebRTCTransfer {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private signaling: SignalingClient
  private readonly role: 'sender' | 'receiver'

  // Sender state
  private sendQueue: TransferFile[] = []

  // Receiver state
  private receiveBuffers = new Map<string, ArrayBuffer[]>()
  private receiveMeta = new Map<string, { name: string; type: string; totalChunks: number; totalSize: number; received: number }>()

  // Speed tracking
  private lastBytesSent = 0
  private lastSpeedTs = Date.now()
  private speedTimer: ReturnType<typeof setInterval> | null = null

  constructor(signalingUrl: string, roomCode: string, role: 'sender' | 'receiver') {
    this.signaling = new SignalingClient(signalingUrl, roomCode)
    this.role = role
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async initSender(files: TransferFile[]): Promise<void> {
    this.sendQueue = files
    transferStore.setState('preparing')

    await this.signaling.connect('sender')
    this.setupPC()
    this.setupSenderDC()
    this.bindSignalingEvents()

    // Create offer immediately — receiver may join later and we'll already have SDP ready
    const offer = await this.pc!.createOffer()
    await this.pc!.setLocalDescription(offer)
    this.signaling.send({ type: 'offer', sdp: offer.sdp! })

    transferStore.setState('waiting_peer')
  }

  async initReceiver(): Promise<void> {
    transferStore.setState('preparing')
    await this.signaling.connect('receiver')
    this.setupPC()
    this.bindSignalingEvents()
    transferStore.setState('waiting_peer')
  }

  destroy(): void {
    this.stopSpeedTimer()
    this.signaling.disconnect()
    if (this.dc) { try { this.dc.close() } catch { /* ignore */ } }
    if (this.pc) { try { this.pc.close() } catch { /* ignore */ } }
    this.dc = null
    this.pc = null
  }

  // ─── RTCPeerConnection setup ───────────────────────────────────────────────

  private setupPC(): void {
    this.pc = new RTCPeerConnection(getDefaultRTCConfig())

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.send({ type: 'ice', candidate: candidate.toJSON() })
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState
      if (state === 'connected' || state === 'completed') {
        // DataChannel open event will fire separately — state is already 'connecting' via peer_joined
      } else if (state === 'failed') {
        transferStore.setError('Direct connection failed. Both devices may be on restricted networks. Try Google Drive instead.')
      } else if (state === 'disconnected') {
        transferStore.setError('Connection lost. The transfer may be incomplete.')
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
      transferStore.setState('transferring')
      this.startSending()
    }
    this.dc.onerror = () => {
      transferStore.setError('Data channel error. Transfer failed.')
    }
  }

  private setupReceiverDC(): void {
    const dc = this.dc!
    dc.binaryType = 'arraybuffer'

    let currentFileId: string | null = null
    let totalBytesReceived = 0
    let grandTotalSize = 0

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
          transferStore.setState('complete')
          this.stopSpeedTimer()
        }
      } else {
        // Binary chunk
        if (currentFileId) {
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
    }

    dc.onerror = () => {
      transferStore.setError('Receive channel error.')
    }
  }

  // ─── Sending ───────────────────────────────────────────────────────────────

  private async startSending(): Promise<void> {
    const totalBytes = this.sendQueue.reduce((sum, f) => sum + f.size, 0)
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

    this.stopSpeedTimer()
    transferStore.setState('complete')
  }

  private drainBuffer(): Promise<void> {
    const dc = this.dc
    if (!dc || dc.bufferedAmount < BUFFER_HIGH_WATERMARK) return Promise.resolve()
    return new Promise(resolve => {
      const check = () => {
        if (!dc || dc.readyState !== 'open') { resolve(); return }
        if (dc.bufferedAmount < BUFFER_HIGH_WATERMARK) { resolve(); return }
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
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = meta.name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 1000)

    this.receiveBuffers.delete(fileId)
    this.receiveMeta.delete(fileId)
  }

  // ─── Signaling events ─────────────────────────────────────────────────────

  private bindSignalingEvents(): void {
    this.signaling.on(async event => {
      try {
        switch (event.type) {
          case 'peer_joined':
            transferStore.setNearby(event.nearby)
            transferStore.setState('connecting')
            break

          case 'offer':
            await this.pc!.setRemoteDescription({ type: 'offer', sdp: event.sdp })
            const answer = await this.pc!.createAnswer()
            await this.pc!.setLocalDescription(answer)
            this.signaling.send({ type: 'answer', sdp: answer.sdp! })
            break

          case 'answer':
            if (this.pc!.signalingState !== 'stable') {
              await this.pc!.setRemoteDescription({ type: 'answer', sdp: event.sdp })
            }
            break

          case 'ice':
            if (this.pc && this.pc.remoteDescription) {
              await this.pc.addIceCandidate(event.candidate)
            }
            break

          case 'peer_left':
            if (this.pc?.iceConnectionState !== 'connected' && this.pc?.iceConnectionState !== 'completed') {
              transferStore.setError('Peer disconnected before the transfer could begin.')
            }
            break

          case 'error':
            transferStore.setError(`Signaling error: ${event.code}`)
            break
        }
      } catch (err) {
        console.error('Error handling signaling event:', err)
      }
    })
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
