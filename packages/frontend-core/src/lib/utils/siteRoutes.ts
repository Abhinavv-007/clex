export interface SiteRoutes {
  home: string
  features: string
  vault: string
  howItWorks: string
  gettingStarted: string
  faq: string
  workspace: string
  receive: string
  chain: string
  developers: string
  privacy: string
  terms: string
}

export const siteRoutes: SiteRoutes = Object.freeze({
  home: '/',
  features: '/features',
  vault: '/vault',
  howItWorks: '/how-it-works',
  gettingStarted: '/getting-started',
  faq: '/faq',
  workspace: '/workspace',
  receive: '/receive',
  chain: '/chain',
  developers: '/developers',
  privacy: '/privacy',
  terms: '/terms',
})
