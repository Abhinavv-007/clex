package in.clex.mobile.core.model

/**
 * Transfer method / route — mirrors TypeScript:
 * ```ts
 * export type TransferMethod = 'webrtc' | 'local' | 'drive'
 * ```
 * String values used in chain session creation (route field) and receive link query params.
 */
enum class TransferMethod(val webValue: String) {
    WEBRTC("webrtc"),
    LOCAL("local"),
    DRIVE("drive");

    companion object {
        fun fromWebValue(v: String): TransferMethod =
            entries.firstOrNull { it.webValue == v } ?: WEBRTC
    }
}
