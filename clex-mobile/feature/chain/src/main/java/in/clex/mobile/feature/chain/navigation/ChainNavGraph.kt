package in.clex.mobile.feature.chain.navigation

import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import in.clex.mobile.feature.chain.ChainScreen

const val ChainGraphRoute = "chain"
const val ChainMainRoute  = "chain/main"

fun NavGraphBuilder.chainGraph(navController: NavController) {
    navigation(startDestination = ChainMainRoute, route = ChainGraphRoute) {
        composable(ChainMainRoute) { ChainScreen(navController = navController) }
    }
}
