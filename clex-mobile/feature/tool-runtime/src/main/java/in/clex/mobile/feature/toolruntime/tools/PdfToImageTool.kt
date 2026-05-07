package in.clex.mobile.feature.toolruntime.tools

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * PDF to image — mirrors web pdfToImage.ts.
 *
 * Preserved contractual behavior (DO NOT change in V1):
 *   - output format: JPEG (web: JPEG pages)
 *   - single page → single JPEG file
 *   - multiple pages → ZIP (caller is responsible for zipping when count > 1)
 *   - output filename: "{baseName}_page{n}.jpg"
 *
 * Uses Android PdfRenderer — system API, no additional library needed.
 */
object PdfToImageTool {

    data class PageImage(
        val bytes: ByteArray,
        val name: String,
        val pageIndex: Int,    // 0-based
    )

    /**
     * Render PDF pages to JPEG images.
     * [baseName] is the filename without extension.
     * [dpi] controls rendering resolution (default 150 — reasonable trade-off).
     */
    suspend fun renderToImages(
        pdfBytes: ByteArray,
        baseName: String,
        dpi: Int = 150,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<List<PageImage>> = withContext(Dispatchers.IO) {
        runCatching {
            // PdfRenderer requires a seekable FileDescriptor — write to temp file
            val tempFile = File.createTempFile("clex_pdf_", ".pdf")
            try {
                tempFile.writeBytes(pdfBytes)

                val fd = ParcelFileDescriptor.open(tempFile, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(fd)
                val total = renderer.pageCount
                val results = mutableListOf<PageImage>()

                try {
                    for (i in 0 until total) {
                        val page = renderer.openPage(i)
                        val scaleFactor = dpi / 72f   // PdfRenderer renders at 72 DPI natively
                        val width  = (page.width  * scaleFactor).toInt()
                        val height = (page.height * scaleFactor).toInt()

                        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                        // White background (PDF pages assume white)
                        bitmap.eraseColor(android.graphics.Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        page.close()

                        val out = ByteArrayOutputStream()
                        bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
                        bitmap.recycle()

                        results += PageImage(
                            bytes     = out.toByteArray(),
                            name      = "${baseName}_page${i + 1}.jpg",
                            pageIndex = i,
                        )
                        onProgress?.invoke(((i + 1).toDouble() / total * 100).toInt())
                    }
                } finally {
                    renderer.close()
                    fd.close()
                }

                results
            } finally {
                tempFile.delete()
            }
        }
    }
}
