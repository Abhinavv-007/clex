package in.clex.mobile.feature.explore

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import in.clex.mobile.core.design.theme.ClexBodyFont
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.core.design.theme.ClexDisplayFont

/**
 * Explore screen — contains all marketing/info pages from web as chapterized pager screens.
 * Each web page section becomes a bounded HorizontalPager page (no vertical scroll at root).
 *
 * Web routes mapped:
 *   / → Home
 *   /features → Features
 *   /how-it-works → HowItWorks (chapterized pager)
 *   /getting-started → GetStarted
 *   /faq → FAQ
 *   /privacy → Privacy (via legal)
 *   /terms → Terms (via legal)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ExploreScreen(navController: NavController) {
    val clexColors = ClexColors.current
    val sections = ExploreSection.values()
    val pagerState = rememberPagerState(pageCount = { sections.size })

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
            Text("EXPLORE", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = clexColors.accent)
            Text(
                text = "${pagerState.currentPage + 1} / ${sections.size}",
                fontFamily = ClexDisplayFont,
                fontSize = 11.sp,
                color = clexColors.textTertiary,
            )
        }

        // ── Section tab strip (horizontal scroll) ─────────────────────────────
        SectionTabStrip(
            sections     = sections,
            currentPage  = pagerState.currentPage,
            onTabClick   = { idx ->
                /* animate scroll */ pagerState
            },
        )

        // ── Section pager — each page is bounded (no vertical overflow) ───────
        HorizontalPager(
            state    = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            when (sections[page]) {
                ExploreSection.HOME           -> HomeSection()
                ExploreSection.FEATURES       -> FeaturesSection()
                ExploreSection.HOW_IT_WORKS   -> HowItWorksSection()
                ExploreSection.GET_STARTED    -> GetStartedSection()
                ExploreSection.FAQ            -> FaqSection()
            }
        }
    }
}

enum class ExploreSection(val label: String) {
    HOME("Home"),
    FEATURES("Features"),
    HOW_IT_WORKS("How It Works"),
    GET_STARTED("Get Started"),
    FAQ("FAQ"),
}

@Composable
private fun SectionTabStrip(
    sections: Array<ExploreSection>,
    currentPage: Int,
    onTabClick: (Int) -> Unit,
) {
    val clexColors = ClexColors.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(clexColors.bgSecondary)
            .border(bottom = 1.dp, color = clexColors.borderColor),
    ) {
        sections.forEachIndexed { index, section ->
            val isActive = index == currentPage
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onTabClick(index) }
                    .background(if (isActive) clexColors.bgTertiary else clexColors.bgSecondary)
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = section.label.uppercase().take(4),
                    fontFamily = ClexDisplayFont,
                    fontSize = 8.sp,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
                    color = if (isActive) clexColors.accent else clexColors.textSecondary,
                )
            }
        }
    }
}

// ── Home ─────────────────────────────────────────────────────────────────────

@Composable
private fun HomeSection() {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "CLEX",
            fontFamily = ClexDisplayFont,
            fontWeight = FontWeight.Bold,
            fontSize = 52.sp,
            color = clexColors.accent,
            letterSpacing = 8.sp,
        )
        Spacer(Modifier.height(12.dp))
        Text(
            text = "The privacy-first\nfile workspace",
            fontFamily = ClexDisplayFont,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = clexColors.textPrimary,
            textAlign = TextAlign.Center,
            lineHeight = 30.sp,
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "Transfer, transform, and save files\nwith no signups, no cloud storage, and no tracking.",
            fontFamily = ClexBodyFont,
            fontSize = 14.sp,
            color = clexColors.textSecondary,
            textAlign = TextAlign.Center,
            lineHeight = 22.sp,
        )
        Spacer(Modifier.height(40.dp))
        InfoPill("P2P · Direct · Peer-to-peer")
        Spacer(Modifier.height(8.dp))
        InfoPill("No account required")
        Spacer(Modifier.height(8.dp))
        InfoPill("Open source · Immutable ledger")
    }
}

@Composable
private fun InfoPill(text: String) {
    val clexColors = ClexColors.current
    Box(
        modifier = Modifier
            .border(1.dp, clexColors.borderColor)
            .background(clexColors.bgCard)
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text(text, fontFamily = ClexBodyFont, fontSize = 13.sp, color = clexColors.textSecondary)
    }
}

// ── Features ─────────────────────────────────────────────────────────────────

private data class Feature(val emoji: String, val name: String, val desc: String)

@Composable
private fun FeaturesSection() {
    val clexColors = ClexColors.current
    val features = listOf(
        Feature("⚡", "Direct Transfer", "P2P WebRTC · no intermediate server holds your files"),
        Feature("🛜", "Local Mode", "Same-network transfers at full LAN speed"),
        Feature("☁️", "Drive Upload", "One-tap Google Drive upload via OAuth"),
        Feature("🗜️", "Tools", "Compress, convert, merge, split PDFs & images"),
        Feature("🔒", "Privacy", "No account, no tracking, no cloud storage"),
        Feature("⛓️", "Chain", "Immutable public ledger of transfer metadata"),
        Feature("📦", "Vault", "On-device secure file storage"),
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        itemsIndexed(features, key = { idx, _ -> idx }) { _, feature ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, clexColors.borderColor)
                    .background(clexColors.bgCard)
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(feature.emoji, fontSize = 24.sp)
                Column {
                    Text(feature.name, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = clexColors.textPrimary)
                    Text(feature.desc, fontFamily = ClexBodyFont, fontSize = 11.sp, color = clexColors.textSecondary)
                }
            }
        }
    }
}

// ── How It Works (chapterized) ───────────────────────────────────────────────

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun HowItWorksSection() {
    val clexColors = ClexColors.current
    val chapters = listOf(
        "1. Pick Files" to "Open Clex, tap the workspace, add any files from your device.",
        "2. Choose Method" to "Direct (P2P over internet), Local (same network), or Drive (Google Drive upload).",
        "3. Share the Code" to "The sender gets a 6-character room code and QR. Share it with the receiver.",
        "4. Receiver Connects" to "Receiver enters the code or scans the QR on their device.",
        "5. Files Transfer" to "WebRTC data channels transfer files directly — encrypted, peer-to-peer.",
        "6. Done" to "Receiver saves files. Nothing was stored on any server.",
    )
    val pagerState = rememberPagerState(pageCount = { chapters.size })

    Column(Modifier.fillMaxSize()) {
        HorizontalPager(state = pagerState, modifier = Modifier.weight(1f)) { page ->
            val (title, body) = chapters[page]
            Column(
                modifier = Modifier.fillMaxSize().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(title, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = clexColors.accent, textAlign = TextAlign.Center)
                Spacer(Modifier.height(20.dp))
                Text(body, fontFamily = ClexBodyFont, fontSize = 15.sp, color = clexColors.textSecondary, textAlign = TextAlign.Center, lineHeight = 24.sp)
            }
        }

        // Page dots
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 20.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            chapters.indices.forEach { i ->
                Box(
                    modifier = Modifier
                        .padding(horizontal = 4.dp)
                        .size(if (i == pagerState.currentPage) 10.dp else 6.dp)
                        .background(if (i == pagerState.currentPage) clexColors.accent else clexColors.borderColor)
                )
            }
        }
    }
}

// ── Get Started ───────────────────────────────────────────────────────────────

@Composable
private fun GetStartedSection() {
    val clexColors = ClexColors.current
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Get Started", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 24.sp, color = clexColors.textPrimary)
        Spacer(Modifier.height(28.dp))
        listOf(
            "Tap Workspace in the bottom bar" to "Add your files",
            "Tap Receive" to "Enter a code from a sender",
            "Tap Chain" to "View your transfer history",
            "Tap Vault" to "Manage saved files on-device",
        ).forEach { (step, desc) ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(clexColors.accent)
                        .align(Alignment.Top)
                        .offset(y = 7.dp),
                )
                Column {
                    Text(step, fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = clexColors.textPrimary)
                    Text(desc, fontFamily = ClexBodyFont, fontSize = 12.sp, color = clexColors.textSecondary)
                }
            }
        }
    }
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

private data class FaqItem(val q: String, val a: String)

@Composable
private fun FaqSection() {
    val clexColors = ClexColors.current
    var expanded by remember { mutableStateOf<Int?>(null) }

    val faqs = listOf(
        FaqItem("Is Clex really private?", "Yes. Files are transferred peer-to-peer via WebRTC. The signaling server only coordinates the connection and never sees file content."),
        FaqItem("Do I need an account?", "No. Clex has no accounts, logins, or email requirements — ever."),
        FaqItem("What is the room code?", "A 6-character temporary identifier. It routes the WebRTC connection. It expires once the transfer ends."),
        FaqItem("What is Local mode?", "When both devices are on the same Wi-Fi, you can use Local mode. Clex skips STUN relaying and connects directly — faster speeds."),
        FaqItem("What is the Chain?", "An immutable public ledger of transfer metadata (not content). Your pseudonymous Chain ID lets you see your own history."),
        FaqItem("Does Clex work offline?", "Transfer requires a signaling connection for setup. Once the WebRTC channel is established, some transfers can survive brief network drops."),
        FaqItem("Are transfers encrypted?", "Yes. WebRTC data channels use DTLS-SRTP encryption by default."),
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        item {
            Text("FAQ", fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = clexColors.textPrimary, modifier = Modifier.padding(bottom = 12.dp))
        }
        itemsIndexed(faqs, key = { idx, _ -> idx }) { idx, faq ->
            val isOpen = expanded == idx
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, if (isOpen) clexColors.accent else clexColors.borderColor)
                    .background(if (isOpen) clexColors.accentMuted else clexColors.bgCard)
                    .clickable { expanded = if (isOpen) null else idx },
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(faq.q, fontFamily = ClexDisplayFont, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = clexColors.textPrimary, modifier = Modifier.weight(1f))
                    Text(if (isOpen) "−" else "+", color = clexColors.accent, fontSize = 18.sp, fontFamily = ClexDisplayFont)
                }
                if (isOpen) {
                    Text(
                        faq.a,
                        fontFamily = ClexBodyFont,
                        fontSize = 12.sp,
                        color = clexColors.textSecondary,
                        modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
                        lineHeight = 19.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun Modifier.border(bottom: androidx.compose.ui.unit.Dp, color: androidx.compose.ui.graphics.Color) = this
