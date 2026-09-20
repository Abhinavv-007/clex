import { routes } from './routes.js';

/**
 * @param {import('svelte').ComponentType} Component
 * @param {HTMLElement | null} target
 * @param {Record<string, unknown>} [props]
 */
function mount(Component, target, props = {}) {
  if (!target) return null;
  return new Component({ target, props });
}

/** Reads ?mode=vault so a deep link opens the workspace on the vault. */
function workspaceModeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('mode') === 'vault'
      ? 'vault'
      : 'transfer';
  } catch {
    return 'transfer';
  }
}

/**
 * Vault mounts inside WorkspaceApp, which takes its signaling URL as a prop —
 * so unlike the Svelte transfer components it can't call getSignalingBaseUrl()
 * for itself. Resolving it here keeps one variable name and one normalisation
 * path across every entry point.
 *
 * The name matters: this read PUBLIC_SIGNAL_URL, which is defined in no env
 * file and in no doc. The documented variable has always been
 * PUBLIC_SIGNALING_URL, so setting it did nothing and Vault sync silently used
 * the hardcoded production host — right in production, unusable anywhere else.
 * Going through getSignalingBaseUrl() also restores the local-hostname
 * rewriting the other call sites get, which is what lets a phone on the LAN
 * reach the dev signaling server instead of its own localhost.
 */
async function resolveSignalingUrl() {
  const { getSignalingBaseUrl } = await import('@clex/frontend-core/transfer/signaling');
  return getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL);
}

export async function initIslands() {
  const page = document.body.getAttribute('data-page') || '';

  // The landing page IS the workspace. The real app mounts first and on its
  // own, so a visitor can drop a file immediately; the illustrative mocks for
  // the marketing sections below load afterwards and never block it.
  if (page === 'home') {
    const workspaceTarget = document.getElementById('workspace-app-island');
    const [core, mocks] = await Promise.all([
      import('@clex/frontend-core/apps/WorkspaceApp'),
      import('@clex/frontend-core/components/mocks'),
    ]);

    mount(core.default, workspaceTarget, {
      receiveBasePath: routes.receive,
      receivePathFormat: 'query',
      receiveEntryHref: routes.receive,
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
      vaultSignalingUrl: await resolveSignalingUrl(),
      vaultApiUrl: '/vault/api',
      initialMode: workspaceModeFromUrl(),
    });

    const [
      { default: DropZoneWindowIsland },
      { default: ToolChainWindowIsland },
      { default: RouteSelectionWindowIsland },
    ] = await Promise.all([
      import('../islands/DropZoneWindowIsland.svelte'),
      import('../islands/ToolChainWindowIsland.svelte'),
      import('../islands/RouteSelectionWindowIsland.svelte'),
    ]);

    mount(DropZoneWindowIsland, document.getElementById('home-drop-island'));
    mount(ToolChainWindowIsland, document.getElementById('home-tools-island'));
    mount(RouteSelectionWindowIsland, document.getElementById('home-route-island'));
    mount(mocks.ChainFlowMock, document.getElementById('home-chain-flow-island'));
    return;
  }

  if (page === 'features') {
    const { ChainFlowMock } = await import('@clex/frontend-core/components/mocks');
    mount(ChainFlowMock, document.getElementById('chain-flow-island'));
    return;
  }

  if (page === 'how-it-works') {
    const [
      { default: DropZoneWindowIsland },
      { default: ToolChainWindowIsland },
      { default: RouteSelectionWindowIsland },
    ] = await Promise.all([
      import('../islands/DropZoneWindowIsland.svelte'),
      import('../islands/ToolChainWindowIsland.svelte'),
      import('../islands/RouteSelectionWindowIsland.svelte'),
    ]);

    mount(DropZoneWindowIsland, document.getElementById('hiw-drop-island'));
    mount(ToolChainWindowIsland, document.getElementById('hiw-tools-island'));
    mount(RouteSelectionWindowIsland, document.getElementById('hiw-route-island'));
    return;
  }

  if (page === 'workspace') {
    const { default: WorkspaceApp } = await import('@clex/frontend-core/apps/WorkspaceApp');
    mount(WorkspaceApp, document.getElementById('workspace-app-island'), {
      receiveBasePath: routes.receive,
      receivePathFormat: 'query',
      receiveEntryHref: routes.receive,
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
      vaultSignalingUrl: await resolveSignalingUrl(),
      vaultApiUrl: '/vault/api',
      initialMode: workspaceModeFromUrl(),
    });
    return;
  }

  if (page === 'receive') {
    const { default: ReceiveApp } = await import('@clex/frontend-core/apps/ReceiveApp');
    mount(ReceiveApp, document.getElementById('receive-app-island'), {
      homeHref: routes.home,
      backHref: routes.workspace,
    });
    return;
  }

  if (page === 'chain') {
    const { default: ChainExplorerApp } = await import('@clex/frontend-core/apps/ChainExplorerApp');
    mount(ChainExplorerApp, document.getElementById('chain-explorer-island'), {
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
    });
    return;
  }

  // /vault is retained as a redirect: Vault is a mode of the workspace now,
  // and existing links and bookmarks have to keep working.
  if (page === 'vault') {
    const { default: WorkspaceApp } = await import('@clex/frontend-core/apps/WorkspaceApp');
    mount(WorkspaceApp, document.getElementById('vault-app-island'), {
      receiveBasePath: routes.receive,
      receivePathFormat: 'query',
      receiveEntryHref: routes.receive,
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
      vaultSignalingUrl: await resolveSignalingUrl(),
      vaultApiUrl: '/vault/api',
      initialMode: 'vault',
    });
    return;
  }

  if (page === 'vault-secret') {
    const { default: VaultSecretApp } = await import('@clex/frontend-core/apps/VaultSecretApp');
    mount(VaultSecretApp, document.getElementById('vault-secret-app-island'), {
      vaultApiUrl: '/vault/api',
    });
    return;
  }

  if (page === 'account') {
    const { default: AccountApp } = await import('@clex/frontend-core/apps/AccountApp');
    const params = new URLSearchParams(window.location.search);
    const nextUrl = params.get('next') || '';
    mount(AccountApp, document.getElementById('account-app-island'), {
      vaultApiUrl: '/vault/api',
      nextUrl,
    });
    return;
  }
}
