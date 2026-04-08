package in.clex.mobile.navigation

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import in.clex.mobile.core.model.RoomCode
import in.clex.mobile.core.model.TransferMethod
import in.clex.mobile.feature.chain.navigation.chainGraph
import in.clex.mobile.feature.explore.navigation.exploreGraph
import in.clex.mobile.feature.receive.navigation.ReceiveRoute
import in.clex.mobile.feature.receive.navigation.receiveGraph
import in.clex.mobile.feature.vault.navigation.vaultGraph
import in.clex.mobile.feature.workspace.navigation.workspaceGraph
import in.clex.mobile.navigation.components.ClexBottomBar

/**
 * Root NavHost for Clex.
 *
 * Five bottom-tab destinations, each backed by its own nested NavGraph so the
 * back-stack of each tab is preserved independently.
 */
@Composable
fun ClexNavHost(
    initialIntent: Intent? = null,
) {
    val navController = rememberNavController()

    // Parse deep link from the launch intent and pass into receive graph
    val initialReceiveArgs = remember(initialIntent) {
        initialIntent?.data?.let { parseReceiveDeepLink(it) }
    }

    Scaffold(
        bottomBar = {
            ClexBottomBar(navController = navController)
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = TopDest.Workspace.route,
            modifier = Modifier.padding(innerPadding),
            enterTransition = {
                slideIntoContainer(
                    AnimatedContentTransitionScope.SlideDirection.Start,
                    tween(220)
                )
            },
            exitTransition = {
                slideOutOfContainer(
                    AnimatedContentTransitionScope.SlideDirection.Start,
                    tween(220)
                )
            },
            popEnterTransition = {
                slideIntoContainer(
                    AnimatedContentTransitionScope.SlideDirection.End,
                    tween(220)
                )
            },
            popExitTransition = {
                slideOutOfContainer(
                    AnimatedContentTransitionScope.SlideDirection.End,
                    tween(220)
                )
            },
        ) {
            workspaceGraph(navController)
            receiveGraph(navController, initialArgs = initialReceiveArgs)
            vaultGraph(navController)
            chainGraph(navController)
            exploreGraph(navController)
        }
    }
}

/** Parse a receive deep link into (RoomCode, TransferMethod). Accepts both URL styles. */
fun parseReceiveDeepLink(uri: Uri): ReceiveDeepLinkArgs? {
    if (uri.host != "clex.in") return null

    val codeParam = uri.getQueryParameter("code")
    val modeParam = uri.getQueryParameter("mode")

    // Query style: /receive?code=ABC123&mode=webrtc
    val code = when {
        !codeParam.isNullOrBlank() -> codeParam.trim().uppercase()
        // Segment style: /receive/ABC123
        uri.pathSegments.size >= 2 && uri.pathSegments[0] == "receive" ->
            uri.pathSegments[1].trim().uppercase()
        else -> null
    } ?: return null

    val roomCode = RoomCode(code)
    if (!roomCode.isValid()) return null

    val method = when (modeParam) {
        "local" -> TransferMethod.LOCAL
        "webrtc", null -> TransferMethod.WEBRTC
        else -> TransferMethod.WEBRTC
    }

    return ReceiveDeepLinkArgs(roomCode, method)
}

data class ReceiveDeepLinkArgs(
    val code: RoomCode,
    val method: TransferMethod,
)

/** Top-level route tokens for each bottom nav destination. */
sealed class TopDest(val route: String) {
    object Workspace : TopDest("workspace")
    object Receive   : TopDest("receive")
    object Vault     : TopDest("vault")
    object Chain     : TopDest("chain")
    object Explore   : TopDest("explore")
}
