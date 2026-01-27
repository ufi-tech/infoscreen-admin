package dk.ufitech.infoscreenkiosk.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// UFi-Tech brand colors
private val Primary = Color(0xFF1976D2)
private val OnPrimary = Color(0xFFFFFFFF)
private val PrimaryContainer = Color(0xFFBBDEFB)
private val OnPrimaryContainer = Color(0xFF0D47A1)

private val Secondary = Color(0xFF00897B)
private val OnSecondary = Color(0xFFFFFFFF)
private val SecondaryContainer = Color(0xFFB2DFDB)
private val OnSecondaryContainer = Color(0xFF004D40)

private val Surface = Color(0xFF121212)
private val OnSurface = Color(0xFFFFFFFF)
private val SurfaceVariant = Color(0xFF1E1E1E)
private val OnSurfaceVariant = Color(0xFFCCCCCC)

private val Background = Color(0xFF0A0A0A)
private val OnBackground = Color(0xFFFFFFFF)

private val Error = Color(0xFFF44336)
private val OnError = Color(0xFFFFFFFF)

private val DarkColorScheme = darkColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    secondary = Secondary,
    onSecondary = OnSecondary,
    secondaryContainer = SecondaryContainer,
    onSecondaryContainer = OnSecondaryContainer,
    surface = Surface,
    onSurface = OnSurface,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceVariant,
    background = Background,
    onBackground = OnBackground,
    error = Error,
    onError = OnError
)

@Composable
fun InfoscreenKioskTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme // Always dark for kiosk displays

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
