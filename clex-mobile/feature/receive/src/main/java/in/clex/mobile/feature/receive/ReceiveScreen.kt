package in.clex.mobile.feature.receive

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import in.clex.mobile.core.design.theme.ClexBodyFont
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.core.design.theme.ClexDisplayFont
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.navigation.ReceiveDeepLinkArgs

/**
 * Receive screen — contains all receive flow steps as fixed-height screens
 * (no primary scroll, all overflow handled by inner content).
 */
@Composable
fun ReceiveScreen(
    navController: NavController,
    initialArgs: ReceiveDeepLinkArgs? = null,
    vm: ReceiveViewModel = hiltViewModel(),
) {
    val step by vm.step.collectAsState()
    val transferState by vm.transferState.collectAsState()
    val clexColors = ClexColors.current

    // Apply deep link on first composition
    LaunchedEffect(initialArgs) {
        initialArgs?.let { vm.applyDeepLink(it) }
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
                .border(bottom = 1.dp, color = clexColors.borderColor)
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("RECEIVE", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = clexColors.accent)
            if (step != ReceiveStep.CODE_ENTRY) {
                Text(
                    "✕ Reset",
                    fontFamily = ClexBodyFont,
                    fontSize = 12.sp,
                    color = clexColors.textSecondary,
                    modifier = Modifier.clickable { vm.reset() },
                )
            }
        }

        // ── Step content ──────────────────────────────────────────────────────
        AnimatedContent(
            targetState = step,
            transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) },
            modifier = Modifier.fillMaxSize(),
        ) { currentStep ->
            when (currentStep) {
                ReceiveStep.CODE_ENTRY -> CodeEntryStep(vm = vm)
                ReceiveStep.MODE_CHOICE -> ModeChoiceStep(vm = vm)
                ReceiveStep.WAITING    -> WaitingStep()
                ReceiveStep.CONNECTING -> ConnectingStep()
                ReceiveStep.TRANSFERRING -> TransferringStep(
                    progress    = transferState.progress,
                    fileName    = transferState.currentFile?.name,
                    speedBps    = transferState.speedBps,
                    isNearby    = transferState.nearby,
                )
                ReceiveStep.RECEIVED -> ReceivedStep(
                    files   = transferState.receivedFiles,
                    code    = transferState.roomCode.value,
                    onSaveAll = { vm.saveAllAsZip(transferState.receivedFiles) },
                    onReset = vm::reset,
                )
            }
        }
    }
}

// ── Step: Code Entry ─────────────────────────────────────────────────────────

@Composable
private fun CodeEntryStep(vm: ReceiveViewModel) {
    val code by vm.code.collectAsState()
    val error by vm.codeError.collectAsState()
    val clexColors = ClexColors.current
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "Enter room code",
            fontFamily = ClexDisplayFont,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            color = clexColors.textPrimary,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Ask the sender for their 6-character code",
            fontFamily = ClexBodyFont,
            fontSize = 13.sp,
            color = clexColors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))

        // Code input — Space Mono for the room code feel
        TextField(
            value = code,
            onValueChange = vm::onCodeInput,
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
                .border(2.dp, if (error != null) clexColors.accentSecondary else clexColors.borderColor),
            textStyle = LocalTextStyle.current.copy(
                fontFamily  = ClexDisplayFont,
                fontWeight  = FontWeight.Bold,
                fontSize    = 28.sp,
                textAlign   = TextAlign.Center,
                color       = clexColors.accent,
                letterSpacing = 8.sp,
            ),
            placeholder = {
                Text(
                    "ABC123",
                    fontFamily = ClexDisplayFont,
                    fontSize = 28.sp,
                    color = clexColors.textTertiary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                    letterSpacing = 8.sp,
                )
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Characters,
                keyboardType   = KeyboardType.Text,
                imeAction      = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = { vm.submitCode() }),
            colors = TextFieldDefaults.colors(
                focusedContainerColor   = clexColors.bgInput,
                unfocusedContainerColor = clexColors.bgInput,
                focusedIndicatorColor   = androidx.compose.ui.graphics.Color.Transparent,
                unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
            ),
        )

        error?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = clexColors.accentSecondary, fontSize = 12.sp, fontFamily = ClexBodyFont)
        }

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = vm::submitCode,
            enabled = code.length == 6,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape  = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = clexColors.accent,
                contentColor   = clexColors.textInverse,
                disabledContainerColor = clexColors.bgTertiary,
            ),
        ) {
            Text("Continue →", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold)
        }
    }
}

// ── Step: Mode Choice ────────────────────────────────────────────────────────

@Composable
private fun ModeChoiceStep(vm: ReceiveViewModel) {
    val code by vm.code.collectAsState()
    val selectedMethod by vm.selectedMethod.collectAsState()
    val clexColors = ClexColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Code preview
        Text(
            text = code,
            fontFamily = ClexDisplayFont,
            fontWeight = FontWeight.Bold,
            fontSize = 36.sp,
            color = clexColors.accent,
            letterSpacing = 10.sp,
        )
        Spacer(Modifier.height(6.dp))
        Text("Choose connection mode", fontFamily = ClexBodyFont, fontSize = 13.sp, color = clexColors.textSecondary)
        Spacer(Modifier.height(32.dp))

        // Direct (WebRTC)
        ModeCard(
            title       = "DIRECT",
            subtitle    = "Works over the internet · Encrypted P2P",
            isSelected  = selectedMethod == TransferMethod.WEBRTC,
            onClick     = { vm.selectMethod(TransferMethod.WEBRTC) },
        )
        Spacer(Modifier.height(12.dp))

        // Local (LAN)
        ModeCard(
            title       = "LOCAL",
            subtitle    = "Same Wi-Fi · Sender & receiver on same network",
            isSelected  = selectedMethod == TransferMethod.LOCAL,
            onClick     = { vm.selectMethod(TransferMethod.LOCAL) },
        )
        Spacer(Modifier.height(32.dp))

        Button(
            onClick = vm::connect,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape  = RoundedCornerShape(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = clexColors.accent,
                contentColor   = clexColors.textInverse,
            ),
        ) {
            Text("Connect", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ModeCard(title: String, subtitle: String, isSelected: Boolean, onClick: () -> Unit) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = if (isSelected) 2.dp else 1.dp,
                color = if (isSelected) clexColors.accent else clexColors.borderColor,
            )
            .background(if (isSelected) clexColors.accentMuted else clexColors.bgCard)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Radio indicator
        Box(
            modifier = Modifier
                .size(18.dp)
                .border(2.dp, if (isSelected) clexColors.accent else clexColors.borderColor)
                .background(if (isSelected) clexColors.accent else clexColors.bgPrimary),
        )
        Column {
            Text(title, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = if (isSelected) clexColors.accent else clexColors.textPrimary)
            Text(subtitle, fontFamily = ClexBodyFont, fontSize = 11.sp, color = clexColors.textSecondary)
        }
    }
}

// ── Step: Waiting ─────────────────────────────────────────────────────────────

@Composable
private fun WaitingStep() {
    val clexColors = ClexColors.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = clexColors.accent, strokeWidth = 2.dp)
            Text("Waiting for sender…", fontFamily = ClexDisplayFont, fontSize = 15.sp, color = clexColors.textSecondary)
        }
    }
}

// ── Step: Connecting ─────────────────────────────────────────────────────────

@Composable
private fun ConnectingStep() {
    val clexColors = ClexColors.current
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            CircularProgressIndicator(color = clexColors.accent, strokeWidth = 2.dp)
            Text("Establishing connection…", fontFamily = ClexDisplayFont, fontSize = 15.sp, color = clexColors.textSecondary)
        }
    }
}

// ── Step: Transferring ───────────────────────────────────────────────────────

@Composable
private fun TransferringStep(
    progress: Int,
    fileName: String?,
    speedBps: Long,
    isNearby: Boolean,
) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        fileName?.let {
            Text(it, fontFamily = ClexBodyFont, fontSize = 14.sp, color = clexColors.textSecondary, maxLines = 2, textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
        }
        LinearProgressIndicator(
            progress = { progress / 100f },
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = clexColors.accent,
            trackColor = clexColors.bgTertiary,
        )
        Spacer(Modifier.height(12.dp))
        Text("$progress%", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 28.sp, color = clexColors.accent)
        if (speedBps > 0) {
            Text(formatSpeedReceive(speedBps), fontFamily = ClexBodyFont, fontSize = 12.sp, color = clexColors.textSecondary)
        }
        if (isNearby) {
            Spacer(Modifier.height(8.dp))
            Text("● LAN", fontFamily = ClexDisplayFont, fontSize = 10.sp, color = clexColors.accentTertiary)
        }
    }
}

// ── Step: Received ───────────────────────────────────────────────────────────

@Composable
private fun ReceivedStep(
    files: List<in.clex.mobile.core.model.ReceivedFile>,
    code: String,
    onSaveAll: () -> ByteArray,
    onReset: () -> Unit,
) {
    val clexColors = ClexColors.current

    Column(
        modifier = Modifier.fillMaxSize(),
    ) {
        // File list
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            item {
                Text(
                    text = "${files.size} file${if (files.size != 1) "s" else ""} received",
                    fontFamily = ClexDisplayFont,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = clexColors.textPrimary,
                )
                Spacer(Modifier.height(12.dp))
            }
            items(files, key = { it.id }) { file ->
                ReceivedFileRow(file = file)
            }
        }

        // Save buttons
        Column(
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = { /* save all as zip — caller triggers share intent */ onSaveAll() },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape  = RoundedCornerShape(0.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = clexColors.accent,
                    contentColor   = clexColors.textInverse,
                ),
            ) {
                Text("Save all as ZIP", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold)
            }
            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.fillMaxWidth().height(44.dp),
                shape = RoundedCornerShape(0.dp),
                border = BorderStroke(1.dp, clexColors.borderColor),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.textSecondary),
            ) { Text("Done", fontFamily = ClexBodyFont, fontSize = 13.sp) }
        }
    }
}

@Composable
private fun ReceivedFileRow(file: in.clex.mobile.core.model.ReceivedFile) {
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
            Text(file.name, color = clexColors.textPrimary, fontSize = 13.sp, fontFamily = ClexBodyFont, maxLines = 1)
            Text(formatBytesReceive(file.size), color = clexColors.textTertiary, fontSize = 10.sp, fontFamily = ClexBodyFont)
        }
        Text("✓", color = clexColors.accent, fontSize = 14.sp)
    }
}

@Composable
private fun Modifier.border(bottom: androidx.compose.ui.unit.Dp, color: androidx.compose.ui.graphics.Color) =
    this.run { this }

private fun formatSpeedReceive(bps: Long) = when {
    bps < 1024        -> "$bps B/s"
    bps < 1024 * 1024 -> "${bps / 1024} KB/s"
    else              -> "%.1f MB/s".format(bps / (1024.0 * 1024))
}

private fun formatBytesReceive(bytes: Long) = when {
    bytes < 1024         -> "$bytes B"
    bytes < 1024 * 1024  -> "${bytes / 1024} KB"
    else                 -> "%.1f MB".format(bytes / (1024.0 * 1024))
}
