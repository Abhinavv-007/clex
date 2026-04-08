package in.clex.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import dagger.hilt.android.AndroidEntryPoint
import in.clex.mobile.core.design.theme.ClexTheme
import in.clex.mobile.core.storage.theme.ThemeViewModel
import in.clex.mobile.navigation.ClexNavHost

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val themeVm: ThemeViewModel = hiltViewModel()
            val isDark by themeVm.isDark.collectAsState()
            ClexTheme(darkTheme = isDark) {
                ClexNavHost(initialIntent = intent)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Forward new intents (deep links, share targets) to the nav host via intent
        setIntent(intent)
    }
}
