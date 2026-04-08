package in.clex.mobile.feature.toolruntime

import in.clex.mobile.core.model.ChainSuggestion

/**
 * Port of web tools/chain.ts getSuggestions(outputMime, outputCount).
 *
 * The logic, suggestion order, toolId values, labels, and descriptions are
 * exact copies of the web function. Do NOT change them without a matching
 * web-side change — they form part of the behavioral parity contract.
 *
 * Suggestion toolId values:
 *   "image-compress" | "image-convert" | "pdf-merge" | "pdf-split" |
 *   "pdf-to-image" | "word-to-pdf" | "zip" | "share"
 */
object ToolChainSuggestions {

    /**
     * Returns the next logical actions after a tool run, based on output MIME and file count.
     * Mirrors web getSuggestions(outputMime: string, outputCount: number): ChainSuggestion[]
     */
    fun getSuggestions(outputMime: String, outputCount: Int): List<ChainSuggestion> {
        val suggestions = mutableListOf<ChainSuggestion>()

        when {
            outputMime == "application/pdf" -> {
                if (outputCount == 1) {
                    suggestions += ChainSuggestion("pdf-split",   "Split PDF",        "Separate into individual pages")
                    suggestions += ChainSuggestion("pdf-to-image","Export as images",  "Convert pages to JPG or PNG")
                }
                if (outputCount > 1) {
                    suggestions += ChainSuggestion("pdf-merge",   "Merge PDFs",       "Combine into one document")
                }
                suggestions += ChainSuggestion("zip",   "Package as ZIP",  "Bundle for easy sharing")
                suggestions += ChainSuggestion("share", "Share now",       "Send directly or upload to Drive")
            }

            outputMime.startsWith("image/") -> {
                suggestions += ChainSuggestion("image-compress", "Compress image",   "Reduce file size")
                suggestions += ChainSuggestion("image-convert",  "Convert format",   "Change to PNG, WebP, AVIF…")
                if (outputCount > 1) {
                    suggestions += ChainSuggestion("zip", "Zip all images", "Bundle into a single archive")
                }
                suggestions += ChainSuggestion("share", "Share now", "Send directly or upload to Drive")
            }

            outputMime == "application/zip" || outputMime == "application/x-zip-compressed" -> {
                suggestions += ChainSuggestion("share", "Share now", "Send directly or upload to Drive")
            }

            outputMime == "application/msword" ||
            outputMime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> {
                suggestions += ChainSuggestion("word-to-pdf", "Convert to PDF", "Universal format for sharing")
                suggestions += ChainSuggestion("share",       "Share now",      "Send directly or upload to Drive")
            }

            else -> {
                suggestions += ChainSuggestion("zip",   "Package as ZIP", "Bundle for easy sharing")
                suggestions += ChainSuggestion("share", "Share now",      "Send directly or upload to Drive")
            }
        }

        return suggestions
    }
}
