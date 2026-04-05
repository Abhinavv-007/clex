export interface SiteRoutes {
  home: string
  features: string
  howItWorks: string
  gettingStarted: string
  faq: string
  workspace: string
  receive: string
  privacy: string
  terms: string
}

export const siteRoutes: SiteRoutes = Object.freeze({
  home: '/',
  features: '/features',
  howItWorks: '/how-it-works',
  gettingStarted: '/getting-started',
  faq: '/faq',
  workspace: '/workspace',
  receive: '/receive',
  privacy: '/privacy',
  terms: '/terms',
})
