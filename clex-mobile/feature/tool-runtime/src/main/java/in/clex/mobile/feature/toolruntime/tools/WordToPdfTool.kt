package in.clex.mobile.feature.toolruntime.tools

import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.poi.xwpf.usermodel.XWPFDocument
import java.io.ByteArrayOutputStream
import java.io.ByteArrayInputStream

/**
 * Word to PDF conversion — mirrors web wordToPdf.ts.
 *
 * Web implementation: mammoth (HTML extraction) → html2canvas → jsPDF.
 * Android implementation: Apache POI OOXML (text extraction) → PdfBox-Android.
 *
 * IMPORTANT: This is a best-effort text-layout conversion for V1.
 * Complex Word formatting (tables, images, columns) will degrade gracefully.
 * Output: single PDF blob. Naming: caller replaces .docx/.doc extension with .pdf.
 *
 * Golden fixture tests will validate structural equivalence (page count range,
 * text content presence) — not pixel-perfect layout match.
 */
object WordToPdfTool {

    suspend fun convert(
        docxBytes: ByteArray,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<ByteArray> = withContext(Dispatchers.IO) {
        runCatching {
            onProgress?.invoke(10)

            val document = XWPFDocument(ByteArrayInputStream(docxBytes))
            onProgress?.invoke(40)

            // Extract text paragraphs
            val paragraphs = document.paragraphs.map { it.text }
            document.close()

            onProgress?.invoke(60)

            // Render to PDF using PdfBox
            val pdf = PDDocument()
            try {
                val pageSize = PDRectangle.A4
                val margin = 50f
                val lineHeight = 14f
                val font = PDType1Font.HELVETICA
                val fontSize = 11f
                val usableWidth = pageSize.width - 2 * margin
                val usableHeight = pageSize.height - 2 * margin

                var currentPage: PDPage? = null
                var cs: PDPageContentStream? = null
                var yPosition = pageSize.height - margin

                fun newPage() {
                    cs?.endText()
                    cs?.close()
                    currentPage = PDPage(pageSize)
                    pdf.addPage(currentPage)
                    cs = PDPageContentStream(pdf, currentPage!!)
                    cs?.beginText()
                    cs?.setFont(font, fontSize)
                    cs?.newLineAtOffset(margin, pageSize.height - margin - lineHeight)
                    yPosition = pageSize.height - margin - lineHeight
                }

                newPage()

                for (para in paragraphs) {
                    val lines = wrapText(para.ifBlank { " " }, font, fontSize, usableWidth)
                    for (line in lines) {
                        if (yPosition < margin + lineHeight) {
                            newPage()
                        }
                        cs?.showText(line.take(200)) // Truncate very long lines for safety
                        cs?.newLineAtOffset(0f, -lineHeight)
                        yPosition -= lineHeight
                    }
                }

                cs?.endText()
                cs?.close()

                onProgress?.invoke(90)
                val out = ByteArrayOutputStream()
                pdf.save(out)
                onProgress?.invoke(100)
                out.toByteArray()
            } finally {
                pdf.close()
            }
        }
    }

    private fun wrapText(text: String, font: PDType1Font, fontSize: Float, maxWidth: Float): List<String> {
        if (text.isBlank()) return listOf("")
        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var currentLine = StringBuilder()

        for (word in words) {
            val testLine = if (currentLine.isEmpty()) word else "${currentLine} $word"
            val lineWidth = try {
                font.getStringWidth(testLine) / 1000 * fontSize
            } catch (e: Exception) {
                testLine.length * fontSize * 0.5f  // fallback estimate
            }

            if (lineWidth > maxWidth && currentLine.isNotEmpty()) {
                lines += currentLine.toString()
                currentLine = StringBuilder(word)
            } else {
                currentLine = StringBuilder(testLine)
            }
        }
        if (currentLine.isNotEmpty()) lines += currentLine.toString()
        return lines.ifEmpty { listOf("") }
    }
}
