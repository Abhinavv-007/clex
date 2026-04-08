package in.clex.mobile.core.network.signaling

import in.clex.mobile.core.model.TransferMethod
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

// ─── Signaling message types ─────────────────────────────────────────────────
// Exact JSON message shapes from transfer/signaling.ts
// These must NOT be renamed — the signaling worker validates them by type string.

sealed class ClientMessage {
    data class Offer(val sdp: String)              : ClientMessage()
    data class Answer(val sdp: String)             : ClientMessage()
    data class Ice(val candidate: IceCandidate)    : ClientMessage()
    object Ping                                     : ClientMessage()
}

data class IceCandidate(
    val candidate: String,
    val sdpMid: String? = null,
    val sdpMLineIndex: Int? = null,
    val usernameFragment: String? = null,
)

sealed class ServerMessage {
    data class Joined(val role: String, val mode: String)  : ServerMessage()
    data class PeerJoined(val mode: String)                : ServerMessage()
    data class Offer(val sdp: String)                      : ServerMessage()
    data class Answer(val sdp: String)                     : ServerMessage()
    data class Ice(val candidate: IceCandidate)            : ServerMessage()
    object PeerLeft                                         : ServerMessage()
    data class Error(val code: String)                     : ServerMessage()
    object Pong                                             : ServerMessage()
    data class Unknown(val raw: String)                    : ServerMessage()
}

/**
 * WebSocket signaling client.
 *
 * Mirrors the web SignalingClient from transfer/signaling.ts:
 * - URL format: {baseUrl}/room/{code}?role={sender|receiver}&mode={webrtc|local}
 * - Ping interval: 25 seconds
 * - Same JSON message shapes
 */
class SignalingClient(
    baseUrl: String,
    roomCode: String,
    private val okHttpClient: OkHttpClient = OkHttpClient(),
) {
    // URL: {baseUrl}/room/{code}
    private val roomUrl = "${baseUrl.trimEnd('/')}/room/$roomCode"

    private var ws: WebSocket? = null
    private val _events = Channel<ServerMessage>(Channel.UNLIMITED)
    val events: Flow<ServerMessage> = _events.receiveAsFlow()

    private var pingRunnable: (() -> Unit)? = null

    // PING_INTERVAL matches web: 25_000 ms
    private val PING_INTERVAL_MS = 25_000L

    private val json = Json { ignoreUnknownKeys = true }

    /** Connect as sender or receiver with a given transfer profile. Returns after 'joined'. */
    suspend fun connect(role: String, mode: TransferMethod): Result<Unit> {
        val params = "role=$role&mode=${mode.webValue}"
        val url = "$roomUrl?$params"

        val resultChannel = Channel<Result<Unit>>(1)

        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                startPing(webSocket)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = parseServerMessage(text)
                if (msg is ServerMessage.Joined) {
                    resultChannel.trySend(Result.success(Unit))
                }
                _events.trySend(msg)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                val error = Result.failure<Unit>(t)
                resultChannel.trySend(error)
                _events.trySend(ServerMessage.Error("WS_ERROR"))
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                stopPing()
                webSocket.close(1000, null)
                _events.trySend(ServerMessage.PeerLeft)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                stopPing()
                _events.trySend(ServerMessage.PeerLeft)
            }
        }

        val request = Request.Builder().url(url).build()
        ws = okHttpClient.newWebSocket(request, listener)

        return resultChannel.receive()
    }

    fun send(msg: ClientMessage) {
        val json = encodeClientMessage(msg)
        ws?.send(json)
    }

    fun disconnect() {
        stopPing()
        ws?.close(1000, "client disconnect")
        ws = null
    }

    private fun startPing(webSocket: WebSocket) {
        val pingHandler = android.os.Handler(android.os.Looper.getMainLooper())
        val runnable = object : Runnable {
            override fun run() {
                webSocket.send("""{"type":"ping"}""")
                pingHandler.postDelayed(this, PING_INTERVAL_MS)
            }
        }
        pingRunnable = { pingHandler.removeCallbacks(runnable) }
        pingHandler.postDelayed(runnable, PING_INTERVAL_MS)
    }

    private fun stopPing() {
        pingRunnable?.invoke()
        pingRunnable = null
    }

    private fun encodeClientMessage(msg: ClientMessage): String = when (msg) {
        is ClientMessage.Offer  -> """{"type":"offer","sdp":${Json.encodeToString(msg.sdp)}}"""
        is ClientMessage.Answer -> """{"type":"answer","sdp":${Json.encodeToString(msg.sdp)}}"""
        is ClientMessage.Ice    -> buildString {
            append("""{"type":"ice","candidate":{"candidate":""")
            append(Json.encodeToString(msg.candidate.candidate))
            msg.candidate.sdpMid?.let { append(""","sdpMid":${Json.encodeToString(it)}""") }
            msg.candidate.sdpMLineIndex?.let { append(""","sdpMLineIndex":$it""") }
            msg.candidate.usernameFragment?.let { append(""","usernameFragment":${Json.encodeToString(it)}""") }
            append("}}")
        }
        ClientMessage.Ping      -> """{"type":"ping"}"""
    }

    private fun parseServerMessage(text: String): ServerMessage {
        return try {
            val obj = org.json.JSONObject(text)
            when (val type = obj.getString("type")) {
                "joined"      -> ServerMessage.Joined(
                    role = obj.optString("role"),
                    mode = obj.optString("mode"),
                )
                "peer_joined" -> ServerMessage.PeerJoined(mode = obj.optString("mode"))
                "offer"       -> ServerMessage.Offer(sdp = obj.getString("sdp"))
                "answer"      -> ServerMessage.Answer(sdp = obj.getString("sdp"))
                "ice"         -> {
                    val c = obj.getJSONObject("candidate")
                    ServerMessage.Ice(IceCandidate(
                        candidate           = c.getString("candidate"),
                        sdpMid              = c.optString("sdpMid").takeIf { it.isNotEmpty() },
                        sdpMLineIndex       = if (c.has("sdpMLineIndex")) c.getInt("sdpMLineIndex") else null,
                        usernameFragment    = c.optString("usernameFragment").takeIf { it.isNotEmpty() },
                    ))
                }
                "peer_left"   -> ServerMessage.PeerLeft
                "error"       -> ServerMessage.Error(code = obj.optString("code", "UNKNOWN"))
                "pong"        -> ServerMessage.Pong
                else          -> ServerMessage.Unknown(text)
            }
        } catch (e: Exception) {
            ServerMessage.Unknown(text)
        }
    }
}
