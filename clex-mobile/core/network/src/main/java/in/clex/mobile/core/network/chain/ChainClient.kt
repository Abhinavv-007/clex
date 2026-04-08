package in.clex.mobile.core.network.chain

import in.clex.mobile.core.model.ChainEventRequest
import in.clex.mobile.core.model.ChainExplorerPage
import in.clex.mobile.core.model.ChainFile
import in.clex.mobile.core.model.ChainRegisterRequest
import in.clex.mobile.core.model.ChainSessionDetail
import in.clex.mobile.core.model.ChainSessionRequest
import in.clex.mobile.core.model.ChainSessionResponse
import in.clex.mobile.core.model.ChainStats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest

/**
 * Chain API client — mirrors web chain/client.ts behavior.
 *
 * All calls are fire-and-forget by design — errors are swallowed so that
 * transfer flows are never blocked by chain instrumentation failure.
 * This matches the web: "Never blocks or throws — if the chain API is down,
 * transfers continue normally."
 */
class ChainClient(private val baseUrl: String) {

    private val http = okhttp3.OkHttpClient()
    private val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true }

    // ── POST /chain/register ──────────────────────────────────────────────────
    suspend fun register(chainId: String): Boolean = fireAndForget {
        post("/chain/register", ChainRegisterRequest(chainId))
    }

    // ── POST /chain/session ───────────────────────────────────────────────────
    suspend fun createSession(
        senderChainId: String,
        route: String,
        files: List<ChainFile>,
    ): ChainSessionResponse? = runCatching {
        withContext(Dispatchers.IO) {
            val body = json.encodeToString(
                ChainSessionRequest.serializer(),
                ChainSessionRequest(senderChainId, route, files)
            )
            val response = postRaw("/chain/session", body)
            json.decodeFromString(ChainSessionResponse.serializer(), response)
        }
    }.getOrNull()

    // ── POST /chain/session/:id/event ─────────────────────────────────────────
    suspend fun appendEvent(sessionId: String, status: String, receiverChainId: String? = null) {
        fireAndForget {
            post("/chain/session/$sessionId/event", ChainEventRequest(status, receiverChainId))
        }
    }

    // ── GET /chain/stats ──────────────────────────────────────────────────────
    suspend fun getStats(): ChainStats? = runCatching {
        withContext(Dispatchers.IO) {
            val response = getRaw("/chain/stats")
            json.decodeFromString(ChainStats.serializer(), response)
        }
    }.getOrNull()

    // ── GET /chain/explorer ───────────────────────────────────────────────────
    suspend fun getExplorer(page: Int = 1, limit: Int = 20): ChainExplorerPage? = runCatching {
        withContext(Dispatchers.IO) {
            val response = getRaw("/chain/explorer?page=$page&limit=$limit")
            json.decodeFromString(ChainExplorerPage.serializer(), response)
        }
    }.getOrNull()

    // ── GET /chain/session/:id ────────────────────────────────────────────────
    suspend fun getSession(id: String): ChainSessionDetail? = runCatching {
        withContext(Dispatchers.IO) {
            val response = getRaw("/chain/session/$id")
            json.decodeFromString(ChainSessionDetail.serializer(), response)
        }
    }.getOrNull()

    // ─────────────────────────────────────────────────────────────────────────

    private fun url(path: String) = "${baseUrl.trimEnd('/')}$path"

    private suspend fun <T : kotlinx.serialization.Serializable> post(path: String, body: T): Boolean {
        val encoded = json.encodeToString(kotlinx.serialization.serializer(), body)
        return runCatching { postRaw(path, encoded) }.isSuccess
    }

    private suspend fun postRaw(path: String, body: String): String =
        withContext(Dispatchers.IO) {
            val request = okhttp3.Request.Builder()
                .url(url(path))
                .post(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body))
                .build()
            http.newCall(request).execute().use { it.body()?.string() ?: "" }
        }

    private suspend fun getRaw(path: String): String =
        withContext(Dispatchers.IO) {
            val request = okhttp3.Request.Builder().url(url(path)).get().build()
            http.newCall(request).execute().use { it.body()?.string() ?: "" }
        }

    /** Run block silently — errors are swallowed, transfer never blocked. */
    private suspend fun fireAndForget(block: suspend () -> Any?): Boolean =
        runCatching { block() }.isSuccess
}

// ─── File hashing helper — mirrors web hashBlob() ────────────────────────────

/**
 * SHA-256 hash of a byte array, returned as 64 hex chars.
 * Mirrors web:
 * ```ts
 * export async function hashBlob(blob: Blob): Promise<string> {
 *   const buf = await blob.arrayBuffer()
 *   const hash = await crypto.subtle.digest('SHA-256', buf)
 *   return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('')
 * }
 * ```
 */
suspend fun hashBytes(bytes: ByteArray): String = withContext(Dispatchers.Default) {
    val digest = MessageDigest.getInstance("SHA-256")
    digest.update(bytes)
    digest.digest().joinToString("") { "%02x".format(it) }
}

/**
 * File category classification — mirrors web fileCategory() in chain/client.ts.
 * Returns one of: "image" | "pdf" | "document" | "archive" | "video" | "audio" | "other"
 */
fun fileCategory(mimeType: String): String = when {
    mimeType.startsWith("image/")   -> "image"
    mimeType == "application/pdf"   -> "pdf"
    mimeType.contains("word") || mimeType.contains("document") || mimeType.contains("text/") -> "document"
    mimeType.contains("zip") || mimeType.contains("archive") || mimeType.contains("tar") -> "archive"
    mimeType.startsWith("video/")   -> "video"
    mimeType.startsWith("audio/")   -> "audio"
    else                            -> "other"
}
