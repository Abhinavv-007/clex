package in.clex.mobile.feature.toolruntime.tools

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * ZIP packaging — mirrors web zip.ts.
 *
 * Output: a single ZIP archive containing all input files.
 * Naming is caller-determined (matching web behavior):
 *   - PDF split output: "{code}.zip" or caller-specified name
 *   - PDF to image multi-page: "{baseName}_pages.zip"
 *   - Save-all received: "{normalizedCode || 'clex-transfer'}.zip"
 *
 * Uses java.util.zip — no extra library needed.
 */
object ZipTool {

    data class ZipInput(val name: String, val bytes: ByteArray)

    /**
     * Package files into a ZIP archive.
     * [archiveName] is the output filename (must end in .zip — caller ensures this).
     */
    suspend fun zip(
        files: List<ZipInput>,
        onProgress: ((Int) -> Unit)? = null,
    ): Result<ByteArray> = withContext(Dispatchers.IO) {
        runCatching {
            val out = ByteArrayOutputStream()
            val zip = ZipOutputStream(out)

            files.forEachIndexed { index, file ->
                val entry = ZipEntry(file.name)
                zip.putNextEntry(entry)
                zip.write(file.bytes)
                zip.closeEntry()
                onProgress?.invoke(((index + 1).toDouble() / files.size * 100).toInt())
            }

            zip.close()
            out.toByteArray()
        }
    }
}
