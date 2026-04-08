package in.clex.mobile.core.model

import android.net.Uri

/**
 * Mirrors web FileEntry / ProcessedFile from stores/files.ts.
 *
 * [uri] replaces the browser `File` object — it is a content:// URI from the SAF picker.
 * [processed] is set after a tool run, exactly as web `FileEntry.processed`.
 */
data class FileEntry(
    val id: String,           // UUID — same role as web crypto.randomUUID()
    val uri: Uri,             // Android content URI
    val name: String,
    val size: Long,
    val mimeType: String,     // 'application/octet-stream' default if unknown
    val processed: ProcessedFile? = null,
)

/**
 * Mirrors web ProcessedFile.
 * [blob] holds the output bytes (replaces browser Blob).
 * [operation] mirrors web ProcessedFile.operation — e.g. "image-compress".
 */
data class ProcessedFile(
    val blob: ByteArray,
    val name: String,
    val mimeType: String,
    val operation: String,   // ToolId.webId value
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ProcessedFile) return false
        return mimeType == other.mimeType &&
            name == other.name &&
            operation == other.operation &&
            blob.contentEquals(other.blob)
    }
    override fun hashCode(): Int {
        var result = blob.contentHashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + mimeType.hashCode()
        result = 31 * result + operation.hashCode()
        return result
    }
}
