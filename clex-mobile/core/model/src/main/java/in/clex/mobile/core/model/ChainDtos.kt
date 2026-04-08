package in.clex.mobile.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ─── Chain API request/response DTOs ─────────────────────────────────────────
// Field names MUST match the chain worker JSON schema exactly.

@Serializable
data class ChainRegisterRequest(
    @SerialName("chain_id") val chainId: String,
)

@Serializable
data class ChainFile(
    val category: String,  // "image" | "pdf" | "document" | "archive" | "video" | "audio" | "other"
    val type: String,      // MIME type
    val size: Long,
    val hash: String?,     // SHA-256 hex (64 chars) or null if unavailable
)

@Serializable
data class ChainSessionRequest(
    @SerialName("sender_chain_id") val senderChainId: String,
    val route: String,     // "webrtc" | "local" | "drive" — TransferMethod.webValue
    val files: List<ChainFile>,
)

@Serializable
data class ChainSessionResponse(
    @SerialName("session_id") val sessionId: String,
    @SerialName("ledger_index") val ledgerIndex: Long,
)

@Serializable
data class ChainEventRequest(
    // "registered" | "waiting_peer" | "connecting" | "transferring" |
    // "completed" | "cancelled" | "failed" | "abandoned"
    val status: String,
    @SerialName("receiver_chain_id") val receiverChainId: String? = null,
)

@Serializable
data class ChainStats(
    @SerialName("total_sessions") val totalSessions: Long,
    @SerialName("total_chains") val totalChains: Long,
    @SerialName("completed_sessions") val completedSessions: Long,
)

@Serializable
data class ChainExplorerPage(
    val sessions: List<ChainSessionSummary>,
    val total: Long,
    val page: Int,
    val limit: Int,
)

@Serializable
data class ChainSessionSummary(
    @SerialName("session_id") val sessionId: String,
    @SerialName("sender_chain_id") val senderChainId: String,
    @SerialName("receiver_chain_id") val receiverChainId: String?,
    val route: String,
    val status: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("ledger_index") val ledgerIndex: Long?,
    @SerialName("files_json") val filesJson: String?,
)

@Serializable
data class ChainSessionDetail(
    @SerialName("session_id") val sessionId: String,
    @SerialName("sender_chain_id") val senderChainId: String,
    @SerialName("receiver_chain_id") val receiverChainId: String?,
    val route: String,
    val status: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("prior_hash") val priorHash: String?,
    @SerialName("record_hash") val recordHash: String?,
    @SerialName("ledger_index") val ledgerIndex: Long?,
    @SerialName("files_json") val filesJson: String?,
    val events: List<ChainEvent>,
)

@Serializable
data class ChainEvent(
    @SerialName("session_id") val sessionId: String,
    val status: String,
    val ts: String,
)
