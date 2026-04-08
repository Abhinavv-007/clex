package in.clex.mobile.core.model

/**
 * Mirrors TypeScript:
 * ```ts
 * export type ToolId =
 *   | 'image-compress' | 'image-convert' | 'pdf-merge'
 *   | 'pdf-split' | 'pdf-to-image' | 'word-to-pdf' | 'zip'
 * ```
 * String values MUST match the web exactly — they are used in chain API payloads.
 */
enum class ToolId(val webId: String) {
    IMAGE_COMPRESS("image-compress"),
    IMAGE_CONVERT("image-convert"),
    PDF_MERGE("pdf-merge"),
    PDF_SPLIT("pdf-split"),
    PDF_TO_IMAGE("pdf-to-image"),
    WORD_TO_PDF("word-to-pdf"),
    ZIP("zip");

    companion object {
        fun fromWebId(id: String): ToolId? = entries.firstOrNull { it.webId == id }
    }
}
