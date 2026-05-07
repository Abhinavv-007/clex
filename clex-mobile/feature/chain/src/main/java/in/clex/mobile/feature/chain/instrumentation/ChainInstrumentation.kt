package in.clex.mobile.feature.chain.instrumentation

import in.clex.mobile.core.model.ChainFile
import in.clex.mobile.core.model.FileEntry
import in.clex.mobile.core.model.TransferState
import in.clex.mobile.core.model.TransferUiState
import in.clex.mobile.core.network.chain.ChainClient
import in.clex.mobile.core.network.chain.fileCategory
import in.clex.mobile.core.network.chain.hashBytes
import in.clex.mobile.core.storage.chain.ChainIdRepository
import in.clex.mobile.core.transfer.TransferStateMachine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Chain instrumentation — mirrors web chain/instrument.ts initChainInstrumentation().
 *
 * Preserved behavior (DO NOT change in V1):
 *   - Register on workspace or explorer mount (non-blocking, fire-and-forget)
 *   - Create session on WAITING_PEER state entry
 *   - Append events for: WAITING_PEER → waiting_peer, CONNECTING → connecting,
 *     TRANSFERRING → transferring, COMPLETE → completed, FAILED → failed, IDLE (after active) → cancelled
 *   - receiver_chain_id is NOT set (V1 gap — matches web)
 *   - Errors in all chain calls are swallowed — transfer continues
 */
class ChainInstrumentation(
    private val chainClient: ChainClient,
    private val chainIdRepo: ChainIdRepository,
    private val stateMachine: TransferStateMachine,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var sessionId: String? = null
    private var lastState: TransferState = TransferState.IDLE
    private var hasBeenActive = false

    /** Call on workspace/chain tab mount — mirrors initChainInstrumentation(). */
    fun init() {
        scope.launch {
            // Register chain ID (non-blocking)
            val chainId = chainIdRepo.getOrCreate()
            chainClient.register(chainId)  // fire-and-forget

            // Subscribe to state changes
            stateMachine.state.collect { uiState ->
                handleStateChange(uiState, chainId)
            }
        }
    }

    private suspend fun handleStateChange(uiState: TransferUiState, chainId: String) {
        val newState = uiState.state

        if (newState == lastState) return

        if (newState.isActive) hasBeenActive = true

        when (newState) {
            TransferState.WAITING_PEER -> {
                // Create session when first entering the waiting state
                if (sessionId == null) {
                    val files = emptyList<ChainFile>()  // files attached separately via setFiles()
                    val session = chainClient.createSession(
                        senderChainId = chainId,
                        route = uiState.method.webValue,
                        files = files,
                    )
                    sessionId = session?.sessionId
                }
                appendEvent("waiting_peer")
            }
            TransferState.CONNECTING    -> appendEvent("connecting")
            TransferState.TRANSFERRING  -> appendEvent("transferring")
            TransferState.COMPLETE      -> {
                appendEvent("completed")
                sessionId = null
                hasBeenActive = false
            }
            TransferState.FAILED        -> {
                appendEvent("failed")
                sessionId = null
                hasBeenActive = false
            }
            TransferState.IDLE          -> {
                if (hasBeenActive) {
                    appendEvent("cancelled")
                    hasBeenActive = false
                    sessionId = null
                }
            }
            else -> {}
        }

        lastState = newState
    }

    /** Attach files to an in-progress chain session. Call after ingest, before WAITING_PEER. */
    suspend fun setFiles(files: List<FileEntry>) {
        val chainId = chainIdRepo.getOrCreate()
        val chainFiles = files.map { entry ->
            ChainFile(
                category = fileCategory(entry.mimeType),
                type     = entry.mimeType,
                size     = entry.size,
                hash     = null,  // V1: no upfront hash (matches web V1 gap)
            )
        }
        val session = chainClient.createSession(
            senderChainId = chainId,
            route = stateMachine.state.value.method.webValue,
            files = chainFiles,
        )
        sessionId = session?.sessionId
    }

    private suspend fun appendEvent(status: String) {
        val sid = sessionId ?: return
        // receiver_chain_id NOT set in V1 — matches web gap
        chainClient.appendEvent(sid, status, receiverChainId = null)
    }
}
