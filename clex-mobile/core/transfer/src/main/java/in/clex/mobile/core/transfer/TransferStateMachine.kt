package in.clex.mobile.core.transfer

import in.clex.mobile.core.model.ConnectionKind
import in.clex.mobile.core.model.ReceivedFile
import in.clex.mobile.core.model.TransferFilePreview
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.core.model.TransferState
import in.clex.mobile.core.model.TransferUiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Transfer state machine — mirrors web createTransferStore().
 *
 * Manages all state transitions for both sender and receiver flows.
 * Initial state: idle with a fresh room code.
 */
class TransferStateMachine {

    private val _state = MutableStateFlow(TransferUiState())
    val state: StateFlow<TransferUiState> = _state.asStateFlow()

    fun setState(newState: TransferState) {
        _state.update { it.copy(state = newState) }
    }

    /**
     * Switching method resets progress/error/nearby/connectionKind/driveLink/files —
     * exactly matching web transferStore.setMethod().
     */
    fun setMethod(method: TransferMethod) {
        _state.update {
            it.copy(
                method          = method,
                state           = TransferState.IDLE,
                error           = null,
                nearby          = false,
                connectionKind  = ConnectionKind.UNKNOWN,
                diagnosticCode  = null,
                driveLink       = null,
                currentFile     = null,
                receivedFiles   = emptyList(),
            )
        }
    }

    fun setProgress(bytesSent: Long, bytesTotal: Long) {
        val pct = if (bytesTotal > 0) ((bytesSent.toDouble() / bytesTotal) * 100)
            .coerceIn(0.0, 100.0).toInt() else 0
        _state.update { it.copy(bytesSent = bytesSent, bytesTotal = bytesTotal, progress = pct) }
    }

    fun setSpeed(speedBps: Long) {
        _state.update { it.copy(speedBps = speedBps) }
    }

    fun setCurrentFile(file: TransferFilePreview?) {
        _state.update { it.copy(currentFile = file) }
    }

    fun setConnectionKind(kind: ConnectionKind) {
        _state.update { it.copy(connectionKind = kind, nearby = kind == ConnectionKind.LAN) }
    }

    fun setError(error: String, diagnosticCode: String? = null) {
        _state.update {
            it.copy(
                state          = TransferState.FAILED,
                error          = error,
                currentFile    = null,
                diagnosticCode = diagnosticCode ?: it.diagnosticCode,
            )
        }
    }

    fun setDriveLink(driveLink: String) {
        _state.update {
            it.copy(
                state          = TransferState.COMPLETE,
                driveLink      = driveLink,
                currentFile    = null,
                receivedFiles  = emptyList(),
            )
        }
    }

    fun addReceivedFile(file: ReceivedFile) {
        _state.update { current ->
            current.copy(
                receivedFiles = current.receivedFiles
                    .filter { it.id != file.id } + file
            )
        }
    }

    fun clearReceivedFiles() {
        _state.update { it.copy(receivedFiles = emptyList()) }
    }

    /** Full reset — generates a fresh room code, mirrors web transferStore.reset(). */
    fun reset() {
        _state.value = TransferUiState()
    }
}
