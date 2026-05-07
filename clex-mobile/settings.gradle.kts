pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "clex-mobile"

// ── Core modules ──────────────────────────────────────────────────────────────
include(":core:design")
include(":core:model")
include(":core:network")
include(":core:storage")
include(":core:transfer")

// ── Feature modules ───────────────────────────────────────────────────────────
include(":feature:workspace")
include(":feature:receive")
include(":feature:vault")
include(":feature:chain")
include(":feature:explore")
include(":feature:legal")
include(":feature:tool-runtime")

// ── App ───────────────────────────────────────────────────────────────────────
include(":app")
