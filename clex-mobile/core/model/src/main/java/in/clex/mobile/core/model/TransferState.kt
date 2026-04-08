package in.clex.mobile.core.model

/**
 * Transfer state machine — mirrors TypeScript transferStore.state.
 *
 * ```ts
 * export type TransferState =
 *   | 'idle' | 'preparing' | 'waiting_peer' | 'connecting'
 *   | 'transferring' | 'complete' | 'failed'
 * ```
 *
 * String values MUST match the web exactly — they are used in chain event API payloads.
 */
enum class TransferState(val webValue: String) {
    IDLE("idle"),
    PREPARING("preparing"),
    WAITING_PEER("waiting_peer"),
    CONNECTING("connecting"),
    TRANSFERRING("transferring"),
    COMPLETE("complete"),
    FAILED("failed");

    val isTerminal: Boolean get() = this == COMPLETE || this == FAILED
    val isActive: Boolean get() = this == WAITING_PEER || this == CONNECTING || this == TRANSFERRING
}
