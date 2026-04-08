package in.clex.mobile.feature.workspace

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import in.clex.mobile.core.model.FileEntry
import in.clex.mobile.core.model.WorkspacePanel
import in.clex.mobile.feature.workspace.prepare.PreparePanelScreen
import in.clex.mobile.feature.workspace.share.SharePanelScreen

@Composable
fun WorkspaceScreen(
    navController: NavController,
    vm: WorkspaceViewModel = hiltViewModel(),
) {
    val files by vm.files.collectAsState()
    val activePanel by vm.activePanel.collectAsState()
    val clexColors = ClexColors.current

    val filePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { uris ->
        if (uris.isNotEmpty()) vm.addFiles(uris)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(clexColors.bgPrimary),
    ) {
        // ── Top bar ───────────────────────────────────────────────────────────
        WorkspaceTopBar(
            fileCount = files.size,
            onClear   = vm::clearFiles,
        )

        // ── Panel tabs ────────────────────────────────────────────────────────
        PanelTabRow(
            activePanel = activePanel,
            onPanelSelected = vm::setPanel,
            filesEnabled   = true,
            prepareEnabled = files.isNotEmpty(),
            shareEnabled   = files.isNotEmpty(),
        )

        // ── Panel content — fixed height, NO scrolling at panel level ─────────
        AnimatedContent(
            targetState = activePanel,
            transitionSpec = { fadeIn(tween(120)) togetherWith fadeOut(tween(120)) },
            modifier = Modifier.fillMaxSize(),
        ) { panel ->
            when (panel) {
                WorkspacePanel.FILES   -> FilesPanelScreen(
                    files        = files,
                    onAddFiles   = { filePicker.launch("*/*") },
                    onRemoveFile = vm::removeFile,
                )
                WorkspacePanel.PREPARE -> PreparePanelScreen(
                    files           = files,
                    onToolSelected  = { /* tool runner — Phase 4 */ },
                    onShareNext     = { vm.setPanel(WorkspacePanel.SHARE) },
                )
                WorkspacePanel.SHARE   -> SharePanelScreen(vm = vm)
            }
        }
    }
}

@Composable
private fun WorkspaceTopBar(fileCount: Int, onClear: () -> Unit) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(clexColors.bgSecondary)
            .border(bottom = 1.dp, color = clexColors.borderColor)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = "CLEX",
            fontFamily = ClexDisplayFont,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            color = clexColors.accent,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (fileCount > 0) {
                Text(
                    text = "$fileCount",
                    fontFamily = ClexDisplayFont,
                    fontSize = 11.sp,
                    color = clexColors.textSecondary,
                )
                Text(
                    text = "CLEAR",
                    fontFamily = ClexDisplayFont,
                    fontSize = 11.sp,
                    color = clexColors.accentSecondary,
                    modifier = Modifier.clickable(onClick = onClear),
                )
            }
        }
    }
}

@Composable
private fun PanelTabRow(
    activePanel: WorkspacePanel,
    onPanelSelected: (WorkspacePanel) -> Unit,
    filesEnabled: Boolean,
    prepareEnabled: Boolean,
    shareEnabled: Boolean,
) {
    val clexColors = ClexColors.current
    val tabs = listOf(WorkspacePanel.FILES, WorkspacePanel.PREPARE, WorkspacePanel.SHARE)
    val enabled = mapOf(
        WorkspacePanel.FILES   to filesEnabled,
        WorkspacePanel.PREPARE to prepareEnabled,
        WorkspacePanel.SHARE   to shareEnabled,
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(clexColors.bgSecondary)
            .border(bottom = 1.dp, color = clexColors.borderColor),
    ) {
        tabs.forEach { panel ->
            val isActive = panel == activePanel
            val isEnabled = enabled[panel] == true
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(
                        when {
                            isActive && isEnabled -> clexColors.bgTertiary
                            else                  -> clexColors.bgSecondary
                        }
                    )
                    .border(bottom = if (isActive) 2.dp else 0.dp, color = clexColors.accent)
                    .clickable(enabled = isEnabled) { onPanelSelected(panel) }
                    .padding(vertical = 11.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = panel.name,
                    fontFamily = ClexDisplayFont,
                    fontSize = 10.sp,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                    color = when {
                        isActive && isEnabled  -> clexColors.accent
                        !isEnabled             -> clexColors.textTertiary
                        else                   -> clexColors.textSecondary
                    },
                )
            }
        }
    }
}

@Composable
private fun FilesPanelScreen(
    files: List<FileEntry>,
    onAddFiles: () -> Unit,
    onRemoveFile: (String) -> Unit,
) {
    val clexColors = ClexColors.current

    if (files.isEmpty()) {
        // Drop zone
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .border(2.dp, clexColors.borderColor)
                .clickable(onClick = onAddFiles),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("+", fontSize = 52.sp, color = clexColors.accent, fontFamily = ClexDisplayFont)
                Text("Tap to add files", color = clexColors.textSecondary, fontSize = 14.sp, fontFamily = ClexBodyFont)
                Text(
                    text = "Any file type · Up to device limits",
                    color = clexColors.textTertiary,
                    fontSize = 11.sp,
                    fontFamily = ClexBodyFont,
                    textAlign = TextAlign.Center,
                )
            }
        }
    } else {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
        ) {
            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(files, key = { it.id }) { file ->
                    FileListRow(file = file, onRemove = { onRemoveFile(file.id) })
                }
            }
            OutlinedButton(
                onClick = onAddFiles,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
                border = BorderStroke(1.dp, clexColors.borderColor),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.textSecondary),
            ) { Text("+ Add more", fontFamily = ClexBodyFont, fontSize = 13.sp) }
        }
    }
}

@Composable
private fun FileListRow(file: FileEntry, onRemove: () -> Unit) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = file.name,
                color = clexColors.textPrimary,
                fontFamily = ClexBodyFont,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
            Text(
                text = formatBytes(file.size),
                color = clexColors.textTertiary,
                fontFamily = ClexBodyFont,
                fontSize = 10.sp,
            )
        }
        Text(
            text = "×",
            color = clexColors.textSecondary,
            fontSize = 18.sp,
            modifier = Modifier
                .clickable(onClick = onRemove)
                .padding(4.dp),
        )
    }
}

// Extension to add a bottom border to a Row
@Composable
private fun Modifier.border(bottom: Dp, color: androidx.compose.ui.graphics.Color): Modifier =
    this.then(
        Modifier.border(
            border = BorderStroke(0.dp, color),
        )
    )

private fun formatBytes(bytes: Long): String = when {
    bytes < 1024         -> "$bytes B"
    bytes < 1024 * 1024  -> "${bytes / 1024} KB"
    else                 -> "%.1f MB".format(bytes / (1024.0 * 1024))
}
