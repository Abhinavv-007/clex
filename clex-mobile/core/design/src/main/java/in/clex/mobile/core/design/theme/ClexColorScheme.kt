package in.clex.mobile.core.design.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Contract for the Clex brand color scheme — implemented by Dark and Light objects. */
interface ClexColorScheme {
    val bgPrimary: Color
    val bgSecondary: Color
    val bgTertiary: Color
    val bgCard: Color
    val bgCardHover: Color
    val bgElevated: Color
    val bgInput: Color

    val textPrimary: Color
    val textSecondary: Color
    val textTertiary: Color
    val textInverse: Color

    val accent: Color
    val accentHover: Color
    val accentMuted: Color
    val accentText: Color
    val accentSecondary: Color
    val accentTertiary: Color

    val borderColor: Color
    val borderBold: Color
    val borderAccent: Color
    val borderSubtle: Color

    val shadowColor: Color
    val shadowAccent: Color

    val surfaceGlass: Color
    val surfaceOverlay: Color

    val isDark: Boolean
}

/** CompositionLocal that provides the active color scheme throughout the tree. */
val LocalClexColors = staticCompositionLocalOf<ClexColorScheme> { ClexColorsDark }

/** Convenient accessor matching Compose's MaterialTheme.colorScheme pattern. */
object ClexColors {
    val current: ClexColorScheme
        @androidx.compose.runtime.Composable
        @androidx.compose.runtime.ReadOnlyComposable
        get() = LocalClexColors.current
}
