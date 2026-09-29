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

/** Reads ?mode=vault so a link can open the workspace on Vault. */
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
 * The name matters: this once read PUBLIC_SIGNAL_URL, which is defined in no
 * env file and in no doc. The documented variable has always been
 * PUBLIC_SIGNALING_URL. Going through getSignalingBaseUrl() also gives the
 * local-hostname rewriting the other call sites get, which is what lets a
 * phone on the LAN reach the dev signaling server instead of its own localhost.
 */
async function resolveSignalingUrl() {
  const { getSignalingBaseUrl } = await import('@clex/frontend-core/transfer/signaling');
  return getSignalingBaseUrl(import.meta.env.PUBLIC_SIGNALING_URL);
}

/** @param {string} page */
export async function initIslands(page) {
  // The landing page IS the workspace. /workspace and /vault redirect here;
  // Vault is a mode of the same app, opened with ?mode=vault or from any
  // link marked data-open-vault.
  if (page === 'home') {
    const target = document.getElementById('workspace-app-island');
    const { default: WorkspaceApp } = await import('@clex/frontend-core/apps/WorkspaceApp');
    mount(WorkspaceApp, target, {
      receiveBasePath: routes.receive,
      receivePathFormat: 'query',
      chainApiUrl: import.meta.env.PUBLIC_CHAIN_URL ?? '',
      vaultSignalingUrl: await resolveSignalingUrl(),
      vaultApiUrl: '/vault/api',
      initialMode: workspaceModeFromUrl(),
      embedded: true,
    });
    target?.closest('.workspace')?.classList.add('is-mounted');
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
    mount(AccountApp, document.getElementById('account-app-island'), {
      vaultApiUrl: '/vault/api',
      nextUrl: params.get('next') || '',
    });
  }
}
