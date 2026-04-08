package in.clex.mobile.feature.chain

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import in.clex.mobile.core.model.ChainExplorerPage
import in.clex.mobile.core.model.ChainSessionDetail
import in.clex.mobile.core.model.ChainStats
import in.clex.mobile.core.network.chain.ChainClient
import in.clex.mobile.core.storage.chain.ChainIdRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChainUiState(
    val chainId: String? = null,
    val stats: ChainStats? = null,
    val explorerPage: ChainExplorerPage? = null,
    val selectedSession: ChainSessionDetail? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

enum class ChainTab { ID, STATS, SESSIONS }

@HiltViewModel
class ChainViewModel @Inject constructor(
    private val chainIdRepo: ChainIdRepository,
    private val chainClient: ChainClient,
) : ViewModel() {

    private val _state = MutableStateFlow(ChainUiState())
    val state: StateFlow<ChainUiState> = _state.asStateFlow()

    private val _activeTab = MutableStateFlow(ChainTab.ID)
    val activeTab: StateFlow<ChainTab> = _activeTab.asStateFlow()

    init {
        viewModelScope.launch { loadChainId() }
    }

    /** Called on Chain tab mount — mirrors web initChainInstrumentation() register step. */
    fun onMount() {
        viewModelScope.launch {
            val chainId = chainIdRepo.getOrCreate()
            _state.value = _state.value.copy(chainId = chainId)
            // Register (fire-and-forget)
            chainClient.register(chainId)
        }
    }

    fun setTab(tab: ChainTab) {
        _activeTab.value = tab
        when (tab) {
            ChainTab.STATS    -> loadStats()
            ChainTab.SESSIONS -> loadSessions()
            else              -> {}
        }
    }

    fun loadStats() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val stats = chainClient.getStats()
            _state.value = _state.value.copy(stats = stats, isLoading = false)
        }
    }

    fun loadSessions(page: Int = 1) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            val page = chainClient.getExplorer(page)
            _state.value = _state.value.copy(explorerPage = page, isLoading = false)
        }
    }

    fun loadSession(id: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, selectedSession = null, error = null)
            val detail = chainClient.getSession(id)
            _state.value = _state.value.copy(selectedSession = detail, isLoading = false)
        }
    }

    fun clearSelectedSession() {
        _state.value = _state.value.copy(selectedSession = null)
    }

    private suspend fun loadChainId() {
        val id = chainIdRepo.getOrCreate()
        _state.value = _state.value.copy(chainId = id)
    }
}
