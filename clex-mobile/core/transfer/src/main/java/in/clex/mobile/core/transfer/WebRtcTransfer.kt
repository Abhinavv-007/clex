package in.clex.mobile.core.transfer

import in.clex.mobile.core.model.ConnectionKind
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.core.network.signaling.ClientMessage
import in.clex.mobile.core.network.signaling.IceCandidate
import in.clex.mobile.core.network.signaling.ServerMessage
import in.clex.mobile.core.network.signaling.SignalingClient
import in.clex.mobile.core.model.ReceivedFile
import in.clex.mobile.core.model.TransferFilePreview
import in.clex.mobile.core.model.TransferState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.webrtc.DataChannel
import org.webrtc.IceCandidate as RtcIceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.UUID

// ── Protocol constants — must match web transfer/types.ts ────────────────────

/** Data channel label — MUST match web: export const DC_LABEL = 'clex-transfer' */
private const val DC_LABEL = "clex-transfer"

/** Chunk size in bytes — MUST match web: export const CHUNK_SIZE = 64 * 1024 */
private const val CHUNK_SIZE = 64 * 1024

/** Backpressure threshold for data channel buffered amount */
private const val BUFFER_THRESHOLD = 256 * 1024

/**
 * WebRTC transfer engine — mirrors web WebRTCTransfer class.
 *
 * Local mode: iceServers = [] (no STUN) → matches getRTCConfig('local')
 * Direct mode: configured STUN servers → matches getRTCConfig('webrtc')
 *
 * Signaling message flow exactly mirrors web:
 *   sender waits for peer_joined → creates offer
 *   receiver registers → waits for offer → sends answer
 */
class WebRtcTransfer(
    private val signalingBaseUrl: String,
    private val roomCode: String,
    private val role: String,        // "sender" | "receiver"
    private val method: TransferMethod,
    private val stateMachine: TransferStateMachine,
    private val stunServers: List<String> = listOf(
        "stun:stun.l.google.com:19302",
        "stun:stun.cloudflare.com:3478",
    ),
    private val factory: PeerConnectionFactory,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val signaling = SignalingClient(signalingBaseUrl, roomCode)
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null

    // ── Sender-side file queue ────────────────────────────────────────────────
    private var pendingFiles: List<Pair<ByteArray, TransferFilePreview>> = emptyList()

    // ── Receiver-side assembly buffers ────────────────────────────────────────
    private var assemblyBuffer = ByteArrayOutputStream()
    private var currentReceivingFile: Triple<String, String, String>? = null  // (id, name, mime)

    /** Attach files to send (sender role only). */
    fun prepareFiles(files: List<Pair<ByteArray, TransferFilePreview>>) {
        pendingFiles = files
    }

    /** Connect as sender — join signaling, wait for peer, then create offer. */
    suspend fun initSender() {
        stateMachine.setState(TransferState.PREPARING)
        val connectResult = signaling.connect("sender", method)
        if (connectResult.isFailure) {
            stateMachine.setError("Could not connect to signaling server")
            return
        }
        stateMachine.setState(TransferState.WAITING_PEER)
        listenSignaling()
    }

    /** Connect as receiver — join signaling, wait for offer. */
    suspend fun initReceiver() {
        stateMachine.setState(TransferState.PREPARING)
        val connectResult = signaling.connect("receiver", method)
        if (connectResult.isFailure) {
            stateMachine.setError("Could not connect to signaling server")
            return
        }
        stateMachine.setState(TransferState.WAITING_PEER)
        listenSignaling()
    }

    fun destroy() {
        signaling.disconnect()
        dataChannel?.close()
        peerConnection?.close()
        peerConnection = null
        dataChannel = null
    }

    // ── Signaling event loop ──────────────────────────────────────────────────

    private fun listenSignaling() {
        scope.launch {
            signaling.events.collect { msg ->
                when (msg) {
                    is ServerMessage.PeerJoined -> {
                        stateMachine.setState(TransferState.CONNECTING)
                        if (role == "sender") {
                            setupPeerConnection()
                            createAndSendOffer()
                        }
                    }
                    is ServerMessage.Offer -> {
                        if (role == "receiver") {
                            if (peerConnection == null) setupPeerConnection()
                            handleRemoteOffer(msg.sdp)
                        }
                    }
                    is ServerMessage.Answer -> {
                        peerConnection?.setRemoteDescription(SimpleSdpObserver(), SessionDescription(
                            SessionDescription.Type.ANSWER, msg.sdp
                        ))
                    }
                    is ServerMessage.Ice -> {
                        peerConnection?.addIceCandidate(
                            RtcIceCandidate(msg.candidate.sdpMid, msg.candidate.sdpMLineIndex ?: 0, msg.candidate.candidate)
                        )
                    }
                    is ServerMessage.PeerLeft -> {
                        if (stateMachine.state.value.state == TransferState.TRANSFERRING ||
                            stateMachine.state.value.state == TransferState.CONNECTING) {
                            stateMachine.setError("Peer disconnected")
                        }
                    }
                    is ServerMessage.Error -> {
                        stateMachine.setError("Signaling error: ${msg.code}")
                    }
                    else -> { /* Joined, Pong, Unknown — no action needed */ }
                }
            }
        }
    }

    // ── PeerConnection setup ──────────────────────────────────────────────────

    private fun setupPeerConnection() {
        val iceServers = if (method == TransferMethod.LOCAL) {
            // Local mode: no STUN — host-only candidates only
            emptyList()
        } else {
            stunServers.map { url ->
                PeerConnection.IceServer.builder(url).createIceServer()
            }
        }

        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }

        peerConnection = factory.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: RtcIceCandidate) {
                signaling.send(ClientMessage.Ice(IceCandidate(
                    candidate           = candidate.sdp,
                    sdpMid              = candidate.sdpMid,
                    sdpMLineIndex       = candidate.sdpMLineIndex,
                    usernameFragment    = null,
                )))
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                if (state == PeerConnection.IceConnectionState.CONNECTED ||
                    state == PeerConnection.IceConnectionState.COMPLETED) {
                    // Inspect candidate pair for LAN vs internet classification
                    checkConnectionKind()
                }
                if (state == PeerConnection.IceConnectionState.FAILED ||
                    state == PeerConnection.IceConnectionState.DISCONNECTED) {
                    stateMachine.setError("WebRTC connection failed")
                }
            }

            override fun onDataChannel(dc: DataChannel) {
                // Receiver side: data channel opened by sender
                if (role == "receiver") {
                    dataChannel = dc
                    attachReceiverDataChannelListener(dc)
                }
            }

            // Required overrides
            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(candidates: Array<out RtcIceCandidate>?) {}
            override fun onAddStream(stream: org.webrtc.MediaStream?) {}
            override fun onRemoveStream(stream: org.webrtc.MediaStream?) {}
            override fun onRenegotiationNeeded() {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
        })

        if (role == "sender") {
            // Sender creates the data channel
            val dcInit = DataChannel.Init().apply {
                ordered = true
                label = DC_LABEL
            }
            dataChannel = peerConnection?.createDataChannel(DC_LABEL, dcInit)
            dataChannel?.let { attachSenderDataChannelListener(it) }
        }
    }

    private fun createAndSendOffer() {
        val constraints = MediaConstraints()
        peerConnection?.createOffer(object : SimpleSdpObserver() {
            override fun onCreateSuccess(sdp: SessionDescription) {
                peerConnection?.setLocalDescription(SimpleSdpObserver(), sdp)
                signaling.send(ClientMessage.Offer(sdp.description))
            }
        }, constraints)
    }

    private fun handleRemoteOffer(sdpString: String) {
        val sdp = SessionDescription(SessionDescription.Type.OFFER, sdpString)
        peerConnection?.setRemoteDescription(object : SimpleSdpObserver() {
            override fun onSetSuccess() {
                val constraints = MediaConstraints()
                peerConnection?.createAnswer(object : SimpleSdpObserver() {
                    override fun onCreateSuccess(answer: SessionDescription) {
                        peerConnection?.setLocalDescription(SimpleSdpObserver(), answer)
                        signaling.send(ClientMessage.Answer(answer.description))
                    }
                }, constraints)
            }
        }, sdp)
    }

    // ── Sender data channel ───────────────────────────────────────────────────

    private fun attachSenderDataChannelListener(dc: DataChannel) {
        dc.registerObserver(object : DataChannel.Observer {
            override fun onStateChange() {
                if (dc.state() == DataChannel.State.OPEN) {
                    stateMachine.setState(TransferState.TRANSFERRING)
                    scope.launch { sendAllFiles(dc) }
                }
            }
            override fun onMessage(buffer: DataChannel.Buffer) {}
            override fun onBufferedAmountChange(previousAmount: Long) {}
        })
    }

    private suspend fun sendAllFiles(dc: DataChannel) {
        val files = pendingFiles
        val totalBytes = files.sumOf { it.first.size.toLong() }
        var sentBytes = 0L

        for ((bytes, preview) in files) {
            stateMachine.setCurrentFile(preview)

            // file-start control message
            val startMsg = """{"type":"file-start","fileId":"${preview.id}","name":"${preview.name}","mimeType":"${preview.mimeType}","totalChunks":${(bytes.size + CHUNK_SIZE - 1) / CHUNK_SIZE},"totalSize":${bytes.size}}"""
            dc.send(DataChannel.Buffer(ByteBuffer.wrap(startMsg.toByteArray()), false))

            // binary chunks
            var offset = 0
            while (offset < bytes.size) {
                val end = minOf(offset + CHUNK_SIZE, bytes.size)
                val chunk = bytes.copyOfRange(offset, end)
                // Backpressure: wait if buffer is full
                while (dc.bufferedAmount() > BUFFER_THRESHOLD) {
                    kotlinx.coroutines.delay(10)
                }
                dc.send(DataChannel.Buffer(ByteBuffer.wrap(chunk), true))
                sentBytes += chunk.size
                stateMachine.setProgress(sentBytes, totalBytes)
                offset = end
            }

            // file-end control message
            val endMsg = """{"type":"file-end","fileId":"${preview.id}"}"""
            dc.send(DataChannel.Buffer(ByteBuffer.wrap(endMsg.toByteArray()), false))
        }

        // transfer-complete control message
        val completeMsg = """{"type":"transfer-complete"}"""
        dc.send(DataChannel.Buffer(ByteBuffer.wrap(completeMsg.toByteArray()), false))

        stateMachine.setCurrentFile(null)
        stateMachine.setState(TransferState.COMPLETE)
    }

    // ── Receiver data channel ─────────────────────────────────────────────────

    private fun attachReceiverDataChannelListener(dc: DataChannel) {
        stateMachine.setState(TransferState.TRANSFERRING)
        dc.registerObserver(object : DataChannel.Observer {
            override fun onStateChange() {}
            override fun onBufferedAmountChange(previousAmount: Long) {}

            override fun onMessage(buffer: DataChannel.Buffer) {
                if (buffer.binary) {
                    // Binary chunk — append to assembly buffer
                    val bytes = ByteArray(buffer.data.remaining())
                    buffer.data.get(bytes)
                    assemblyBuffer.write(bytes)
                } else {
                    // Control message (JSON)
                    val text = String(buffer.data.array(), buffer.data.position(), buffer.data.remaining())
                    handleControlMessage(text)
                }
            }
        })
    }

    private fun handleControlMessage(text: String) {
        try {
            val obj = org.json.JSONObject(text)
            when (obj.getString("type")) {
                "file-start" -> {
                    assemblyBuffer.reset()
                    currentReceivingFile = Triple(
                        obj.getString("fileId"),
                        obj.getString("name"),
                        obj.getString("mimeType"),
                    )
                }
                "file-end" -> {
                    val (id, name, mime) = currentReceivingFile ?: return
                    val bytes = assemblyBuffer.toByteArray()
                    stateMachine.addReceivedFile(
                        ReceivedFile(id = id, name = name, mimeType = mime, size = bytes.size.toLong(), bytes = bytes)
                    )
                    assemblyBuffer.reset()
                    currentReceivingFile = null
                }
                "transfer-complete" -> {
                    stateMachine.setCurrentFile(null)
                    stateMachine.setState(TransferState.COMPLETE)
                }
            }
        } catch (e: Exception) {
            // Malformed control message — skip
        }
    }

    // ── LAN vs internet classification ────────────────────────────────────────

    /**
     * Inspect selected ICE candidate pair to classify the connection.
     * Web getConnectionKindFromStats(): if any selected candidate is 'srflx' → internet; else LAN.
     */
    private fun checkConnectionKind() {
        peerConnection?.getStats { report ->
            var kind = ConnectionKind.UNKNOWN
            for (stats in report.statsMap.values) {
                if (stats.type == "candidate-pair" && stats.members["state"] == "succeeded") {
                    val localId = stats.members["localCandidateId"] as? String
                    val localStats = localId?.let { report.statsMap[it] }
                    val candidateType = localStats?.members?.get("candidateType") as? String
                    kind = if (candidateType == "srflx") ConnectionKind.INTERNET else ConnectionKind.LAN
                    break
                }
            }
            stateMachine.setConnectionKind(kind)

            // Local mode validation — if connection is internet, fail
            if (method == TransferMethod.LOCAL && kind == ConnectionKind.INTERNET) {
                stateMachine.setError(
                    "Local mode requires both devices on the same network. " +
                    "Use Direct mode for internet transfers.",
                    "LOCAL_MODE_INTERNET"
                )
            }
        }
    }
}

/** Minimal SdpObserver with no-op defaults. */
private open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(sdp: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(error: String?) {}
    override fun onSetFailure(error: String?) {}
}
