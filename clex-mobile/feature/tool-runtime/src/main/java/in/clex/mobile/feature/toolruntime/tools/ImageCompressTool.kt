package in.clex.mobile.feature.toolruntime.tools

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * Image compression — mirrors web imageCompress.ts.
 *
 * Preserved defaults (DO NOT change in V1):
 *   maxSizeMB = 1    (web: options.maxSizeMB ?? 1)
 *   quality   = 0.8  (web: options.quality   ?? 0.8  →  80 in Android 0–100 scale)
 *   output format = JPEG  (mirrors browser-image-compression default output)
 */
object ImageCompressTool {

    /**
     * Compress an image to ≤ [maxSizeMB] MB at [quality] quality (0.0–1.0).
     * Output is always JPEG bytes, matching the web tool's default behavior.
     */
    suspend fun compress(
        inputBytes: ByteArray,
        maxSizeMB: Double = 1.0,
        quality: Double = 0.8,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<CompressResult> = withContext(Dispatchers.Default) {
        runCatching {
            onProgress?.invoke(10)
            val bitmap = BitmapFactory.decodeByteArray(inputBytes, 0, inputBytes.size)
                ?: error("Could not decode image")

            onProgress?.invoke(40)
            val maxBytes = (maxSizeMB * 1024 * 1024).toLong()
            val androidQuality = (quality * 100).toInt().coerceIn(1, 100)

            // Iteratively reduce quality until under target size
            var currentQuality = androidQuality
            var outputBytes: ByteArray
            do {
                val out = ByteArrayOutputStream()
                bitmap.compress(Bitmap.CompressFormat.JPEG, currentQuality, out)
                outputBytes = out.toByteArray()
                currentQuality = (currentQuality * 0.85).toInt().coerceAtLeast(10)
            } while (outputBytes.size > maxBytes && currentQuality > 10)

            bitmap.recycle()
            onProgress?.invoke(100)

            CompressResult(
                bytes    = outputBytes,
                mimeType = "image/jpeg",
            )
        }
    }

    data class CompressResult(val bytes: ByteArray, val mimeType: String)
}
