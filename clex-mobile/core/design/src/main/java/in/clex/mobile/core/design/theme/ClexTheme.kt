package in.clex.mobile.core.design.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Clex theme entry point.
 *
 * [darkTheme] is driven by the user's explicit preference stored in DataStore.
 * Default at first launch is dark — matching web getInitial() which always returns 'dark'.
 *
 * Material color scheme is configured to use Clex tokens, not dynamic color.
 */
@Composable
fun ClexTheme(
    darkTheme: Boolean = true,  // dark by default — matches web
    content: @Composable () -> Unit,
) {
    val colors: ClexColorScheme = if (darkTheme) ClexColorsDark else ClexColorsLight

    // Wire Clex tokens into Material3 so standard Material components inherit the palette
    val materialColorScheme = if (darkTheme) {
        darkColorScheme(
            background     = colors.bgPrimary,
            surface        = colors.bgCard,
            surfaceTint    = colors.bgCard,
            primary        = colors.accent,
            onPrimary      = colors.textInverse,
            secondary      = colors.accentSecondary,
            onSecondary    = colors.textPrimary,
            onBackground   = colors.textPrimary,
            onSurface      = colors.textPrimary,
            outline        = colors.borderColor,
        )
    } else {
        lightColorScheme(
            background     = colors.bgPrimary,
            surface        = colors.bgCard,
            surfaceTint    = colors.bgCard,
            primary        = colors.accent,
            onPrimary      = colors.textInverse,
            secondary      = colors.accentSecondary,
            onSecondary    = colors.textPrimary,
            onBackground   = colors.textPrimary,
            onSurface      = colors.textPrimary,
            outline        = colors.borderColor,
        )
    }

    val typography = Typography(
        bodyLarge  = TextStyle(fontFamily = ClexBodyFont,    fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
        bodyMedium = TextStyle(fontFamily = ClexBodyFont,    fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
        bodySmall  = TextStyle(fontFamily = ClexBodyFont,    fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp),
        titleLarge  = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold,   fontSize = 22.sp, lineHeight = 28.sp),
        titleMedium = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold,   fontSize = 16.sp, lineHeight = 24.sp),
        titleSmall  = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold,   fontSize = 14.sp, lineHeight = 20.sp),
        labelLarge  = TextStyle(fontFamily = ClexBodyFont,    fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
        labelMedium = TextStyle(fontFamily = ClexBodyFont,    fontWeight = FontWeight.Medium,  fontSize = 12.sp, lineHeight = 16.sp),
        labelSmall  = TextStyle(fontFamily = ClexBodyFont,    fontWeight = FontWeight.Medium,  fontSize = 11.sp, lineHeight = 16.sp),
        headlineLarge  = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 32.sp, lineHeight = 40.sp),
        headlineMedium = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 36.sp),
        headlineSmall  = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 32.sp),
        displayLarge   = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 57.sp, lineHeight = 64.sp),
        displayMedium  = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 45.sp, lineHeight = 52.sp),
        displaySmall   = TextStyle(fontFamily = ClexDisplayFont, fontWeight = FontWeight.Bold, fontSize = 36.sp, lineHeight = 44.sp),
    )

    CompositionLocalProvider(
        LocalClexColors provides colors,
    ) {
        MaterialTheme(
            colorScheme = materialColorScheme,
            typography  = typography,
            content     = content,
        )
    }
}
