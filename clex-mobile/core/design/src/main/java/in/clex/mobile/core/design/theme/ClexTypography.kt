package in.clex.mobile.core.design.theme

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.text.googlefonts.GoogleFont
import in.clex.mobile.core.design.R

// ────────────────────────────────────────────────────────────────────────────
// Clex Typography
// Source: tokens.css
//   --font-display: 'Space Mono', 'Courier New', monospace
//   --font-body:    'Inter', -apple-system, …, sans-serif
//   --font-mono:    'Space Mono', 'Courier New', monospace
// ────────────────────────────────────────────────────────────────────────────

private val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage   = "com.google.android.gms",
    certificates      = R.array.com_google_android_gms_fonts_certs,
)

val SpaceMonoFont = FontFamily(
    Font(
        googleFont    = GoogleFont("Space Mono"),
        fontProvider  = provider,
        weight        = FontWeight.Normal,
        style         = FontStyle.Normal,
    ),
    Font(
        googleFont    = GoogleFont("Space Mono"),
        fontProvider  = provider,
        weight        = FontWeight.Bold,
        style         = FontStyle.Normal,
    ),
    Font(
        googleFont    = GoogleFont("Space Mono"),
        fontProvider  = provider,
        weight        = FontWeight.Normal,
        style         = FontStyle.Italic,
    ),
)

val InterFont = FontFamily(
    Font(
        googleFont    = GoogleFont("Inter"),
        fontProvider  = provider,
        weight        = FontWeight.Normal,
        style         = FontStyle.Normal,
    ),
    Font(
        googleFont    = GoogleFont("Inter"),
        fontProvider  = provider,
        weight        = FontWeight.Medium,
        style         = FontStyle.Normal,
    ),
    Font(
        googleFont    = GoogleFont("Inter"),
        fontProvider  = provider,
        weight        = FontWeight.SemiBold,
        style         = FontStyle.Normal,
    ),
    Font(
        googleFont    = GoogleFont("Inter"),
        fontProvider  = provider,
        weight        = FontWeight.Bold,
        style         = FontStyle.Normal,
    ),
    Font(
        googleFont    = GoogleFont("Inter"),
        fontProvider  = provider,
        weight        = FontWeight.ExtraBold,
        style         = FontStyle.Normal,
    ),
)

/** Display / monospace font — Space Mono. Used for headings, codes, buttons. */
val ClexDisplayFont = SpaceMonoFont

/** Body / UI font — Inter. Used for body text, labels, descriptions. */
val ClexBodyFont = InterFont

/** Monospace font — Space Mono (same as Display). Used for room codes, code blocks. */
val ClexMonoFont = SpaceMonoFont
