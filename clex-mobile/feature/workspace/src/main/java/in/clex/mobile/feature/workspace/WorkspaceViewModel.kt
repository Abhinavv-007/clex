package in.clex.mobile.feature.workspace

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import in.clex.mobile.core.model.FileEntry
import in.clex.mobile.core.model.ProcessedFile
import in.clex.mobile.core.model.ToolId
import in.clex.mobile.core.model.ToolResult
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.core.model.TransferState
import in.clex.mobile.core.model.TransferUiState
import in.clex.mobile.core.model.WorkspacePanel
import in.clex.mobile.core.transfer.TransferStateMachine
import in.clex.mobile.feature.toolruntime.ToolChainSuggestions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class WorkspaceViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val transferStateMachine: TransferStateMachine,
) : ViewModel() {

    // ── Files state — mirrors web filesStore ──────────────────────────────────
    private val _files = MutableStateFlow<List<FileEntry>>(emptyList())
    val files: StateFlow<List<FileEntry>> = _files.asStateFlow()

    // ── Active panel — mirrors web uiStore.activePanel ────────────────────────
    private val _activePanel = MutableStateFlow(WorkspacePanel.FILES)
    val activePanel: StateFlow<WorkspacePanel> = _activePanel.asStateFlow()

    // ── Last tool result ──────────────────────────────────────────────────────
    private val _lastToolResult = MutableStateFlow<ToolResult?>(null)
    val lastToolResult: StateFlow<ToolResult?> = _lastToolResult.asStateFlow()

    // ── Transfer state from machine ───────────────────────────────────────────
    val transferState: StateFlow<TransferUiState> = transferStateMachine.state
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TransferUiState())

    // ─────────────────────────────────────────────────────────────────────────

    fun setPanel(panel: WorkspacePanel) {
        _activePanel.value = panel
    }

    /**
     * Ingest files from the Android document picker (content URIs).
     * Mirrors web filesStore.addFiles().
     */
    fun addFiles(uris: List<Uri>) {
        viewModelScope.launch {
            val newEntries = uris.mapNotNull { uri ->
                try {
                    val contentResolver = context.contentResolver
                    val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
                    val name = extractFileName(context, uri) ?: uri.lastPathSegment ?: "file"
                    val size = contentResolver.openFileDescriptor(uri, "r")?.use { fd ->
                        fd.statSize
                    } ?: 0L

                    FileEntry(
                        id       = UUID.randomUUID().toString(),
                        uri      = uri,
                        name     = name,
                        size     = size,
                        mimeType = mimeType,
                    )
                } catch (e: Exception) {
                    null
                }
            }

            _files.update { current ->
                val existingNames = current.map { it.name }.toSet()
                current + newEntries.filter { it.name !in existingNames }
            }

            if (_files.value.isNotEmpty() && _activePanel.value == WorkspacePanel.FILES) {
                _activePanel.value = WorkspacePanel.PREPARE
            }
        }
    }

    fun removeFile(id: String) {
        _files.update { current -> current.filter { it.id != id } }
        if (_files.value.isEmpty()) {
            _activePanel.value = WorkspacePanel.FILES
        }
    }

    fun clearFiles() {
        _files.value = emptyList()
        _activePanel.value = WorkspacePanel.FILES
        _lastToolResult.value = null
    }

    fun setToolResult(result: ToolResult) {
        _lastToolResult.value = result
    }

    fun setTransferMethod(method: TransferMethod) {
        transferStateMachine.setMethod(method)
    }

    fun startTransfer() {
        transferStateMachine.setState(TransferState.PREPARING)
    }

    fun resetTransfer() {
        transferStateMachine.reset()
    }

    private fun extractFileName(context: Context, uri: Uri): String? {
        if (uri.scheme == "content") {
            val cursor = context.contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val colIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    if (colIndex >= 0) return it.getString(colIndex)
                }
            }
        }
        return uri.path?.substringAfterLast('/')
    }
}
