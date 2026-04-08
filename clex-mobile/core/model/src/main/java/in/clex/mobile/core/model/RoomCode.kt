package in.clex.mobile.core.model

/**
 * A validated 6-character uppercase alphanumeric room code.
 *
 * Generation matches web crypto.randomUUID() slice approach — 6 secure random
 * characters from [A-Z0-9].
 *
 * Mirrors web:
 * ```ts
 * export function isValidRoomCode(code: string): boolean {
 *   return /^[A-Z0-9]{6}$/i.test(code)
 * }
 * ```
 */
@JvmInline
value class RoomCode(val value: String) {

    /** A room code is valid when it is exactly 6 uppercase alphanumeric chars. */
    fun isValid(): Boolean = value.length == 6 && value.all { it.isLetterOrDigit() }

    fun normalized(): String = value.trim().uppercase()

    companion object {
        private val CHARSET = ('A'..'Z') + ('0'..'9')

        /** Generate a fresh room code using secure randomness. */
        fun generate(): RoomCode {
            val bytes = ByteArray(6)
            java.security.SecureRandom().nextBytes(bytes)
            val code = bytes.map { b -> CHARSET[(b.toInt() and 0xFF) % CHARSET.size] }
                .joinToString("")
            return RoomCode(code)
        }

        fun fromString(raw: String): RoomCode =
            RoomCode(raw.trim().uppercase())
    }
}
