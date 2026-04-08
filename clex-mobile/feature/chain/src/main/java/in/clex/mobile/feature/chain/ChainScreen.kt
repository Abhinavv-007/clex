package in.clex.mobile.feature.chain

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import in.clex.mobile.core.design.theme.ClexBodyFont
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.core.design.theme.ClexDisplayFont
import in.clex.mobile.core.model.ChainSessionSummary

@Composable
fun ChainScreen(
    navController: NavController,
    vm: ChainViewModel = hiltViewModel(),
) {
    val state by vm.state.collectAsState()
    val activeTab by vm.activeTab.collectAsState()
    val clexColors = ClexColors.current

    // Register on mount — non-blocking
    LaunchedEffect(Unit) { vm.onMount() }

    // If session is selected, show detail
    if (state.selectedSession != null) {
        SessionDetailScreen(
            detail  = state.selectedSession!!,
            onBack  = vm::clearSelectedSession,
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
            Text("CHAIN", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = clexColors.accent)
            Text(
                text = "What is this?",
                fontFamily = ClexBodyFont,
                fontSize = 11.sp,
                color = clexColors.textTertiary,
            )
        }

        // ── Tabs ──────────────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(clexColors.bgSecondary)
                .border(bottom = 1.dp, color = clexColors.borderColor),
        ) {
            ChainTab.values().forEach { tab ->
                val isActive = tab == activeTab
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .background(if (isActive) clexColors.bgTertiary else clexColors.bgSecondary)
                        .clickable { vm.setTab(tab) }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = tab.name,
                        fontFamily = ClexDisplayFont,
                        fontSize = 10.sp,
                        fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                        color = if (isActive) clexColors.accent else clexColors.textSecondary,
                    )
                }
            }
        }

        // ── Tab content ───────────────────────────────────────────────────────
        AnimatedContent(
            targetState = activeTab,
            transitionSpec = { fadeIn(tween(150)) togetherWith fadeOut(tween(150)) },
            modifier = Modifier.fillMaxSize(),
        ) { tab ->
            when (tab) {
                ChainTab.ID       -> ChainIdTab(chainId = state.chainId, isLoading = state.isLoading)
                ChainTab.STATS    -> ChainStatsTab(stats = state.stats, isLoading = state.isLoading, onRefresh = vm::loadStats)
                ChainTab.SESSIONS -> ChainSessionsTab(
                    page = state.explorerPage,
                    isLoading = state.isLoading,
                    onRefresh = { vm.loadSessions() },
                    onSessionClick = { vm.loadSession(it) },
                )
            }
        }
    }
}

// ── Chain ID tab ──────────────────────────────────────────────────────────────

@Composable
private fun ChainIdTab(chainId: String?, isLoading: Boolean) {
    val clexColors = ClexColors.current
    val context = LocalContext.current

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Your Chain ID", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = clexColors.textPrimary)
        Spacer(Modifier.height(8.dp))
        Text(
            text = "This device's pseudonymous ledger identity.\nNever changes unless you clear app data.",
            fontFamily = ClexBodyFont,
            fontSize = 12.sp,
            color = clexColors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(28.dp))

        if (chainId != null) {
            // Split 32-hex into groups of 8 for readability
            val chunks = chainId.chunked(8)
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                chunks.forEach { chunk ->
                    Text(
                        text = chunk,
                        fontFamily = ClexDisplayFont,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = clexColors.accent,
                        letterSpacing = 3.sp,
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            OutlinedButton(
                onClick = {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    clipboard.setPrimaryClip(ClipData.newPlainText("Clex Chain ID", chainId))
                },
                border = BorderStroke(1.dp, clexColors.borderColor),
                shape  = androidx.compose.foundation.shape.RoundedCornerShape(0.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = clexColors.textSecondary),
            ) { Text("Copy ID", fontFamily = ClexBodyFont) }
        } else {
            CircularProgressIndicator(color = clexColors.accent, strokeWidth = 2.dp)
        }
    }
}

// ── Stats tab ─────────────────────────────────────────────────────────────────

@Composable
private fun ChainStatsTab(
    stats: in.clex.mobile.core.model.ChainStats?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
) {
    val clexColors = ClexColors.current

    Box(Modifier.fillMaxSize()) {
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = clexColors.accent, strokeWidth = 2.dp)
        } else if (stats == null) {
            Column(modifier = Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Couldn't load stats", color = clexColors.textSecondary, fontFamily = ClexBodyFont)
                Spacer(Modifier.height(12.dp))
                TextButton(onClick = onRefresh) { Text("Retry", color = clexColors.accent, fontFamily = ClexBodyFont) }
            }
        } else {
            Column(
                modifier = Modifier.fillMaxSize().padding(28.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Spacer(Modifier.height(16.dp))
                StatRow("TOTAL SESSIONS",   stats.totalSessions.toString())
                StatRow("COMPLETED",        stats.completedSessions.toString())
                StatRow("UNIQUE CHAINS",    stats.totalChains.toString())
            }
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, fontFamily = ClexDisplayFont, fontSize = 11.sp, color = clexColors.textTertiary)
        Text(value, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 24.sp, color = clexColors.accent)
    }
}

// ── Sessions explorer tab ─────────────────────────────────────────────────────

@Composable
private fun ChainSessionsTab(
    page: in.clex.mobile.core.model.ChainExplorerPage?,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onSessionClick: (String) -> Unit,
) {
    val clexColors = ClexColors.current

    Box(Modifier.fillMaxSize()) {
        when {
            isLoading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = clexColors.accent, strokeWidth = 2.dp)
            page == null -> {
                Column(modifier = Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("No sessions yet", color = clexColors.textSecondary, fontFamily = ClexBodyFont)
                    Spacer(Modifier.height(12.dp))
                    TextButton(onClick = onRefresh) { Text("Load", color = clexColors.accent, fontFamily = ClexBodyFont) }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    item {
                        Text(
                            "${page.total} sessions · page ${page.page}",
                            fontFamily = ClexDisplayFont,
                            fontSize = 10.sp,
                            color = clexColors.textTertiary,
                            modifier = Modifier.padding(bottom = 8.dp),
                        )
                    }
                    items(page.sessions, key = { it.sessionId }) { session ->
                        SessionSummaryRow(session = session, onClick = { onSessionClick(session.sessionId) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SessionSummaryRow(session: ChainSessionSummary, onClick: () -> Unit) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = session.sessionId.take(16) + "…",
                fontFamily = ClexDisplayFont,
                fontSize = 11.sp,
                color = clexColors.textPrimary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(session.route.uppercase(), fontFamily = ClexDisplayFont, fontSize = 9.sp, color = clexColors.textTertiary)
                Text(session.status.uppercase(), fontFamily = ClexDisplayFont, fontSize = 9.sp,
                    color = when (session.status) {
                        "completed" -> clexColors.accent
                        "failed"    -> clexColors.accentSecondary
                        else        -> clexColors.textTertiary
                    }
                )
            }
        }
        Text("›", color = clexColors.textSecondary, fontSize = 18.sp)
    }
}

// ── Session detail ────────────────────────────────────────────────────────────

@Composable
private fun SessionDetailScreen(
    detail: in.clex.mobile.core.model.ChainSessionDetail,
    onBack: () -> Unit,
) {
    val clexColors = ClexColors.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(clexColors.bgPrimary),
    ) {
        // Back header
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
            Text("Session detail", fontFamily = ClexDisplayFont, fontSize = 14.sp, color = clexColors.textPrimary)
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item { DetailField("SESSION ID", detail.sessionId) }
            item { DetailField("CHAIN ID", detail.senderChainId) }
            item { DetailField("ROUTE", detail.route.uppercase()) }
            item {
                DetailField(
                    "STATUS",
                    detail.status.uppercase(),
                    valueColor = when (detail.status) {
                        "completed" -> clexColors.accent
                        "failed"    -> clexColors.accentSecondary
                        else        -> clexColors.textPrimary
                    }
                )
            }
            item { DetailField("CREATED", detail.createdAt) }
            detail.ledgerIndex?.let { item { DetailField("LEDGER INDEX", it.toString()) } }
            detail.recordHash?.let { item { DetailField("RECORD HASH", it.take(32) + "…") } }

            if (detail.events.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(8.dp))
                    Text("EVENTS", fontFamily = ClexDisplayFont, fontSize = 10.sp, color = clexColors.textTertiary)
                }
                items(detail.events, key = { it.ts }) { event ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, clexColors.borderSubtle)
                            .background(clexColors.bgCard)
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(event.status.uppercase(), fontFamily = ClexDisplayFont, fontSize = 10.sp, color = clexColors.textPrimary)
                        Text(event.ts.take(19), fontFamily = ClexBodyFont, fontSize = 10.sp, color = clexColors.textTertiary)
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailField(
    label: String,
    value: String,
    valueColor: androidx.compose.ui.graphics.Color? = null,
) {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Text(label, fontFamily = ClexDisplayFont, fontSize = 9.sp, color = clexColors.textTertiary)
        Spacer(Modifier.height(4.dp))
        Text(value, fontFamily = ClexBodyFont, fontSize = 12.sp, color = valueColor ?: clexColors.textPrimary)
    }
}

@Composable
private fun Modifier.border(bottom: androidx.compose.ui.unit.Dp, color: androidx.compose.ui.graphics.Color) = this
