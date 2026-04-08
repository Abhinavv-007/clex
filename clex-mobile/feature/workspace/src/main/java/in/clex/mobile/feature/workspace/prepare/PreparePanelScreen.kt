package in.clex.mobile.feature.workspace.prepare

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import in.clex.mobile.core.design.theme.ClexBodyFont
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.core.design.theme.ClexDisplayFont
import in.clex.mobile.core.model.ChainSuggestion
import in.clex.mobile.core.model.FileEntry
import in.clex.mobile.core.model.ToolId
import in.clex.mobile.feature.toolruntime.ToolChainSuggestions

/**
 * Prepare panel — shows the selected files and tool chain suggestions.
 * Mirrors web WorkspaceApp.svelte's "prepare" panel and ToolChain component.
 */
@Composable
fun PreparePanelScreen(
    files: List<FileEntry>,
    onToolSelected: (ToolId) -> Unit,
    onShareNext: () -> Unit,
) {
    val clexColors = ClexColors.current

    // Derive suggestions from the current file set
    val suggestions = remember(files) {
        if (files.isEmpty()) emptyList()
        else {
            // Group suggestions by primary MIME of first file
            val primaryMime = files.first().processed?.mimeType ?: files.first().mimeType
            val count = files.size
            ToolChainSuggestions.getSuggestions(primaryMime, count)
                .filter { it.toolId != "share" }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(clexColors.bgPrimary)
            .padding(horizontal = 20.dp),
    ) {
        // ── File list (compact) ───────────────────────────────────────────────
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
        ) {
            item {
                Text(
                    text = "${files.size} FILE${if (files.size != 1) "S" else ""}",
                    fontFamily = ClexDisplayFont,
                    fontSize = 10.sp,
                    color = clexColors.textTertiary,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }
            items(files, key = { it.id }) { file ->
                FileChip(file = file)
            }

            if (suggestions.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "SUGGESTED TOOLS",
                        fontFamily = ClexDisplayFont,
                        fontSize = 10.sp,
                        color = clexColors.textTertiary,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                items(suggestions, key = { it.toolId }) { suggestion ->
                    ToolSuggestionCard(
                        suggestion = suggestion,
                        onClick = {
                            val toolId = ToolId.fromWebId(suggestion.toolId)
                            if (toolId != null) onToolSelected(toolId)
                        },
                    )
                }
            }
        }

        // ── Send button ───────────────────────────────────────────────────────
        Button(
            onClick = onShareNext,
            enabled = files.isNotEmpty(),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .padding(bottom = 8.dp)
                .border(2.dp, if (files.isNotEmpty()) clexColors.accent else clexColors.borderColor),
            shape = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = clexColors.accent,
                contentColor   = clexColors.textInverse,
                disabledContainerColor = clexColors.bgTertiary,
            ),
        ) {
            Text("Send →", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun FileChip(file: FileEntry) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderSubtle)
            .background(clexColors.bgCard)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = mimeToEmoji(file.processed?.mimeType ?: file.mimeType),
            fontSize = 16.sp,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = file.processed?.name ?: file.name,
                color = clexColors.textPrimary,
                fontSize = 12.sp,
                maxLines = 1,
                fontFamily = ClexBodyFont,
            )
            if (file.processed != null) {
                Text(
                    text = "→ ${file.processed.operation}",
                    color = clexColors.accent,
                    fontSize = 10.sp,
                    fontFamily = ClexBodyFont,
                )
            }
        }
    }
}

@Composable
private fun ToolSuggestionCard(suggestion: ChainSuggestion, onClick: () -> Unit) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                suggestion.label,
                fontFamily = ClexDisplayFont,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = clexColors.textPrimary,
            )
            Text(
                suggestion.description,
                fontFamily = ClexBodyFont,
                fontSize = 11.sp,
                color = clexColors.textSecondary,
            )
        }
        Text("→", color = clexColors.accent, fontSize = 16.sp, fontFamily = ClexDisplayFont)
    }
}

private fun mimeToEmoji(mime: String) = when {
    mime.startsWith("image/")   -> "🖼"
    mime == "application/pdf"   -> "📄"
    mime.contains("zip")        -> "📦"
    mime.contains("word") || mime.contains("document") -> "📝"
    mime.startsWith("video/")   -> "🎬"
    mime.startsWith("audio/")   -> "🎵"
    else                        -> "📎"
}
