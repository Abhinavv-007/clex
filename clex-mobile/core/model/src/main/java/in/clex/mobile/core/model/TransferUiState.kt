package in.clex.mobile.core.model

/**
 * Mirror of web transferStore state shape.
 *
 * Used as the canonical ViewModel UI state for both sender and receiver flows.
 */
data class TransferUiState(
    val state: TransferState = TransferState.IDLE,
    val method: TransferMethod = TransferMethod.WEBRTC,
    val roomCode: RoomCode = RoomCode.generate(),
    val progress: Int = 0,             // 0-100
    val bytesSent: Long = 0L,
    val bytesTotal: Long = 0L,
    val speedBps: Long = 0L,
    val nearby: Boolean = false,
    val connectionKind: ConnectionKind = ConnectionKind.UNKNOWN,
    val diagnosticCode: String? = null,
    val error: String? = null,
    val driveLink: String? = null,
    val currentFile: TransferFilePreview? = null,
    val receivedFiles: List<ReceivedFile> = emptyList(),
)

/** Lightweight preview of the currently-in-flight transfer file. */
data class TransferFilePreview(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: Long,
)

/** A file successfully received via WebRTC. */
data class ReceivedFile(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val bytes: ByteArray,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ReceivedFile) return false
        return id == other.id && name == other.name && mimeType == other.mimeType && size == other.size
    }
    override fun hashCode(): Int = id.hashCode()
}

/** Tool chain suggestion — mirrors web ChainSuggestion */
data class ChainSuggestion(
    val toolId: String,      // ToolId.webId or "share"
    val label: String,
    val description: String,
)

/** Result of a tool run — mirrors web ToolResult */
data class ToolResult(
    val toolId: ToolId,
    val inputFileIds: List<String>,
    val outputBlob: ByteArray,
    val outputName: String,
    val outputMimeType: String,
    val completedAt: Long,
    val suggestions: List<ChainSuggestion>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ToolResult) return false
        return toolId == other.toolId && outputName == other.outputName && outputMimeType == other.outputMimeType
    }
    override fun hashCode(): Int = 31 * toolId.hashCode() + outputName.hashCode()
}
