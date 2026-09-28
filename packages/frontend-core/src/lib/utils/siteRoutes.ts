export interface SiteRoutes {
  home: string
  features: string
  vault: string
  howItWorks: string
  gettingStarted: string
  faq: string
  workspace: string
  receive: string
  share: string
  chain: string
  developers: string
  account: string
  privacy: string
  terms: string
}

export const siteRoutes: SiteRoutes = Object.freeze({
  home: '/',
  features: '/features',
  vault: '/?mode=vault#workspace',
  howItWorks: '/how-it-works',
  gettingStarted: '/getting-started',
  faq: '/faq',
  // The workspace is the landing page; Vault is a mode of it.
  workspace: '/#workspace',
  receive: '/receive',
  share: '/share',
  chain: '/chain',
  developers: '/developers',
  account: '/account',
  privacy: '/privacy',
  terms: '/terms',
})
