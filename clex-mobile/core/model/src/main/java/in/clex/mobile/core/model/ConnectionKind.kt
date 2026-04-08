package in.clex.mobile.core.model

/**
 * Connection classification after WebRTC peer connects.
 * Mirrors TypeScript:
 * ```ts
 * export type ConnectionKind = 'lan' | 'internet' | 'unknown'
 * ```
 * Determined by inspecting the selected ICE candidate pair after connection:
 * - if any selected candidate type is 'srflx' → INTERNET
 * - if host-only / prflx → LAN
 * - otherwise → UNKNOWN
 */
enum class ConnectionKind(val webValue: String) {
    LAN("lan"),
    INTERNET("internet"),
    UNKNOWN("unknown");
}
