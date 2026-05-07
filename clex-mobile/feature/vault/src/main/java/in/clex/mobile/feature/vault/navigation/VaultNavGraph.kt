package in.clex.mobile.feature.vault.navigation

import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import in.clex.mobile.feature.vault.VaultScreen

const val VaultGraphRoute = "vault"
const val VaultMainRoute  = "vault/main"

fun NavGraphBuilder.vaultGraph(navController: NavController) {
    navigation(startDestination = VaultMainRoute, route = VaultGraphRoute) {
        composable(VaultMainRoute) { VaultScreen(navController = navController) }
    }
}
