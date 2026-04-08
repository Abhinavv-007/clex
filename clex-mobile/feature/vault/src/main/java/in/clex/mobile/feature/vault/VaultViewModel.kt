package in.clex.mobile.feature.vault

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.text.DecimalFormat
import javax.inject.Inject

data class VaultEntry(
    val id: String,
    val name: String,
    val mimeType: String,
    val size: Long,
    val savedAt: Long,   // epoch ms
    val path: String,
)

data class VaultUiState(
    val entries: List<VaultEntry> = emptyList(),
    val isLoading: Boolean = false,
    val selectedEntry: VaultEntry? = null,
    val totalSize: Long = 0L,
)

@HiltViewModel
class VaultViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val vaultDir: File = File(context.filesDir, "vault").also { it.mkdirs() }

    private val _state = MutableStateFlow(VaultUiState())
    val state: StateFlow<VaultUiState> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            val entries = vaultDir.listFiles()?.mapNotNull { file ->
                val parts = file.name.split("__", limit = 2)
                if (parts.size == 2) {
                    val (mimeEncoded, name) = parts
                    VaultEntry(
                        id       = file.name,
                        name     = name,
                        mimeType = mimeEncoded.replace('_', '/'),
                        size     = file.length(),
                        savedAt  = file.lastModified(),
                        path     = file.absolutePath,
                    )
                } else null
            }?.sortedByDescending { it.savedAt } ?: emptyList()

            _state.update {
                it.copy(
                    entries     = entries,
                    isLoading   = false,
                    totalSize   = entries.sumOf { e -> e.size },
                )
            }
        }
    }

    /** Save a content URI into the vault directory. */
    fun saveFile(uri: Uri, name: String, mimeType: String) {
        viewModelScope.launch {
            val safeMime = mimeType.replace('/', '_')
            val target = File(vaultDir, "${safeMime}__$name")
            context.contentResolver.openInputStream(uri)?.use { input ->
                target.outputStream().use { output -> input.copyTo(output) }
            }
            load()
        }
    }

    /** Save raw bytes into the vault directory. */
    fun saveBytes(name: String, bytes: ByteArray, mimeType: String) {
        viewModelScope.launch {
            val safeMime = mimeType.replace('/', '_')
            val target = File(vaultDir, "${safeMime}__$name")
            target.writeBytes(bytes)
            load()
        }
    }

    fun deleteEntry(entry: VaultEntry) {
        viewModelScope.launch {
            File(entry.path).delete()
            load()
        }
    }

    fun selectEntry(entry: VaultEntry?) {
        _state.update { it.copy(selectedEntry = entry) }
    }
}
