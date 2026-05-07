package in.clex.mobile.feature.toolruntime.tools

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * Image format conversion — mirrors web imageConvert.ts.
 *
 * Preserved defaults (DO NOT change in V1):
 *   default target format = WebP  (web: createImageBitmap + OffscreenCanvas default)
 *
 * Supported targets: JPEG, PNG, WebP (matches web image-convert tool accepts list).
 */
object ImageConvertTool {

    enum class TargetFormat(val mimeType: String, val extension: String) {
        JPEG("image/jpeg", "jpg"),
        PNG("image/png", "png"),
        WEBP("image/webp", "webp"),
    }

    /**
     * Convert image bytes to [target] format.
     * Default target: WebP — matches web tool default.
     */
    suspend fun convert(
        inputBytes: ByteArray,
        target: TargetFormat = TargetFormat.WEBP,
        quality: Int = 85,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<ConvertResult> = withContext(Dispatchers.Default) {
        runCatching {
            onProgress?.invoke(10)
            val bitmap = BitmapFactory.decodeByteArray(inputBytes, 0, inputBytes.size)
                ?: error("Could not decode image")

            onProgress?.invoke(50)
            val compressFormat = when (target) {
                TargetFormat.JPEG -> Bitmap.CompressFormat.JPEG
                TargetFormat.PNG  -> Bitmap.CompressFormat.PNG
                TargetFormat.WEBP -> if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R)
                    Bitmap.CompressFormat.WEBP_LOSSLESS
                else
                    @Suppress("DEPRECATION") Bitmap.CompressFormat.WEBP
            }

            val out = ByteArrayOutputStream()
            bitmap.compress(compressFormat, quality, out)
            bitmap.recycle()

            onProgress?.invoke(100)
            ConvertResult(
                bytes     = out.toByteArray(),
                mimeType  = target.mimeType,
                extension = target.extension,
            )
        }
    }

    data class ConvertResult(val bytes: ByteArray, val mimeType: String, val extension: String)
}
