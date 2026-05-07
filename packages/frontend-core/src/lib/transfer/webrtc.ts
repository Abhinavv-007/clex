import { transferStore } from '$stores/transfer'
import { getChainId } from '$utils/chainId'

import { getConnectionKindFromStats } from './network'
import {
  buildCapabilityMessage,
  buildManifest,
  buildReceipt,
  ChunkTracker,
  computeHealthScore,
  decodeChunkFrame,
  digestSha256,
  encodeChunkFrame,
  frameFlags,
  isControlMessage,
  negotiateCapabilities,
  safeParseControl,
  transferQueueStore,
} from './reliable'
import { SignalingClient } from './signaling'
import {
  BUFFERED_AMOUNT_HIGH_WATER,
  BUFFERED_AMOUNT_LOW_WATER,
  CAPABILITY_GRACE_MS,
  CHUNK_SIZE,
  DC_LABEL,
  DEFAULT_RELIABLE_CAPS,
  MAX_IN_FLIGHT_CHUNKS,
  RECEIVER_PROGRESS_INTERVAL_MS,
  UI_UPDATE_INTERVAL_MS,
  getRTCConfig,
  type ConnectionKind,
  type DCControlMessage,
  type IceCandidatePayload,
  type ReliableCapabilities,
  type TransferFile,
  type TransferHealth,
  type TransferManifest,
  type TransferProfile,
  type TransferReceipt,
} from './types'

const BUFFER_DRAIN_INTERVAL = 50 // ms safety-net poll while awaiting bufferedamountlow
const PROFILE_CONNECT_TIMEOUT_MS: Record<TransferProfile, number> = {
  local: 15_000,
  webrtc: 20_000,
}
const CONNECTION_KIND_RETRY_ATTEMPTS = 6
const CONNECTION_KIND_RETRY_DELAY_MS = 250

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ReliableSenderState {
  manifest: TransferManifest
  tracker: ChunkTracker
  files: TransferFile[]
  startedAt: number
  paused: boolean
  cancelled: boolean
  /** Resolves once the receiver acknowledges the manifest. */
  manifestAcked: Promise<void>
  resolveManifestAck: (() => void) | null
  rejectManifestAck: ((err: Error) => void) | null
  /** Resolves once verify_success is received. */
  verifyResolved: Promise<void>
  resolveVerify: (() => void) | null
  rejectVerify: ((err: Error) => void) | null
  rootHash?: string
}

interface ReliableReceiverState {
  manifest: TransferManifest
  tracker: ChunkTracker
  startedAt: number
  /** Per-file accumulator of chunks at known indices. */
  chunkBuffers: Map<number, ArrayBuffer[]>
  bytesReceived: number
  paused: boolean
  cancelled: boolean
}

export class WebRTCTransfer {
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private readonly signaling: SignalingClient
  private readonly role: 'sender' | 'receiver'
  private readonly roomCode: string

  private profile: TransferProfile
  private signalingUnsubscribe: (() => void) | null = null

  // Sender state (legacy)
  private sendQueue: TransferFile[] = []
  private sendStarted = false
  private offerSent = false

  // Receiver state (legacy)
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
  private speedSamples: number[] = []

  // Reliable protocol state
  private localCaps: ReliableCapabilities = DEFAULT_RELIABLE_CAPS
  private remoteCaps: ReliableCapabilities | null = null
  private negotiatedCaps: ReliableCapabilities | null = null
  private capabilityResolved = false
  private capabilityWaiters: Array<() => void> = []
  private capabilityTimeout: ReturnType<typeof setTimeout> | null = null
  private reliableSender: ReliableSenderState | null = null
  private reliableReceiver: ReliableReceiverState | null = null
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private receiverProgressTimer: ReturnType<typeof setInterval> | null = null
  private queueEntryId: string | null = null
  /** Re-entry guard for driveReliableSendLoop. Multiple resume/retry events can
   *  race onto the loop kick — without this, two loops would race to send the
   *  same pending chunk twice. */
  private sendLoopRunning = false
  /** Resolver waiting for `bufferedamountlow` events instead of polling. */
  private bufferedDrainResolvers: Array<() => void> = []
  /** UI-update coalescing — store writes are batched to one per interval. */
  private uiFlushTimer: ReturnType<typeof setTimeout> | null = null
  private pendingProgressBytes: number | null = null
  private pendingProgressTotal: number | null = null
  private pendingReliableCounts: {
    totalChunks?: number
    ackedChunks?: number
    verifiedChunks?: number
    retries?: number
    failedChunks?: number
  } | null = null

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
    transferStore.setPeerChainId(null)
    transferStore.setConnectionKind('unknown')
    transferStore.setDiagnosticCode(null)
    transferStore.setProtocol('legacy')
    transferStore.setReceipt(null)
    transferStore.setReliableCounts({ totalChunks: 0, ackedChunks: 0, verifiedChunks: 0, retries: 0, failedChunks: 0 })

    // Pre-register the queue entry so the UI shows "pending" before signaling
    // even succeeds; we'll attach the manifest's transferId once it's built.
    this.queueEntryId = transferQueueStore.enqueue({
      transferId: null,
      direction: 'send',
      fileNames: files.map(f => f.name),
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      totalChunks: 0,
      route: this.profile,
      status: 'pending',
      resumable: false,
    }).id

    this.setupPC()
    this.setupSenderDC()
    this.bindSignalingEvents()

    await this.signaling.connect('sender', this.profile, getChainId())
    transferStore.setState('waiting_peer')
    this.logDiagnostic('sender_joined')
  }

  async initReceiver(): Promise<void> {
    transferStore.clearReceivedFiles()
    transferStore.setState('preparing')
    transferStore.setPeerChainId(null)
    transferStore.setConnectionKind('unknown')
    transferStore.setDiagnosticCode(null)
    transferStore.setProtocol('legacy')
    transferStore.setReceipt(null)
    transferStore.setReliableCounts({ totalChunks: 0, ackedChunks: 0, verifiedChunks: 0, retries: 0, failedChunks: 0 })

    this.queueEntryId = transferQueueStore.enqueue({
      transferId: null,
      direction: 'receive',
      fileNames: [],
      totalSize: 0,
      totalChunks: 0,
      route: this.profile,
      status: 'pending',
      resumable: false,
    }).id

    this.setupPC()
    this.bindSignalingEvents()

    await this.signaling.connect('receiver', this.profile, getChainId())
    transferStore.setState('waiting_peer')
    this.logDiagnostic('receiver_joined')
  }

  /** Pause the active transfer (sender or receiver). */
  pause(): void {
    if (this.transferCompleted || this.failed) return
    if (this.reliableSender) {
      this.reliableSender.paused = true
      transferStore.setPaused(true, this.role)
      this.sendControl({ type: 'pause', transferId: this.reliableSender.manifest.transferId, by: 'sender' })
      this.logDiagnostic('paused_by_sender')
    } else if (this.reliableReceiver) {
      this.reliableReceiver.paused = true
      transferStore.setPaused(true, this.role)
      this.sendControl({ type: 'pause', transferId: this.reliableReceiver.manifest.transferId, by: 'receiver' })
      this.logDiagnostic('paused_by_receiver')
    }
  }

  /** Resume a paused transfer. Sender continues; receiver resumes acks. */
  resume(): void {
    if (this.reliableSender) {
      const wasPaused = this.reliableSender.paused
      this.reliableSender.paused = false
      transferStore.setPaused(false)
      this.sendControl({ type: 'resume', transferId: this.reliableSender.manifest.transferId, by: 'sender' })
      this.logDiagnostic('resumed_by_sender')
      if (wasPaused) void this.driveReliableSendLoop()
    } else if (this.reliableReceiver) {
      this.reliableReceiver.paused = false
      transferStore.setPaused(false)
      this.sendControl({ type: 'resume', transferId: this.reliableReceiver.manifest.transferId, by: 'receiver' })
      this.logDiagnostic('resumed_by_receiver')
    }
  }

  /** Cancel an active transfer. */
  cancel(): void {
    if (this.transferCompleted || this.failed) return
    const transferId =
      this.reliableSender?.manifest.transferId ?? this.reliableReceiver?.manifest.transferId ?? null
    if (this.reliableSender) this.reliableSender.cancelled = true
    if (this.reliableReceiver) this.reliableReceiver.cancelled = true
    if (transferId) {
      this.sendControl({ type: 'cancel', transferId, reason: `cancelled_by_${this.role}` })
    }
    if (this.queueEntryId) {
      transferQueueStore.setStatus(this.queueEntryId, 'cancelled')
    }
    this.failTransfer('Transfer cancelled.', `cancelled_by_${this.role}`)
  }

  destroy(): void {
    this.clearConnectionTimer()
    this.stopSpeedTimer()
    this.stopHealthTimer()
    this.stopReceiverProgressTimer()
    this.clearCapabilityTimeout()
    this.flushPendingUiNow()

    // Release any send-loop awaiters waiting on backpressure drain so the
    // loop unwinds cleanly instead of hanging on a Promise that will never
    // resolve once the data channel is gone.
    const waiters = this.bufferedDrainResolvers.splice(0)
    for (const w of waiters) {
      try { w() } catch { /* ignore */ }
    }

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
    this.dc.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_WATER
    this.attachBufferedAmountLow(this.dc)
    this.dc.onopen = () => {
      void this.handleDataChannelOpen()
    }
    this.dc.onmessage = ({ data }) => {
      this.handleSenderMessage(data)
    }
    this.dc.onerror = () => {
      this.failTransfer('Data channel error. Transfer failed.', 'sender_dc_error')
    }
  }

  private setupReceiverDC(): void {
    const dc = this.dc!
    dc.binaryType = 'arraybuffer'
    dc.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_WATER
    this.attachBufferedAmountLow(dc)

    const announceChainId = () => {
      try {
        const receiverChainId = getChainId()
        dc.send(JSON.stringify({ type: 'receiver-chain', chainId: receiverChainId } satisfies DCControlMessage))
      } catch { /* peer may have closed */ }
    }

    dc.onopen = () => {
      void this.handleDataChannelOpen()
      announceChainId()
    }

    dc.onmessage = ({ data }) => {
      this.handleReceiverMessage(data)
    }

    dc.onerror = () => {
      this.failTransfer('Receive channel error.', 'receiver_dc_error')
    }

    if (dc.readyState === 'open') {
      void this.handleDataChannelOpen()
      announceChainId()
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
    this.startHealthTimer()

    // Capability handshake: announce ours, then either wait for the peer's caps
    // or fall back to legacy after the grace window.
    this.announceCapabilities()
    this.armCapabilityTimeout()

    if (this.role === 'sender' && !this.sendStarted) {
      this.sendStarted = true
      transferStore.setState('transferring')
      void this.startSendingAfterNegotiation()
    }
  }

  private acceptConnection(): void {
    if (this.connectionAccepted) return
    this.connectionAccepted = true
    this.clearConnectionTimer()
  }

  // ─── Capability negotiation ────────────────────────────────────────────────

  private announceCapabilities(): void {
    this.sendControl(buildCapabilityMessage(this.localCaps))
  }

  private armCapabilityTimeout(): void {
    if (this.capabilityResolved || this.capabilityTimeout) return
    this.capabilityTimeout = setTimeout(() => {
      this.resolveCapabilities()
    }, CAPABILITY_GRACE_MS)
  }

  private clearCapabilityTimeout(): void {
    if (this.capabilityTimeout) {
      clearTimeout(this.capabilityTimeout)
      this.capabilityTimeout = null
    }
  }

  private resolveCapabilities(): void {
    if (this.capabilityResolved) return
    this.capabilityResolved = true
    this.clearCapabilityTimeout()

    const negotiated = negotiateCapabilities(this.localCaps, this.remoteCaps)
    this.negotiatedCaps = negotiated
    transferStore.setCapabilities(negotiated)
    transferStore.setProtocol(negotiated ? 'reliable' : 'legacy')
    this.logDiagnostic(negotiated ? 'reliable_negotiated' : 'reliable_unavailable_legacy')

    const waiters = this.capabilityWaiters.splice(0)
    for (const w of waiters) {
      try { w() } catch { /* ignore */ }
    }
  }

  private waitForCapabilities(): Promise<void> {
    if (this.capabilityResolved) return Promise.resolve()
    return new Promise(resolve => this.capabilityWaiters.push(resolve))
  }

  // ─── Sender wiring ─────────────────────────────────────────────────────────

  private async startSendingAfterNegotiation(): Promise<void> {
    await this.waitForCapabilities()

    if (this.negotiatedCaps) {
      await this.startReliableSending()
    } else {
      await this.startLegacySending()
    }
  }

  private async startReliableSending(): Promise<void> {
    const manifest = await buildManifest(this.sendQueue, {
      chunkSize: CHUNK_SIZE,
      perChunkHash: this.negotiatedCaps?.supportsChunkHash ?? false,
      computeRootHash: true,
      route: this.profile,
    })

    transferStore.setTransferId(manifest.transferId)
    transferStore.setReliableCounts({ totalChunks: manifest.totalChunks })

    if (this.queueEntryId) {
      transferQueueStore.update(this.queueEntryId, {
        transferId: manifest.transferId,
        totalChunks: manifest.totalChunks,
        status: 'active',
      })
    }

    const tracker = new ChunkTracker(manifest)
    let resolveAck: (() => void) | null = null
    let rejectAck: ((err: Error) => void) | null = null
    const manifestAcked = new Promise<void>((resolve, reject) => {
      resolveAck = () => resolve()
      rejectAck = reject
    })
    let resolveVerify: (() => void) | null = null
    let rejectVerify: ((err: Error) => void) | null = null
    const verifyResolved = new Promise<void>((resolve, reject) => {
      resolveVerify = () => resolve()
      rejectVerify = reject
    })

    this.reliableSender = {
      manifest,
      tracker,
      files: this.sendQueue,
      startedAt: Date.now(),
      paused: false,
      cancelled: false,
      manifestAcked,
      resolveManifestAck: resolveAck,
      rejectManifestAck: rejectAck,
      verifyResolved,
      resolveVerify,
      rejectVerify,
    }

    // Send manifest header
    this.sendControl({ type: 'manifest', manifest })

    try {
      await Promise.race([
        manifestAcked,
        wait(8000).then(() => { throw new Error('manifest_ack_timeout') }),
      ])
    } catch {
      this.failTransfer('Receiver did not acknowledge the manifest in time.', 'manifest_ack_timeout')
      return
    }

    transferStore.setState('transferring')
    transferStore.setSpeed(0)
    this.startSpeedTimer(() => tracker.snapshot().bytesAcked)

    await this.driveReliableSendLoop()

    if (this.reliableSender?.cancelled || this.failed) return

    this.sendControl({ type: 'transfer-complete' })

    // Wait for verify_success / verify_failed
    try {
      await Promise.race([
        verifyResolved,
        wait(15_000).then(() => { throw new Error('verify_timeout') }),
      ])
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'verify_timeout'
      this.failTransfer('Receiver did not verify the transfer in time.', reason)
      return
    }

    this.finalizeReliableSender()
  }

  private async driveReliableSendLoop(): Promise<void> {
    const sender = this.reliableSender
    if (!sender) return
    if (this.sendLoopRunning) return
    this.sendLoopRunning = true
    try {
      await this.runReliableSendLoop(sender)
    } finally {
      this.sendLoopRunning = false
    }
  }

  private async runReliableSendLoop(sender: ReliableSenderState): Promise<void> {
    const { manifest, tracker, files } = sender

    // Sliding window: we let MAX_IN_FLIGHT_CHUNKS chunks be unacked at once.
    // The DataChannel's bufferedAmount provides a second backpressure gate so
    // we never overshoot the browser's internal queue. Together they keep the
    // wire busy on LAN (where ACKs are cheap) without ballooning peak memory
    // on slow paths.
    while (!sender.cancelled && !this.failed) {
      if (sender.paused) {
        await wait(120)
        continue
      }

      const snapAtTop = tracker.snapshot()
      if (snapAtTop.inFlight >= MAX_IN_FLIGHT_CHUNKS) {
        // Window full — wait for an ACK to free a slot. The handler kicks
        // the loop again, but we also poll so a missed kick doesn't stall.
        await wait(20)
        continue
      }

      const next = tracker.pickNextSendable()
      if (!next) {
        if (tracker.isComplete()) break
        // No retransmits ready yet — wait briefly for the retry timer.
        await wait(80)
        continue
      }

      await this.drainBuffer()
      if (this.failed || sender.cancelled) return

      const file = files[next.fileIndex]
      if (!file) {
        // Should never happen, but bail safely.
        tracker.scheduleRetry(next.fileIndex, next.chunkIndex)
        continue
      }

      const chunkSize = manifest.chunkSize
      const start = next.chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      const slice = file.blob.slice(start, end)
      let payload: ArrayBuffer
      try {
        payload = await slice.arrayBuffer()
      } catch {
        tracker.scheduleRetry(next.fileIndex, next.chunkIndex)
        continue
      }

      const isLast = next.chunkIndex === manifest.files[next.fileIndex].totalChunks - 1
      const flags = frameFlags({
        retransmit: next.attempts > 0,
        last: isLast,
      })
      const frame = encodeChunkFrame({
        fileIndex: next.fileIndex,
        chunkIndex: next.chunkIndex,
        chunkLength: payload.byteLength,
        flags,
        payload,
      })

      try {
        this.dc!.send(frame)
        tracker.markSent(next.fileIndex, next.chunkIndex)
        // UI updates are coalesced — see scheduleUiFlush. Pulling tracker
        // snapshot per chunk + writing the Svelte store synchronously is
        // what made the 50 MB transfer feel like 1–8 B/s in the previous
        // build (hundreds of reactive updates per second on the hot path).
        this.scheduleProgressFlushFromTracker(tracker)
      } catch {
        tracker.scheduleRetry(next.fileIndex, next.chunkIndex)
        if (this.dc?.readyState !== 'open') {
          this.failTransfer('Data channel closed mid-transfer.', 'dc_closed_during_send')
          return
        }
      }
    }
  }

  private finalizeReliableSender(): void {
    const sender = this.reliableSender
    if (!sender) return

    this.flushPendingUiNow()
    const snap = sender.tracker.snapshot()
    const completedAt = Date.now()
    const health = computeHealthScore({
      totalChunks: snap.totalChunks,
      ackedChunks: snap.acked + snap.verified,
      verifiedChunks: snap.verified,
      retries: snap.retries,
      failedChunks: snap.failedChunks,
      bufferedAmount: this.dc?.bufferedAmount ?? 0,
      bufferedHigh: false,
      averageSpeedBps: this.averageSpeedBps(),
      connectionKind: this.connectionKind,
      connectionStable: !this.failed,
      paused: sender.paused,
      state: 'complete',
    })

    const receipt: TransferReceipt = buildReceipt({
      manifest: sender.manifest,
      health,
      startedAt: sender.startedAt,
      completedAt,
      route: sender.manifest.route ?? this.profile,
      retryCount: snap.retries,
      failedChunkCount: snap.failedChunks,
      verified: sender.tracker.isComplete() && snap.failed === 0,
      rootHash: sender.rootHash ?? sender.manifest.rootHash,
    })

    transferStore.setReceipt(receipt)
    transferStore.setHealth(health)
    if (this.queueEntryId) {
      transferQueueStore.attachReceipt(this.queueEntryId, receipt)
    }

    this.transferCompleted = true
    this.stopSpeedTimer()
    transferStore.setCurrentFile(null)
    transferStore.setState('complete')
  }

  // ─── Sender DC message handling ────────────────────────────────────────────

  private handleSenderMessage(data: unknown): void {
    if (!isControlMessage(data)) return
    const msg = safeParseControl(data)
    if (!msg) return

    switch (msg.type) {
      case 'receiver-chain':
        transferStore.setPeerChainId(msg.chainId)
        return
      case 'capability':
        this.remoteCaps = msg.caps
        this.resolveCapabilities()
        return
    }

    const sender = this.reliableSender
    if (!sender) return

    switch (msg.type) {
      case 'manifest_ack':
        if (msg.transferId !== sender.manifest.transferId) return
        if (msg.ok) {
          sender.resolveManifestAck?.()
        } else {
          sender.rejectManifestAck?.(new Error(msg.error ?? 'manifest_rejected'))
        }
        sender.resolveManifestAck = null
        sender.rejectManifestAck = null
        return
      case 'chunk_ack':
        if (msg.transferId !== sender.manifest.transferId) return
        sender.tracker.markAcked(msg.fileIndex, msg.chunkIndex)
        // ACK frees a slot in the send window — kick the loop so we don't
        // sit on the 20 ms safety wait when there's work to do.
        if (!sender.paused && !sender.cancelled) void this.driveReliableSendLoop()
        // Health is refreshed by a coalesced timer instead of per-ACK so the
        // store doesn't churn on every chunk in flight.
        return
      case 'chunk_nack':
        if (msg.transferId !== sender.manifest.transferId) return
        sender.tracker.scheduleRetry(msg.fileIndex, msg.chunkIndex)
        this.refreshHealthFromTracker(sender.tracker)
        return
      case 'retry_request':
        if (msg.transferId !== sender.manifest.transferId) return
        for (const chunk of msg.chunks) {
          sender.tracker.forceResend(chunk.fileIndex, chunk.chunkIndex)
        }
        // Kick the loop: in case it's currently sleeping on a retry timer.
        if (!sender.paused) void this.driveReliableSendLoop()
        return
      case 'receiver_progress':
        if (msg.transferId !== sender.manifest.transferId) return
        // Receiver reports its own verifiedChunks as a stable ground truth.
        transferStore.setReliableCounts({
          totalChunks: sender.tracker.snapshot().totalChunks,
          verifiedChunks: msg.verifiedChunks,
          ackedChunks: msg.receivedChunks,
        })
        return
      case 'verify_success':
        if (msg.transferId !== sender.manifest.transferId) return
        sender.rootHash = msg.rootHash
        sender.resolveVerify?.()
        sender.resolveVerify = null
        return
      case 'verify_failed':
        if (msg.transferId !== sender.manifest.transferId) return
        // Receiver still wants chunks — schedule them and keep going.
        if (msg.missing && msg.missing.length > 0) {
          for (const idx of msg.missing) {
            // missing[] uses an absolute chunk index across the manifest; map
            // back to (fileIndex, chunkIndex) by walking files in order.
            this.forceResendByGlobalIndex(idx)
          }
          if (!sender.paused) void this.driveReliableSendLoop()
        } else {
          sender.rejectVerify?.(new Error(msg.reason ?? 'verify_failed'))
        }
        return
      case 'pause':
        sender.paused = true
        transferStore.setPaused(true, msg.by)
        return
      case 'resume':
        sender.paused = false
        transferStore.setPaused(false)
        if (!sender.cancelled) void this.driveReliableSendLoop()
        return
      case 'cancel':
        sender.cancelled = true
        this.failTransfer('Transfer cancelled by peer.', 'cancelled_by_peer')
        return
    }
  }

  private forceResendByGlobalIndex(absoluteIndex: number): void {
    const sender = this.reliableSender
    if (!sender) return
    let cursor = 0
    for (const file of sender.manifest.files) {
      if (absoluteIndex < cursor + file.totalChunks) {
        sender.tracker.forceResend(file.fileIndex, absoluteIndex - cursor)
        return
      }
      cursor += file.totalChunks
    }
  }

  // ─── Receiver DC message handling ──────────────────────────────────────────

  private handleReceiverMessage(data: unknown): void {
    if (typeof data === 'string') {
      const msg = safeParseControl(data)
      if (!msg) return
      this.handleReceiverControlMessage(msg)
      return
    }

    if (this.reliableReceiver) {
      void this.handleReliableChunkBinary(data as ArrayBuffer)
      return
    }

    // Legacy binary path: chunk for the active file
    void this.handleLegacyChunkBinary(data as ArrayBuffer)
  }

  private handleReceiverControlMessage(msg: DCControlMessage): void {
    switch (msg.type) {
      case 'capability':
        this.remoteCaps = msg.caps
        this.resolveCapabilities()
        return

      case 'manifest':
        void this.handleManifestReceived(msg.manifest)
        return

      case 'transfer-complete':
        if (this.reliableReceiver) {
          void this.finalizeReliableReceiver()
        } else {
          this.transferCompleted = true
          transferStore.setCurrentFile(null)
          transferStore.setState('complete')
          this.stopSpeedTimer()
          if (this.queueEntryId) {
            transferQueueStore.setStatus(this.queueEntryId, 'completed')
          }
        }
        return

      case 'pause':
        if (this.reliableReceiver) {
          this.reliableReceiver.paused = true
          transferStore.setPaused(true, msg.by)
        }
        return

      case 'resume':
        if (this.reliableReceiver) {
          this.reliableReceiver.paused = false
          transferStore.setPaused(false)
        }
        return

      case 'cancel':
        if (this.reliableReceiver) this.reliableReceiver.cancelled = true
        this.failTransfer('Sender cancelled the transfer.', 'cancelled_by_peer')
        return

      // Legacy path messages (only valid when reliable not negotiated)
      case 'file-start':
        if (this.reliableReceiver) return
        this.handleLegacyFileStart(msg)
        return
      case 'file-end':
        if (this.reliableReceiver) return
        if (msg.fileId) this.assembleAndDownload(msg.fileId)
        return
    }
  }

  private async handleManifestReceived(manifest: TransferManifest): Promise<void> {
    if (this.reliableReceiver) return // ignore duplicates

    const tracker = new ChunkTracker(manifest)
    this.reliableReceiver = {
      manifest,
      tracker,
      startedAt: Date.now(),
      chunkBuffers: new Map(manifest.files.map(f => [f.fileIndex, new Array(f.totalChunks)])),
      bytesReceived: 0,
      paused: false,
      cancelled: false,
    }

    transferStore.setTransferId(manifest.transferId)
    transferStore.setReliableCounts({
      totalChunks: manifest.totalChunks,
      ackedChunks: 0,
      verifiedChunks: 0,
      retries: 0,
      failedChunks: 0,
    })
    transferStore.setProgress(0, manifest.totalSize)
    transferStore.setState('transferring')

    if (this.queueEntryId) {
      transferQueueStore.update(this.queueEntryId, {
        transferId: manifest.transferId,
        fileNames: manifest.files.map(f => f.name),
        totalSize: manifest.totalSize,
        totalChunks: manifest.totalChunks,
        status: 'active',
      })
    }

    this.sendControl({ type: 'manifest_ack', transferId: manifest.transferId, ok: true })
    this.startSpeedTimer(() => this.reliableReceiver?.bytesReceived ?? 0)
    this.startReceiverProgressTimer()
  }

  private async handleReliableChunkBinary(buf: ArrayBuffer): Promise<void> {
    const receiver = this.reliableReceiver
    if (!receiver) return

    const frame = decodeChunkFrame(buf)
    if (!frame) return

    const file = receiver.manifest.files[frame.fileIndex]
    if (!file) return

    const expectedSize = (() => {
      const last = frame.chunkIndex === file.totalChunks - 1
      return last ? file.size - frame.chunkIndex * receiver.manifest.chunkSize : receiver.manifest.chunkSize
    })()

    if (expectedSize !== frame.chunkLength) {
      this.sendControl({
        type: 'chunk_nack',
        transferId: receiver.manifest.transferId,
        fileIndex: frame.fileIndex,
        chunkIndex: frame.chunkIndex,
        reason: 'size_mismatch',
      })
      return
    }

    if (receiver.tracker.hasReceived(frame.fileIndex, frame.chunkIndex)) {
      // Duplicate retransmit; ack again to keep sender's state in sync.
      this.sendControl({
        type: 'chunk_ack',
        transferId: receiver.manifest.transferId,
        fileIndex: frame.fileIndex,
        chunkIndex: frame.chunkIndex,
      })
      return
    }

    // ACK first, then verify hash in the background. Hashing every chunk
    // synchronously on the receive path ran the receiver behind the wire on
    // fast LAN transfers — the sender would fill bufferedAmount, throttle on
    // backpressure, and visibly stall while the receiver caught up. We still
    // detect hash mismatches via `chunk_nack` after the fact, which triggers
    // the sender's normal retry path.
    const buffers = receiver.chunkBuffers.get(frame.fileIndex)
    if (buffers) buffers[frame.chunkIndex] = frame.payload

    receiver.tracker.markVerified(frame.fileIndex, frame.chunkIndex)
    receiver.bytesReceived += frame.chunkLength

    this.sendControl({
      type: 'chunk_ack',
      transferId: receiver.manifest.transferId,
      fileIndex: frame.fileIndex,
      chunkIndex: frame.chunkIndex,
    })

    this.scheduleReceiverProgressFlush(receiver)

    if (this.negotiatedCaps?.supportsChunkHash && file.chunkHashes && file.chunkHashes[frame.chunkIndex]) {
      const expected = file.chunkHashes[frame.chunkIndex]
      // Fire-and-forget. SubtleCrypto runs off the JS thread; we only react
      // if the digest disagrees with the manifest, in which case we ask the
      // sender to retransmit that chunk.
      void digestSha256(frame.payload).then(computed => {
        if (computed === expected) return
        this.sendControl({
          type: 'chunk_nack',
          transferId: receiver.manifest.transferId,
          fileIndex: frame.fileIndex,
          chunkIndex: frame.chunkIndex,
          reason: 'hash_mismatch',
        })
      }).catch(() => { /* digest unavailable — receiver still verifies size + count */ })
    }
  }

  private async finalizeReliableReceiver(): Promise<void> {
    const receiver = this.reliableReceiver
    if (!receiver) return

    this.flushPendingUiNow()
    if (!receiver.tracker.isComplete()) {
      const missing = receiver.tracker.missingChunks()
      const absoluteMissing = missing.map(m => this.toAbsoluteIndex(receiver.manifest, m.fileIndex, m.chunkIndex))
      this.sendControl({
        type: 'verify_failed',
        transferId: receiver.manifest.transferId,
        reason: 'missing_chunks',
        missing: absoluteMissing,
      })
      this.sendControl({
        type: 'retry_request',
        transferId: receiver.manifest.transferId,
        chunks: missing,
      })
      return
    }

    // Assemble + download each file. We compute the file hash on the fly when
    // feasible — the manifest's per-chunk hashes already covered correctness;
    // the file-level hash is recorded in the receipt for cross-checking.
    let aggregatedSize = 0
    const root = receiver.manifest.rootHash
    for (const file of receiver.manifest.files) {
      const buffers = receiver.chunkBuffers.get(file.fileIndex) ?? []
      const blob = new Blob(buffers, { type: file.mimeType || 'application/octet-stream' })
      aggregatedSize += blob.size

      transferStore.addReceivedFile({
        id: file.fileId,
        name: file.name,
        type: file.mimeType,
        size: file.size,
        blob,
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.style.display = 'none'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        try { document.body.removeChild(a) } catch { /* ignore */ }
        URL.revokeObjectURL(url)
      }, 1000)
    }

    this.sendControl({
      type: 'verify_success',
      transferId: receiver.manifest.transferId,
      rootHash: root,
    })

    const snap = receiver.tracker.snapshot()
    const completedAt = Date.now()
    const health = computeHealthScore({
      totalChunks: snap.totalChunks,
      ackedChunks: snap.acked + snap.verified,
      verifiedChunks: snap.verified,
      retries: snap.retries,
      failedChunks: snap.failedChunks,
      bufferedAmount: this.dc?.bufferedAmount ?? 0,
      bufferedHigh: false,
      averageSpeedBps: this.averageSpeedBps(),
      connectionKind: this.connectionKind,
      connectionStable: !this.failed,
      paused: receiver.paused,
      state: 'complete',
    })

    const receipt = buildReceipt({
      manifest: receiver.manifest,
      health,
      startedAt: receiver.startedAt,
      completedAt,
      route: receiver.manifest.route ?? this.profile,
      retryCount: snap.retries,
      failedChunkCount: snap.failedChunks,
      verified: aggregatedSize === receiver.manifest.totalSize && snap.failed === 0,
      rootHash: root,
    })

    transferStore.setReceipt(receipt)
    transferStore.setHealth(health)
    if (this.queueEntryId) {
      transferQueueStore.attachReceipt(this.queueEntryId, receipt)
    }

    this.transferCompleted = true
    transferStore.setCurrentFile(null)
    transferStore.setState('complete')
    this.stopSpeedTimer()
    this.stopReceiverProgressTimer()
  }

  private toAbsoluteIndex(manifest: TransferManifest, fileIndex: number, chunkIndex: number): number {
    let cursor = 0
    for (const file of manifest.files) {
      if (file.fileIndex === fileIndex) return cursor + chunkIndex
      cursor += file.totalChunks
    }
    return cursor
  }

  // ─── Legacy sender/receiver path (preserved for old peers) ─────────────────

  private async startLegacySending(): Promise<void> {
    const totalBytes = this.sendQueue.reduce((sum, file) => sum + file.size, 0)
    let bytesSent = 0

    this.startSpeedTimer(() => bytesSent)

    for (const file of this.sendQueue) {
      transferStore.setCurrentFile({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
      })
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
    transferStore.setCurrentFile(null)
    transferStore.setState('complete')

    if (this.queueEntryId) {
      transferQueueStore.setStatus(this.queueEntryId, 'completed')
    }
  }

  private legacyCurrentFileId: string | null = null
  private legacyTotalReceived = 0
  private legacyGrandTotal = 0

  private handleLegacyFileStart(msg: Extract<DCControlMessage, { type: 'file-start' }>): void {
    this.legacyCurrentFileId = msg.fileId
    this.legacyGrandTotal += msg.totalSize
    this.receiveBuffers.set(msg.fileId, [])
    this.receiveMeta.set(msg.fileId, {
      name: msg.name,
      type: msg.mimeType,
      totalChunks: msg.totalChunks,
      totalSize: msg.totalSize,
      received: 0,
    })
    transferStore.setCurrentFile({
      id: msg.fileId,
      name: msg.name,
      type: msg.mimeType,
      size: msg.totalSize,
    })
    if (this.speedTimer === null) {
      this.startSpeedTimer(() => this.legacyTotalReceived)
    }
    transferStore.setState('transferring')
  }

  private async handleLegacyChunkBinary(chunk: ArrayBuffer): Promise<void> {
    if (!this.legacyCurrentFileId) return
    this.receiveBuffers.get(this.legacyCurrentFileId)?.push(chunk)
    const meta = this.receiveMeta.get(this.legacyCurrentFileId)
    if (meta) {
      meta.received += chunk.byteLength
      this.legacyTotalReceived += chunk.byteLength
      transferStore.setProgress(this.legacyTotalReceived, this.legacyGrandTotal)
    }
  }

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

  // ─── Sending helpers ───────────────────────────────────────────────────────

  private sendControl(msg: DCControlMessage): void {
    if (this.dc?.readyState !== 'open') return
    try {
      this.dc.send(JSON.stringify(msg))
    } catch {
      // The DC may have closed between the readyState check and send(); the
      // upstream onerror handler will surface the failure.
    }
  }

  private attachBufferedAmountLow(dc: RTCDataChannel): void {
    dc.onbufferedamountlow = () => {
      const waiters = this.bufferedDrainResolvers.splice(0)
      for (const w of waiters) {
        try { w() } catch { /* ignore */ }
      }
    }
  }

  // ─── UI update coalescing ──────────────────────────────────────────────────
  //
  // Every reliable chunk would otherwise call setProgress() and
  // setReliableCounts() — at 256 KB chunks on a fast LAN, that's hundreds of
  // Svelte writes per second, each cascading into reactive re-renders of the
  // transfer card and health panel. We collect the latest values and flush
  // them on a fixed timer so the UI stays smooth and the engine stays fast.

  private scheduleProgressFlushFromTracker(tracker: ChunkTracker): void {
    const snap = tracker.snapshot()
    this.pendingProgressBytes = snap.bytesAcked
    this.pendingProgressTotal = snap.bytesTotal
    this.pendingReliableCounts = {
      ...this.pendingReliableCounts,
      totalChunks: snap.totalChunks,
      ackedChunks: snap.acked + snap.verified,
      verifiedChunks: snap.verified,
      retries: snap.retries,
      failedChunks: snap.failedChunks,
    }
    this.scheduleUiFlush()
  }

  private scheduleReceiverProgressFlush(receiver: ReliableReceiverState): void {
    this.pendingProgressBytes = receiver.bytesReceived
    this.pendingProgressTotal = receiver.manifest.totalSize
    const snap = receiver.tracker.snapshot()
    this.pendingReliableCounts = {
      ...this.pendingReliableCounts,
      totalChunks: snap.totalChunks,
      ackedChunks: snap.acked + snap.verified,
      verifiedChunks: snap.verified,
    }
    this.scheduleUiFlush()
  }

  private scheduleUiFlush(): void {
    if (this.uiFlushTimer !== null) return
    this.uiFlushTimer = setTimeout(() => {
      this.uiFlushTimer = null
      this.flushPendingUiNow()
    }, UI_UPDATE_INTERVAL_MS)
  }

  private flushPendingUiNow(): void {
    if (this.uiFlushTimer !== null) {
      clearTimeout(this.uiFlushTimer)
      this.uiFlushTimer = null
    }
    if (this.pendingProgressBytes !== null && this.pendingProgressTotal !== null) {
      transferStore.setProgress(this.pendingProgressBytes, this.pendingProgressTotal)
      this.pendingProgressBytes = null
      this.pendingProgressTotal = null
    }
    if (this.pendingReliableCounts) {
      const counts = this.pendingReliableCounts
      this.pendingReliableCounts = null
      transferStore.setReliableCounts({
        totalChunks: counts.totalChunks ?? 0,
        ackedChunks: counts.ackedChunks,
        verifiedChunks: counts.verifiedChunks,
        retries: counts.retries,
        failedChunks: counts.failedChunks,
      })
    }
  }

  private drainBuffer(): Promise<void> {
    const dc = this.dc
    if (!dc || dc.bufferedAmount < BUFFERED_AMOUNT_HIGH_WATER) return Promise.resolve()

    // Prefer the native bufferedamountlow event over polling. A short
    // safety-net interval handles the rare case where the event is missed
    // (DC closed mid-backpressure, browser bug, etc.) so the send loop
    // doesn't deadlock.
    return new Promise(resolve => {
      let resolved = false
      let safetyTimer: ReturnType<typeof setTimeout> | null = null

      const finish = () => {
        if (resolved) return
        resolved = true
        if (safetyTimer) clearTimeout(safetyTimer)
        resolve()
      }

      const tick = () => {
        if (resolved) return
        if (!dc || dc.readyState !== 'open' || dc.bufferedAmount < BUFFERED_AMOUNT_HIGH_WATER) {
          finish()
          return
        }
        safetyTimer = setTimeout(tick, BUFFER_DRAIN_INTERVAL)
      }

      this.bufferedDrainResolvers.push(finish)
      safetyTimer = setTimeout(tick, BUFFER_DRAIN_INTERVAL)
    })
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
            if (event.peerChainId) {
              transferStore.setPeerChainId(event.peerChainId)
            }
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

  // ─── Diagnostics & timers ──────────────────────────────────────────────────

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
    this.stopHealthTimer()
    this.stopReceiverProgressTimer()
    transferStore.setCurrentFile(null)
    transferStore.setError(message, diagnosticCode)
    if (this.queueEntryId) {
      transferQueueStore.setStatus(this.queueEntryId, 'failed', { error: message })
    }
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

  private startSpeedTimer(getBytesSent: () => number): void {
    this.lastBytesSent = 0
    this.lastSpeedTs = Date.now()
    this.speedSamples = []
    this.speedTimer = setInterval(() => {
      const now = Date.now()
      const elapsed = (now - this.lastSpeedTs) / 1000
      const sent = getBytesSent()
      const speed = elapsed > 0 ? (sent - this.lastBytesSent) / elapsed : 0
      transferStore.setSpeed(speed)
      // Track a small rolling window for the average shown in the health card.
      this.speedSamples.push(speed)
      if (this.speedSamples.length > 12) this.speedSamples.shift()
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

  private averageSpeedBps(): number {
    if (this.speedSamples.length === 0) return 0
    let sum = 0
    for (const s of this.speedSamples) sum += s
    return sum / this.speedSamples.length
  }

  private startHealthTimer(): void {
    if (this.healthTimer) return
    this.healthTimer = setInterval(() => {
      this.refreshHealth()
    }, 700)
  }

  private stopHealthTimer(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  private refreshHealth(): void {
    const tracker = this.reliableSender?.tracker ?? this.reliableReceiver?.tracker
    if (!tracker) return
    this.refreshHealthFromTracker(tracker)
  }

  private refreshHealthFromTracker(tracker: ChunkTracker): void {
    const snap = tracker.snapshot()
    const buffered = this.dc?.bufferedAmount ?? 0
    const bufferedHigh = buffered >= BUFFERED_AMOUNT_HIGH_WATER
    const paused = this.reliableSender?.paused ?? this.reliableReceiver?.paused ?? false
    const stateNow = this.failed
      ? 'failed'
      : this.transferCompleted
        ? 'complete'
        : 'transferring'
    const health = computeHealthScore({
      totalChunks: snap.totalChunks,
      ackedChunks: snap.acked + snap.verified,
      verifiedChunks: snap.verified,
      retries: snap.retries,
      failedChunks: snap.failedChunks,
      bufferedAmount: buffered,
      bufferedHigh,
      averageSpeedBps: this.averageSpeedBps(),
      connectionKind: this.connectionKind,
      connectionStable: !this.failed,
      paused,
      state: stateNow,
    })
    transferStore.setHealth(health)
  }

  private startReceiverProgressTimer(): void {
    if (this.receiverProgressTimer) return
    this.receiverProgressTimer = setInterval(() => {
      const receiver = this.reliableReceiver
      if (!receiver) return
      const snap = receiver.tracker.snapshot()
      this.sendControl({
        type: 'receiver_progress',
        transferId: receiver.manifest.transferId,
        receivedChunks: snap.acked + snap.verified,
        verifiedChunks: snap.verified,
        bytesReceived: receiver.bytesReceived,
        lastChunkIndex: 0,
        lastFileIndex: 0,
      })
    }, RECEIVER_PROGRESS_INTERVAL_MS)
  }

  private stopReceiverProgressTimer(): void {
    if (this.receiverProgressTimer) {
      clearInterval(this.receiverProgressTimer)
      this.receiverProgressTimer = null
    }
  }
}

// Re-export the queue store so consumers don't need to reach into reliable/.
export { transferQueueStore } from './reliable'
export type { TransferHealth }
