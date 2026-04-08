package in.clex.mobile.feature.receive

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import in.clex.mobile.core.model.ReceivedFile
import in.clex.mobile.core.model.RoomCode
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.core.model.TransferState
import in.clex.mobile.core.model.TransferUiState
import in.clex.mobile.core.transfer.TransferStateMachine
import in.clex.mobile.navigation.ReceiveDeepLinkArgs
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import javax.inject.Inject

/** UI step within the receive flow — maps to zero-scroll screens. */
enum class ReceiveStep {
    CODE_ENTRY,      // User types room code
    MODE_CHOICE,     // Direct vs Local selection
    WAITING,         // Connecting / waiting for sender
    CONNECTING,
    TRANSFERRING,
    RECEIVED,        // Files received, save options
}

@HiltViewModel
class ReceiveViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val stateMachine: TransferStateMachine,
) : ViewModel() {

    private val _step = MutableStateFlow(ReceiveStep.CODE_ENTRY)
    val step: StateFlow<ReceiveStep> = _step.asStateFlow()

    private val _code = MutableStateFlow("")
    val code: StateFlow<String> = _code.asStateFlow()

    private val _codeError = MutableStateFlow<String?>(null)
    val codeError: StateFlow<String?> = _codeError.asStateFlow()

    private val _selectedMethod = MutableStateFlow(TransferMethod.WEBRTC)
    val selectedMethod: StateFlow<TransferMethod> = _selectedMethod.asStateFlow()

    val transferState: StateFlow<TransferUiState> = stateMachine.state
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TransferUiState())

    /** Called when the app launches with a deep link. */
    fun applyDeepLink(args: ReceiveDeepLinkArgs) {
        _code.value = args.code.value
        _selectedMethod.value = args.method
        // Auto-advance to mode confirmation then connect
        _step.value = ReceiveStep.MODE_CHOICE
    }

    fun onCodeInput(raw: String) {
        // Uppercase + limit to 6 chars
        _code.value = raw.uppercase().filter { it.isLetterOrDigit() }.take(6)
        _codeError.value = null
    }

    fun submitCode() {
        val roomCode = RoomCode.fromString(_code.value)
        if (!roomCode.isValid()) {
            _codeError.value = "Enter a valid 6-character code"
            return
        }
        _step.value = ReceiveStep.MODE_CHOICE
    }

    fun selectMethod(method: TransferMethod) {
        _selectedMethod.value = method
    }

    fun connect() {
        val roomCode = RoomCode.fromString(_code.value)
        if (!roomCode.isValid()) {
            _step.value = ReceiveStep.CODE_ENTRY
            return
        }
        // Update state machine
        stateMachine.setMethod(_selectedMethod.value)
        stateMachine.setState(TransferState.WAITING_PEER)
        _step.value = ReceiveStep.WAITING

        // Monitor transfer state → drive step transitions
        viewModelScope.launch {
            stateMachine.state.collect { state ->
                when (state.state) {
                    TransferState.CONNECTING    -> _step.value = ReceiveStep.CONNECTING
                    TransferState.TRANSFERRING  -> _step.value = ReceiveStep.TRANSFERRING
                    TransferState.COMPLETE      -> _step.value = ReceiveStep.RECEIVED
                    TransferState.FAILED        -> { /* stay on current step — error shown */ }
                    else -> {}
                }
            }
        }
        // In real implementation: launch WebRtcTransfer.initReceiver() here
    }

    fun reset() {
        stateMachine.reset()
        _step.value = ReceiveStep.CODE_ENTRY
        _code.value = ""
        _codeError.value = null
    }

    /**
     * Save all received files as a single ZIP.
     * Naming: "{normalizedCode || 'clex-transfer'}.zip" — matches web ReceiveApp.svelte.
     */
    fun saveAllAsZip(files: List<ReceivedFile>): ByteArray {
        val archiveName = _code.value.normalized().ifBlank { "clex-transfer" }
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            files.forEach { file ->
                zip.putNextEntry(ZipEntry(file.name))
                zip.write(file.bytes)
                zip.closeEntry()
            }
        }
        return out.toByteArray()
    }

    private fun String.normalized() = trim().uppercase()
}
