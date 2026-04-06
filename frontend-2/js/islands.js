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

export async function initIslands() {
  const page = document.body.getAttribute('data-page') || '';

  if (page === 'home') {
    const [
      { HeroWorkspaceMock, RoutingEngineMock, ChainFlowMock },
      { default: DropZoneWindowIsland },
      { default: ToolChainWindowIsland },
      { default: RouteSelectionWindowIsland },
    ] = await Promise.all([
      import('@clex/frontend-core'),
      import('../islands/DropZoneWindowIsland.svelte'),
      import('../islands/ToolChainWindowIsland.svelte'),
      import('../islands/RouteSelectionWindowIsland.svelte'),
    ]);

    mount(HeroWorkspaceMock, document.getElementById('hero-workspace-island'));
    mount(RoutingEngineMock, document.getElementById('routing-engine-island'));
    mount(DropZoneWindowIsland, document.getElementById('home-drop-island'));
    mount(ToolChainWindowIsland, document.getElementById('home-tools-island'));
    mount(RouteSelectionWindowIsland, document.getElementById('home-route-island'));
    mount(ChainFlowMock, document.getElementById('home-chain-flow-island'));
    return;
  }

  if (page === 'features') {
    const [{ ChainFlowMock }] = await Promise.all([import('@clex/frontend-core')]);
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
    const [{ WorkspaceApp }] = await Promise.all([import('@clex/frontend-core')]);
    mount(WorkspaceApp, document.getElementById('workspace-app-island'), {
      receiveBasePath: routes.receive,
      receivePathFormat: 'query',
      receiveEntryHref: routes.receive,
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
    });
    return;
  }

  if (page === 'receive') {
    const [{ ReceiveApp }] = await Promise.all([import('@clex/frontend-core')]);
    mount(ReceiveApp, document.getElementById('receive-app-island'), {
      homeHref: routes.home,
      backHref: routes.workspace,
    });
    return;
  }

  if (page === 'chain') {
    const [{ ChainExplorerApp }] = await Promise.all([import('@clex/frontend-core')]);
    mount(ChainExplorerApp, document.getElementById('chain-explorer-island'), {
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
    });
    return;
  }
}
