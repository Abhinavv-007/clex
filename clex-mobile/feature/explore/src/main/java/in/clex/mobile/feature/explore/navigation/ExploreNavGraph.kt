package in.clex.mobile.feature.explore.navigation

import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import in.clex.mobile.feature.explore.ExploreScreen

const val ExploreGraphRoute = "explore"
const val ExploreMainRoute  = "explore/main"

fun NavGraphBuilder.exploreGraph(navController: NavController) {
    navigation(startDestination = ExploreMainRoute, route = ExploreGraphRoute) {
        composable(ExploreMainRoute) { ExploreScreen(navController = navController) }
    }
}
