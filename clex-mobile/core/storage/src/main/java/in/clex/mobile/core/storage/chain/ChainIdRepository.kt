package in.clex.mobile.core.storage.chain

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.chainDataStore by preferencesDataStore(name = "clex_chain")

/**
 * Chain ID persistence.
 *
 * DataStore key: "clex-chain-id"
 * Format: 32 hex characters from 16 random bytes — matches web chain/instrument.ts:
 * ```ts
 * const arr = new Uint8Array(16)
 * crypto.getRandomValues(arr)
 * chainId = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('')
 * ```
 */
@Singleton
class ChainIdRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    companion object {
        private val KEY_CHAIN_ID = stringPreferencesKey("clex-chain-id")

        /**
         * Generate a new 32-hex chain ID — exact algorithm from web:
         * 16 secure random bytes → each as 2-digit hex.
         */
        fun generateChainId(): String {
            val bytes = ByteArray(16)
            java.security.SecureRandom().nextBytes(bytes)
            return bytes.joinToString("") { "%02x".format(it) }
        }
    }

    /** Flow of the persisted chain ID. Emits null if not yet initialized. */
    val chainId: Flow<String?> = context.chainDataStore.data
        .map { prefs -> prefs[KEY_CHAIN_ID] }

    /** Get or create the chain ID (equivalent to web getOrCreateChainId()). */
    suspend fun getOrCreate(): String {
        val existing = context.chainDataStore.data
            .map { prefs -> prefs[KEY_CHAIN_ID] }
            .let {
                // Synchronous read not idiomatic in DataStore — generate and persist on first call
                var id: String? = null
                kotlinx.coroutines.runBlocking {
                    it.collect { value ->
                        id = value
                        return@collect
                    }
                }
                id
            }

        return existing ?: run {
            val newId = generateChainId()
            context.chainDataStore.edit { prefs ->
                prefs[KEY_CHAIN_ID] = newId
            }
            newId
        }
    }

    suspend fun persist(chainId: String) {
        context.chainDataStore.edit { prefs ->
            prefs[KEY_CHAIN_ID] = chainId
        }
    }
}
