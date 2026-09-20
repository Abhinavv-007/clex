export * from './components'
export * from './apps'
export * from './stores'
// Only the light metadata is re-exported. The tool implementations pull in
// pdf-lib, jszip, mammoth, jspdf and html2canvas — roughly 1.4 MB — and a
// `export *` here put all of it in the entry chunk for every page, including
// visitors who never open a tool. ToolChain.svelte imports each
// implementation dynamically at the moment it is used; import from
// `$tools/<name>` directly if you need one elsewhere.
export { TOOLS, getSuggestions } from './tools/chain'
export type { ToolMeta } from './tools/chain'
export * from './transfer'
export * from './utils'
export * from './account'

// NOTE: `./theme` is deliberately gone. It was a second, competing theme
// store: it read a different localStorage key ('clex-theme' rather than the
// site's 'clex-theme-v2'), its getInitial() ended in
// `matches ? 'dark' : 'dark'` so it always chose dark, and it called
// applyTheme() at module scope — so simply importing this barrel put
// `class="dark"` on <html> regardless of the visitor's actual theme. Theming
// is owned by apps/web/js/theme.js and the inline bootstrap in each page's
// <head>, both of which drive `data-theme`.

// Firebase auth
export {
  getGoogleIdToken,
  onVaultAuthChanged,
  signInWithGoogle,
  signOutGoogle,
  type VaultUser,
} from './vault/auth'

// Chain ledger
export { ChainClient, hashBlob, fileCategory } from './chain/client'
export type { ChainFile, ExplorerSession, ChainEntry, ChainStats, SessionDetail } from './chain/client'
export { initChainInstrumentation, createChainClient } from './chain/instrument'
