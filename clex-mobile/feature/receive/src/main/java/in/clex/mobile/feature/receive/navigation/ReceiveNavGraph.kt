package in.clex.mobile.feature.receive.navigation

import android.net.Uri
import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import in.clex.mobile.feature.receive.ReceiveScreen
import in.clex.mobile.navigation.ReceiveDeepLinkArgs

const val ReceiveGraphRoute = "receive"
const val ReceiveMainRoute  = "receive/main"

// Make type visible to NavHost caller
typealias ReceiveRoute = String

fun NavGraphBuilder.receiveGraph(
    navController: NavController,
    initialArgs: ReceiveDeepLinkArgs? = null,
) {
    navigation(
        startDestination = ReceiveMainRoute,
        route            = ReceiveGraphRoute,
    ) {
        composable(ReceiveMainRoute) {
            ReceiveScreen(navController = navController, initialArgs = initialArgs)
        }
    }
}
