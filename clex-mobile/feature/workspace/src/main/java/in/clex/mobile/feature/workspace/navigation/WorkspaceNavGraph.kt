package in.clex.mobile.feature.workspace.navigation

import androidx.navigation.NavController
import androidx.navigation.NavGraphBuilder
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import in.clex.mobile.feature.workspace.WorkspaceScreen

const val WorkspaceGraphRoute = "workspace"
const val WorkspaceMainRoute  = "workspace/main"

fun NavGraphBuilder.workspaceGraph(navController: NavController) {
    navigation(
        startDestination = WorkspaceMainRoute,
        route            = WorkspaceGraphRoute,
    ) {
        composable(WorkspaceMainRoute) {
            WorkspaceScreen(navController = navController)
        }
    }
}
