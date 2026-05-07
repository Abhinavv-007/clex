package in.clex.mobile.feature.toolruntime.tools

import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * PDF merge — mirrors web pdfMerge.ts.
 *
 * Combines multiple PDF byte arrays into a single PDF.
 * Output: single merged PDF blob.
 */
object PdfMergeTool {

    suspend fun merge(
        pdfs: List<ByteArray>,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<ByteArray> = withContext(Dispatchers.IO) {
        runCatching {
            require(pdfs.isNotEmpty()) { "At least one PDF required" }

            val destination = PDDocument()
            try {
                pdfs.forEachIndexed { index, pdfBytes ->
                    val src = PDDocument.load(pdfBytes)
                    try {
                        src.pages.forEach { page ->
                            destination.importPage(page)
                        }
                    } finally {
                        src.close()
                    }
                    onProgress?.invoke(((index + 1).toDouble() / pdfs.size * 90).toInt())
                }

                val out = ByteArrayOutputStream()
                destination.save(out)
                onProgress?.invoke(100)
                out.toByteArray()
            } finally {
                destination.close()
            }
        }
    }
}
