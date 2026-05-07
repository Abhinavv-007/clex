package in.clex.mobile.feature.vault

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
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import in.clex.mobile.core.design.theme.ClexBodyFont
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.core.design.theme.ClexDisplayFont
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun VaultScreen(
    navController: NavController,
    vm: VaultViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsState()
    val clexColors = ClexColors.current

    if (state.selectedEntry != null) {
        VaultDetailSheet(
            entry   = state.selectedEntry!!,
            onDelete = { vm.deleteEntry(it); vm.selectEntry(null) },
            onBack   = { vm.selectEntry(null) },
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(clexColors.bgPrimary),
    ) {
        // ── Header ────────────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(clexColors.bgSecondary)
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("VAULT", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = clexColors.accent)
            if (state.totalSize > 0) {
                Text(
                    "Total: ${formatBytes(state.totalSize)}",
                    fontFamily = ClexBodyFont,
                    fontSize = 11.sp,
                    color = clexColors.textTertiary,
                )
            }
        }

        // ── Content ───────────────────────────────────────────────────────────
        if (state.isLoading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = clexColors.accent, strokeWidth = 2.dp)
            }
        } else if (state.entries.isEmpty()) {
            Box(
                Modifier.fillMaxSize().padding(28.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("📦", fontSize = 40.sp)
                    Text(
                        "Your vault is empty",
                        fontFamily = ClexDisplayFont,
                        fontSize = 18.sp,
                        color = clexColors.textPrimary,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Files saved from transfers appear here,\nstored securely on this device.",
                        fontFamily = ClexBodyFont,
                        fontSize = 13.sp,
                        color = clexColors.textSecondary,
                        textAlign = TextAlign.Center,
                        lineHeight = 20.sp,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                item {
                    Text(
                        "${state.entries.size} file${if (state.entries.size != 1) "s" else ""}",
                        fontFamily = ClexDisplayFont,
                        fontSize = 10.sp,
                        color = clexColors.textTertiary,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                }
                items(state.entries, key = { it.id }) { entry ->
                    VaultEntryRow(
                        entry   = entry,
                        onClick = { vm.selectEntry(entry) },
                    )
                }
            }
        }
    }
}

// ── Entry row ─────────────────────────────────────────────────────────────────

@Composable
private fun VaultEntryRow(entry: VaultEntry, onClick: () -> Unit) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(mimeToEmoji(entry.mimeType), fontSize = 20.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(entry.name, fontFamily = ClexBodyFont, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = clexColors.textPrimary, maxLines = 1)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(formatBytes(entry.size), fontFamily = ClexBodyFont, fontSize = 10.sp, color = clexColors.textTertiary)
                Text("·", color = clexColors.textTertiary, fontSize = 10.sp)
                Text(formatDate(entry.savedAt), fontFamily = ClexBodyFont, fontSize = 10.sp, color = clexColors.textTertiary)
            }
        }
        Text("›", color = clexColors.textSecondary, fontSize = 16.sp)
    }
}

// ── Entry detail ──────────────────────────────────────────────────────────────

@Composable
private fun VaultDetailSheet(
    entry: VaultEntry,
    onDelete: (VaultEntry) -> Unit,
    onBack: () -> Unit,
) {
    val clexColors = ClexColors.current
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(clexColors.bgPrimary),
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(clexColors.bgSecondary)
                .clickable(onClick = onBack)
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("←", color = clexColors.accent, fontSize = 18.sp)
            Text("File details", fontFamily = ClexDisplayFont, fontSize = 14.sp, color = clexColors.textPrimary)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(mimeToEmoji(entry.mimeType), fontSize = 40.sp)
            Text(entry.name, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = clexColors.textPrimary)

            Spacer(Modifier.height(4.dp))
            DetailItem("SIZE", formatBytes(entry.size))
            DetailItem("TYPE", entry.mimeType)
            DetailItem("SAVED", formatDate(entry.savedAt))
            DetailItem("PATH", entry.path.substringAfterLast("/vault/"))

            Spacer(Modifier.weight(1f))

            // Share intent
            Button(
                onClick = { /* launch FileProvider share intent */ },
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape  = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
                colors = ButtonDefaults.buttonColors(containerColor = clexColors.bgTertiary, contentColor = clexColors.textPrimary),
            ) { Text("Share", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold) }

            // Delete
            if (showDeleteConfirm) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { showDeleteConfirm = false },
                        modifier = Modifier.weight(1f).height(44.dp),
                        shape  = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
                        border = BorderStroke(1.dp, clexColors.borderColor),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.textSecondary),
                    ) { Text("Cancel", fontFamily = ClexBodyFont) }
                    Button(
                        onClick = { onDelete(entry) },
                        modifier = Modifier.weight(1f).height(44.dp),
                        shape  = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = clexColors.accentSecondary, contentColor = clexColors.bgPrimary),
                    ) { Text("Delete", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold) }
                }
            } else {
                OutlinedButton(
                    onClick = { showDeleteConfirm = true },
                    modifier = Modifier.fillMaxWidth().height(44.dp),
                    shape  = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
                    border = BorderStroke(1.dp, clexColors.accentSecondary),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.accentSecondary),
                ) { Text("Delete from vault", fontFamily = ClexBodyFont) }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun DetailItem(label: String, value: String) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(label, fontFamily = ClexDisplayFont, fontSize = 9.sp, color = clexColors.textTertiary)
        Spacer(Modifier.height(3.dp))
        Text(value, fontFamily = ClexBodyFont, fontSize = 12.sp, color = clexColors.textPrimary)
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

private fun formatBytes(bytes: Long): String = when {
    bytes < 1024         -> "$bytes B"
    bytes < 1024 * 1024  -> "${bytes / 1024} KB"
    else                 -> "%.1f MB".format(bytes / (1024.0 * 1024))
}

private fun formatDate(epochMs: Long): String {
    val sdf = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    return sdf.format(Date(epochMs))
}
