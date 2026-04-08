package in.clex.mobile.core.storage.theme

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import in.clex.mobile.core.storage.ClexPrefs
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "clex_prefs")

/**
 * Theme preference repository.
 *
 * Key: "clex-theme-dark" (boolean)
 * Default: true (dark) — matches web getInitial() which always defaults to dark.
 *
 * The web persists as a string ("dark" | "light") in localStorage under "clex-theme".
 * Android persists as a boolean in DataStore for type safety.
 */
@Singleton
class ThemeRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val KEY_IS_DARK = booleanPreferencesKey("clex-theme-dark")
    }

    val isDark: Flow<Boolean> = context.dataStore.data
        .map { prefs -> prefs[KEY_IS_DARK] ?: true }   // default: dark

    suspend fun setDark(dark: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[KEY_IS_DARK] = dark
        }
    }
}
