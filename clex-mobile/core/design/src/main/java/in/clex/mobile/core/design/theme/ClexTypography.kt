package in.clex.mobile.core.design.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.text.googlefonts.GoogleFont
import in.clex.mobile.core.design.R

// ────────────────────────────────────────────────────────────────────────────
// Clex Typography — synced to clex.in website (Geist + Pacifico cursive)
// Mirrors:
//   --font-display: 'Geist', 'Hanken Grotesk', system-ui, sans-serif
//   --font-italic:  'Pacifico', 'Caveat Brush', cursive
//   --font-mono:    'JetBrains Mono', monospace
// ────────────────────────────────────────────────────────────────────────────

private val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage   = "com.google.android.gms",
    certificates      = R.array.com_google_android_gms_fonts_certs,
)

val GeistFont = FontFamily(
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.Light),
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.Normal),
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.Medium),
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.SemiBold),
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.Bold),
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.ExtraBold),
    Font(googleFont = GoogleFont("Geist"), fontProvider = provider, weight = FontWeight.Black),
)

val PacificoFont = FontFamily(
    Font(googleFont = GoogleFont("Pacifico"), fontProvider = provider, weight = FontWeight.Normal),
)

val JetBrainsMonoFont = FontFamily(
    Font(googleFont = GoogleFont("JetBrains Mono"), fontProvider = provider, weight = FontWeight.Normal),
    Font(googleFont = GoogleFont("JetBrains Mono"), fontProvider = provider, weight = FontWeight.Medium),
    Font(googleFont = GoogleFont("JetBrains Mono"), fontProvider = provider, weight = FontWeight.Bold),
)

/** Display heading font — Geist. Used for h1/h2/h3, big titles. */
val ClexDisplayFont = GeistFont

/** Body / UI font — Geist (single family for consistency). */
val ClexBodyFont = GeistFont

/** Cursive accent font — Pacifico. Used for italic accent words ("stay private"). */
val ClexCursiveFont = PacificoFont

/** Monospace font — JetBrains Mono. Used for room codes, code blocks, API keys. */
val ClexMonoFont = JetBrainsMonoFont

