package in.clex.mobile.feature.workspace.share

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.core.design.theme.ClexDisplayFont
import in.clex.mobile.core.design.theme.ClexBodyFont
import in.clex.mobile.core.model.ReceiveLink
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.core.model.TransferState
import in.clex.mobile.core.model.TransferUiState
import in.clex.mobile.feature.workspace.WorkspaceViewModel

// Share method tabs — mirrors web SharePanel tabs
private enum class ShareTab(val label: String) {
    DIRECT("Direct"),
    LOCAL("Local"),
    DRIVE("Drive"),
}

@Composable
fun SharePanelScreen(
    vm: WorkspaceViewModel,
) {
    val transferState by vm.transferState.collectAsState()
    val files by vm.files.collectAsState()
    val clexColors = ClexColors.current

    var selectedTab by remember { mutableStateOf(ShareTab.DIRECT) }

    // Map ShareTab → TransferMethod
    val method = when (selectedTab) {
        ShareTab.DIRECT -> TransferMethod.WEBRTC
        ShareTab.LOCAL  -> TransferMethod.LOCAL
        ShareTab.DRIVE  -> TransferMethod.DRIVE
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(clexColors.bgPrimary),
    ) {
        // ── Method tabs ───────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(clexColors.bgSecondary)
                .border(1.dp, clexColors.borderColor),
        ) {
            ShareTab.values().forEach { tab ->
                val isActive = tab == selectedTab
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(if (isActive) clexColors.bgTertiary else clexColors.bgSecondary)
                        .clickable {
                            selectedTab = tab
                            vm.setTransferMethod(method)
                        }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = tab.label.uppercase(),
                        fontFamily = ClexDisplayFont,
                        fontSize = 10.sp,
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                        color = if (isActive) clexColors.accent else clexColors.textSecondary,
                    )
                }
            }
        }

        // ── Panel body — animated on state transition ─────────────────────────
        AnimatedContent(
            targetState = transferState.state,
            transitionSpec = { fadeIn(tween(180)) togetherWith fadeOut(tween(180)) },
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp),
        ) { state ->
            when (state) {
                TransferState.IDLE, TransferState.PREPARING -> {
                    ReadyToSendPanel(
                        transferState = transferState,
                        tab           = selectedTab,
                        fileCount     = files.size,
                        onStart       = { vm.startTransfer() },
                    )
                }
                TransferState.WAITING_PEER -> {
                    WaitingPeerPanel(
                        transferState = transferState,
                    )
                }
                TransferState.CONNECTING -> {
                    ConnectingPanel()
                }
                TransferState.TRANSFERRING -> {
                    TransferringPanel(transferState = transferState)
                }
                TransferState.COMPLETE -> {
                    CompletePanel(onReset = { vm.resetTransfer() })
                }
                TransferState.FAILED -> {
                    FailedPanel(
                        error    = transferState.error ?: "Transfer failed",
                        onRetry  = { vm.resetTransfer() },
                    )
                }
            }
        }
    }
}

// ── Ready to send ────────────────────────────────────────────────────────────

@Composable
private fun ReadyToSendPanel(
    transferState: TransferUiState,
    tab: ShareTab,
    fileCount: Int,
    onStart: () -> Unit,
) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "${fileCount} file${if (fileCount != 1) "s" else ""} ready",
            color = clexColors.textSecondary,
            fontSize = 13.sp,
            fontFamily = ClexBodyFont,
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onStart,
            enabled = fileCount > 0,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .border(2.dp, if (fileCount > 0) clexColors.accent else clexColors.borderColor),
            shape = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = clexColors.accent,
                contentColor   = clexColors.textInverse,
                disabledContainerColor = clexColors.bgTertiary,
                disabledContentColor   = clexColors.textTertiary,
            ),
        ) {
            Text(
                text = when (tab) {
                    ShareTab.DIRECT -> "Start Direct Transfer"
                    ShareTab.LOCAL  -> "Start Local Transfer"
                    ShareTab.DRIVE  -> "Upload to Drive"
                },
                fontFamily = ClexDisplayFont,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
            )
        }
    }
}

// ── Waiting for peer — shows QR + room code ──────────────────────────────────

@Composable
private fun WaitingPeerPanel(transferState: TransferUiState) {
    val clexColors = ClexColors.current
    val context = LocalContext.current
    val code = transferState.roomCode
    val method = transferState.method
    val receiveLink = remember(code, method) {
        ReceiveLink.generate(code, method).toString()
    }
    val qrBitmap = remember(receiveLink) { generateQr(receiveLink, 400) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Text(
            text = "Waiting for receiver…",
            fontFamily = ClexDisplayFont,
            fontSize = 15.sp,
            color = clexColors.textSecondary,
        )

        // QR code
        qrBitmap?.let { bmp ->
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .border(3.dp, clexColors.accent)
                    .padding(8.dp),
            ) {
                Image(
                    bitmap = bmp.asImageBitmap(),
                    contentDescription = "QR code for receive link",
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        // Room code display
        Text(
            text = code.value,
            fontFamily = ClexDisplayFont,
            fontWeight = FontWeight.Bold,
            fontSize = 36.sp,
            color = clexColors.accent,
            letterSpacing = 10.sp,
        )

        // Copy link
        OutlinedButton(
            onClick = {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Clex receive link", receiveLink))
            },
            border = BorderStroke(1.dp, clexColors.borderColor),
            shape  = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.textPrimary),
        ) {
            Text("Copy link", fontFamily = ClexBodyFont, fontSize = 13.sp)
        }

        // Share link via Android share sheet
        val shareIntent = remember(receiveLink) {
            Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, receiveLink)
                putExtra(Intent.EXTRA_SUBJECT, "Receive files on Clex")
            }
        }
        OutlinedButton(
            onClick = {
                context.startActivity(Intent.createChooser(shareIntent, "Share via"))
            },
            border = BorderStroke(1.dp, clexColors.accent),
            shape  = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.accent),
        ) {
            Text("Share link", fontFamily = ClexBodyFont, fontSize = 13.sp)
        }
    }
}

// ── Connecting ───────────────────────────────────────────────────────────────

@Composable
private fun ConnectingPanel() {
    val clexColors = ClexColors.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = clexColors.accent, strokeWidth = 2.dp)
            Text("Connecting…", color = clexColors.textSecondary, fontFamily = ClexDisplayFont, fontSize = 14.sp)
        }
    }
}

// ── Transferring ─────────────────────────────────────────────────────────────

@Composable
private fun TransferringPanel(transferState: TransferUiState) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier.fillMaxSize().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        transferState.currentFile?.let { file ->
            Text(
                text = file.name,
                color = clexColors.textPrimary,
                fontFamily = ClexBodyFont,
                fontSize = 14.sp,
                maxLines = 2,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(8.dp))
        }

        LinearProgressIndicator(
            progress = { transferState.progress / 100f },
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = clexColors.accent,
            trackColor = clexColors.bgTertiary,
        )
        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("${transferState.progress}%", color = clexColors.accent, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 20.sp)
            if (transferState.speedBps > 0) {
                Text(
                    formatSpeed(transferState.speedBps),
                    color = clexColors.textSecondary,
                    fontFamily = ClexBodyFont,
                    fontSize = 13.sp,
                    modifier = Modifier.align(Alignment.CenterVertically),
                )
            }
        }

        if (transferState.nearby) {
            Spacer(Modifier.height(12.dp))
            Text("● LAN", color = clexColors.accentTertiary, fontFamily = ClexDisplayFont, fontSize = 11.sp)
        }
    }
}

// ── Complete ─────────────────────────────────────────────────────────────────

@Composable
private fun CompletePanel(onReset: () -> Unit) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("✓", fontSize = 48.sp, color = clexColors.accent, fontFamily = ClexDisplayFont)
        Spacer(Modifier.height(12.dp))
        Text("Transfer complete", fontFamily = ClexDisplayFont, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = clexColors.textPrimary)
        Spacer(Modifier.height(24.dp))
        OutlinedButton(
            onClick = onReset,
            border = BorderStroke(1.dp, clexColors.borderColor),
            shape = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.textSecondary),
        ) { Text("New transfer", fontFamily = ClexBodyFont, fontSize = 13.sp) }
    }
}

// ── Failed ───────────────────────────────────────────────────────────────────

@Composable
private fun FailedPanel(error: String, onRetry: () -> Unit) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier.fillMaxSize().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("✕", fontSize = 40.sp, color = clexColors.accentSecondary, fontFamily = ClexDisplayFont)
        Spacer(Modifier.height(12.dp))
        Text("Transfer failed", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = clexColors.textPrimary)
        Spacer(Modifier.height(8.dp))
        Text(error, color = clexColors.textSecondary, fontSize = 12.sp, textAlign = TextAlign.Center, fontFamily = ClexBodyFont)
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.buttonColors(containerColor = clexColors.bgTertiary, contentColor = clexColors.textPrimary),
        ) { Text("Try again", fontFamily = ClexBodyFont, fontSize = 13.sp) }
    }
}

// ── QR generation helper ─────────────────────────────────────────────────────

private fun generateQr(content: String, sizePx: Int): Bitmap? = runCatching {
    val hints = mapOf(EncodeHintType.MARGIN to 0)
    val bits = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
    val bmp = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.RGB_565)
    for (x in 0 until sizePx) {
        for (y in 0 until sizePx) {
            bmp.setPixel(x, y, if (bits[x, y]) Color.BLACK else Color.WHITE)
        }
    }
    bmp
}.getOrNull()

private fun formatSpeed(bps: Long): String = when {
    bps < 1024       -> "$bps B/s"
    bps < 1024 * 1024 -> "${bps / 1024} KB/s"
    else              -> "%.1f MB/s".format(bps / (1024.0 * 1024))
}
