package in.clex.mobile.feature.toolruntime.tools

import com.tom_roush.pdfbox.pdmodel.PDDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * PDF split by page — mirrors web pdfSplit.ts splitPdfByPage().
 *
 * Preserved contractual behavior (DO NOT change in V1):
 *   - one PDF per page
 *   - output filename: "{baseName}_page{n}.pdf"
 *     (matches web: `${baseName}_page${i + 1}.pdf`)
 *
 * Returns a list of SplitResult which the caller then ZIPs —
 * matching web behavior where split results are packaged into a ZIP.
 */
object PdfSplitTool {

    data class SplitResult(
        val bytes: ByteArray,
        val name: String,
        val pageRange: Pair<Int, Int>,
    )

    /**
     * Split a PDF into one file per page.
     * [baseName] should be the filename without .pdf extension.
     * Output name format: "{baseName}_page{n}.pdf"
     */
    suspend fun splitByPage(
        pdfBytes: ByteArray,
        baseName: String,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<List<SplitResult>> = withContext(Dispatchers.IO) {
        runCatching {
            val src = PDDocument.load(pdfBytes)
            val total = src.numberOfPages
            val results = mutableListOf<SplitResult>()

            try {
                for (i in 0 until total) {
                    val doc = PDDocument()
                    try {
                        doc.importPage(src.pages[i])
                        val out = ByteArrayOutputStream()
                        doc.save(out)
                        results += SplitResult(
                            bytes     = out.toByteArray(),
                            name      = "${baseName}_page${i + 1}.pdf",
                            pageRange = Pair(i + 1, i + 1),
                        )
                    } finally {
                        doc.close()
                    }
                    onProgress?.invoke(((i + 1).toDouble() / total * 100).toInt())
                }
            } finally {
                src.close()
            }

            results
        }
    }
}
