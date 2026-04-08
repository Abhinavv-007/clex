package in.clex.mobile.navigation.components

import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.vectorResource
import androidx.navigation.NavController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import in.clex.mobile.core.design.theme.ClexColors
import in.clex.mobile.navigation.TopDest

private data class BottomNavItem(
    val dest: TopDest,
    val label: String,
    val iconRes: Int,
)

@Composable
fun ClexBottomBar(navController: NavController) {
    val items = listOf(
        BottomNavItem(TopDest.Workspace, "Workspace", in.clex.mobile.R.drawable.ic_workspace),
        BottomNavItem(TopDest.Receive,   "Receive",   in.clex.mobile.R.drawable.ic_receive),
        BottomNavItem(TopDest.Vault,     "Vault",     in.clex.mobile.R.drawable.ic_vault),
        BottomNavItem(TopDest.Chain,     "Chain",     in.clex.mobile.R.drawable.ic_chain),
        BottomNavItem(TopDest.Explore,   "Explore",   in.clex.mobile.R.drawable.ic_explore),
    )

    val navBackStack by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStack?.destination?.parent?.route
        ?: navBackStack?.destination?.route

    NavigationBar(
        containerColor = ClexColors.current.bgSecondary,
    ) {
        items.forEach { item ->
            val selected = currentRoute?.startsWith(item.dest.route) == true
            NavigationBarItem(
                selected = selected,
                onClick = {
                    navController.navigate(item.dest.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = {
                    Icon(
                        imageVector = ImageVector.vectorResource(item.iconRes),
                        contentDescription = item.label,
                    )
                },
                label = { Text(item.label) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor    = ClexColors.current.accent,
                    selectedTextColor    = ClexColors.current.accent,
                    indicatorColor      = ClexColors.current.accentMuted,
                    unselectedIconColor = ClexColors.current.textSecondary,
                    unselectedTextColor = ClexColors.current.textSecondary,
                )
            )
        }
    }
}
