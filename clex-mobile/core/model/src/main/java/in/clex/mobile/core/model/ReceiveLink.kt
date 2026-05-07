package in.clex.mobile.core.model

import android.net.Uri

/**
 * Receive link generation and parsing.
 *
 * Web default (primary runtime): query-style
 *   https://clex.in/receive?code=ABC123&mode=webrtc
 *
 * Also accepted (segment-style, from archived SvelteKit reference):
 *   https://clex.in/receive/ABC123?mode=webrtc
 *
 * V1 always generates query-style links by default.
 */
object ReceiveLink {

    private const val BASE = "https://clex.in"

    /**
     * Generate a receive link.
     * Output format: https://clex.in/receive?code=ABC123&mode=webrtc|local
     */
    fun generate(code: RoomCode, method: TransferMethod): Uri {
        require(code.isValid()) { "Cannot generate link for invalid room code: ${code.value}" }
        return Uri.parse(BASE)
            .buildUpon()
            .appendPath("receive")
            .appendQueryParameter("code", code.normalized())
            .appendQueryParameter("mode", method.webValue)
            .build()
    }

    /**
     * Parse a receive deep-link URI.
     * Accepts both query-style and segment-style.
     * Returns null if the URI does not encode a valid room code.
     */
    fun parse(uri: Uri): Pair<RoomCode, TransferMethod>? {
        if (uri.host != "clex.in") return null

        val code: String? = when {
            // Query style: /receive?code=ABC123
            uri.getQueryParameter("code")?.isNotBlank() == true ->
                uri.getQueryParameter("code")!!.trim().uppercase()

            // Segment style: /receive/ABC123
            uri.pathSegments.size >= 2 && uri.pathSegments[0] == "receive" ->
                uri.pathSegments[1].trim().uppercase()

            else -> null
        }

        val roomCode = code?.let { RoomCode(it) }?.takeIf { it.isValid() } ?: return null
        val method = when (uri.getQueryParameter("mode")) {
            "local" -> TransferMethod.LOCAL
            else    -> TransferMethod.WEBRTC
        }

        return roomCode to method
    }
}
