package in.clex.mobile.core.design.theme

import androidx.compose.ui.graphics.Color

// ────────────────────────────────────────────────────────────────────────────
// Clex Design Tokens — Dark Mode (DEFAULT)
// Source: frontend-2/css/tokens.css  [data-theme="dark"]
// These are FIXED tokens, NOT Material You dynamic color.
// ────────────────────────────────────────────────────────────────────────────
object ClexColorsDark : ClexColorScheme {
    override val bgPrimary          = Color(0xFF0A0A0A)
    override val bgSecondary        = Color(0xFF111111)
    override val bgTertiary         = Color(0xFF1A1A1A)
    override val bgCard             = Color(0xFF141414)
    override val bgCardHover        = Color(0xFF1E1E1E)
    override val bgElevated         = Color(0xFF1A1A1A)
    override val bgInput            = Color(0xFF111111)

    override val textPrimary        = Color(0xFFF0F0E8)   // warm off-white
    override val textSecondary      = Color(0xFF999999)
    override val textTertiary       = Color(0xFF666666)
    override val textInverse        = Color(0xFF0A0A0A)

    // Acid-lime accent — the Clex brand color
    override val accent             = Color(0xFFC8FF00)
    override val accentHover        = Color(0xFFD4FF33)
    override val accentMuted        = Color(0x26C8FF00)   // rgba(200,255,0,0.15)
    override val accentText         = Color(0xFFC8FF00)
    override val accentSecondary    = Color(0xFFFF3D00)
    override val accentTertiary     = Color(0xFF00D4FF)

    override val borderColor        = Color(0xFF2A2A2A)
    override val borderBold         = Color(0xFFF0F0E8)
    override val borderAccent       = Color(0xFFC8FF00)
    override val borderSubtle       = Color(0xFF1E1E1E)

    override val shadowColor        = Color(0xFF000000)
    override val shadowAccent       = Color(0xFFC8FF00)

    override val surfaceGlass       = Color(0xCC141414)   // rgba(20,20,20,0.8)
    override val surfaceOverlay     = Color(0x99000000)

    override val isDark             = true
}

// ────────────────────────────────────────────────────────────────────────────
// Clex Design Tokens — Light Mode
// Source: frontend-2/css/tokens.css  [data-theme="light"]
// ────────────────────────────────────────────────────────────────────────────
object ClexColorsLight : ClexColorScheme {
    override val bgPrimary          = Color(0xFFF5F0E8)   // cream
    override val bgSecondary        = Color(0xFFEBE5D9)
    override val bgTertiary         = Color(0xFFE0D9CC)
    override val bgCard             = Color(0xFFFFFFFF)
    override val bgCardHover        = Color(0xFFFAFAF5)
    override val bgElevated         = Color(0xFFFFFFFF)
    override val bgInput            = Color(0xFFF5F0E8)

    override val textPrimary        = Color(0xFF0A0A0A)
    override val textSecondary      = Color(0xFF555555)
    override val textTertiary       = Color(0xFF888888)
    override val textInverse        = Color(0xFFF0F0E8)

    override val accent             = Color(0xFFC8FF00)
    override val accentHover        = Color(0xFFD4FF33)
    override val accentMuted        = Color(0x26C8FF00)
    override val accentText         = Color(0xFF3B3520)   // dark text on lime in light mode
    override val accentSecondary    = Color(0xFFFF3D00)
    override val accentTertiary     = Color(0xFF0099CC)

    override val borderColor        = Color(0xFFD0C9BA)
    override val borderBold         = Color(0xFF0A0A0A)
    override val borderAccent       = Color(0xFFC8FF00)
    override val borderSubtle       = Color(0xFFE0D9CC)

    override val shadowColor        = Color(0xFF0A0A0A)
    override val shadowAccent       = Color(0xFFC8FF00)

    override val surfaceGlass       = Color(0xCCFFFFFF)
    override val surfaceOverlay     = Color(0x99F5F0E8)

    override val isDark             = false
}
