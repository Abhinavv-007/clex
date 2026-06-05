package in.clex.mobile.core.design.theme

import androidx.compose.ui.graphics.Color

// ────────────────────────────────────────────────────────────────────────────
// Clex Design Tokens — synced to clex.in website (Creem-inspired pastel system)
// Light = warm cream, Dark = deep ink. Lavender/peach/lime accents.
// ────────────────────────────────────────────────────────────────────────────

object ClexColorsDark : ClexColorScheme {
    override val bgPrimary          = Color(0xFF0A0A0A)
    override val bgSecondary        = Color(0xFF14121D)   // ink with violet tinge
    override val bgTertiary         = Color(0xFF1A1822)
    override val bgCard             = Color(0xFF15131E)
    override val bgCardHover        = Color(0xFF1F1B2D)
    override val bgElevated         = Color(0xFF1A1822)
    override val bgInput            = Color(0xFF111111)

    override val textPrimary        = Color(0xFFF4EEE0)   // warm off-white
    override val textSecondary      = Color(0xFFCFC6B8)
    override val textTertiary       = Color(0xFF8A8478)
    override val textInverse        = Color(0xFF0A0A0A)

    // Pastel-on-dark accents (matches dark cursive gradient on website)
    override val accent             = Color(0xFFC4B5FD)   // lavender
    override val accentHover        = Color(0xFFD3BBFF)
    override val accentMuted        = Color(0x33C4B5FD)
    override val accentText         = Color(0xFFFFAECF)   // pink mid-stop
    override val accentSecondary    = Color(0xFFFF8A1F)   // peach/orange
    override val accentTertiary     = Color(0xFF7EDC8B)   // mint

    override val borderColor        = Color(0x33FFFFFF)
    override val borderBold         = Color(0xFFF4EEE0)
    override val borderAccent       = Color(0xFFC4B5FD)
    override val borderSubtle       = Color(0x14FFFFFF)

    override val shadowColor        = Color(0xFF000000)
    override val shadowAccent       = Color(0xFFFF8A1F)

    override val surfaceGlass       = Color(0xCC1A1822)
    override val surfaceOverlay     = Color(0x99000000)

    override val isDark             = true
}

object ClexColorsLight : ClexColorScheme {
    override val bgPrimary          = Color(0xFFF6EFDF)   // cream (matches --c-cream)
    override val bgSecondary        = Color(0xFFEFE6CF)
    override val bgTertiary         = Color(0xFFEBE2C9)
    override val bgCard             = Color(0xFFFFFFFF)
    override val bgCardHover        = Color(0xFFFFFAEB)
    override val bgElevated         = Color(0xFFFFFFFF)
    override val bgInput            = Color(0xFFFAF5E8)

    override val textPrimary        = Color(0xFF0E0E0D)   // ink
    override val textSecondary      = Color(0xFF4A4642)
    override val textTertiary       = Color(0xFF7A7670)
    override val textInverse        = Color(0xFFFAF5E8)

    // Brand accents from --c-* palette
    override val accent             = Color(0xFFC4B5FD)   // lavender
    override val accentHover        = Color(0xFFB9A8FB)
    override val accentMuted        = Color(0x38C4B5FD)
    override val accentText         = Color(0xFF5B3FC0)   // deep accent text on light
    override val accentSecondary    = Color(0xFFFF7A3D)   // peach
    override val accentTertiary     = Color(0xFFB8E9C4)   // mint

    override val borderColor        = Color(0xFFE3D9C0)
    override val borderBold         = Color(0xFF0E0E0D)
    override val borderAccent       = Color(0xFF5B3FC0)
    override val borderSubtle       = Color(0xFFEBE2C9)

    override val shadowColor        = Color(0xFF0E0E0D)
    override val shadowAccent       = Color(0xFFFF7A3D)

    override val surfaceGlass       = Color(0xC7FFFFFF)
    override val surfaceOverlay     = Color(0x99F6EFDF)

    override val isDark             = false
}

// ────────────────────────────────────────────────────────────────────────────
// Brand pastels — used for cards/sections (matches website tokens)
// ────────────────────────────────────────────────────────────────────────────
object ClexBrand {
    val cream      = Color(0xFFF6EFDF)
    val creamSoft  = Color(0xFFFAF5E8)
    val creamDeep  = Color(0xFFEFE6CF)
    val lavender   = Color(0xFFC4B5FD)
    val lavender2  = Color(0xFFB9A8FB)
    val lavender3  = Color(0xFFA08AFF)
    val peach      = Color(0xFFFFD0B3)
    val peach2     = Color(0xFFFFBF99)
    val peach3     = Color(0xFFFF9D6E)
    val mint       = Color(0xFFB8E9C4)
    val mint2      = Color(0xFF8FDBA1)
    val pink       = Color(0xFFFFD1DC)
    val yellow     = Color(0xFFFFE27A)
    val yellow2    = Color(0xFFFFD13A)
    val blue       = Color(0xFFB5DCFF)
    val ink        = Color(0xFF0E0E0D)
    val inkSoft    = Color(0xFF2A2A28)

    /** Cursive gradient (light bg). */
    val cursiveStart    = Color(0xFF8B5CF6)
    val cursiveMid1     = Color(0xFFD85F8B)
    val cursiveMid2     = Color(0xFFFF8A1F)
    val cursiveEnd      = Color(0xFFFFD46A)

    /** Cursive gradient (dark bg) — pastel pop. */
    val cursiveStartDark = Color(0xFFD3BBFF)
    val cursiveMidDark   = Color(0xFFFFB9D6)
    val cursiveEndDark   = Color(0xFFFFD198)
}

