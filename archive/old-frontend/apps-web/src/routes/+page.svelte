<script lang="ts">
  import Hero        from '$components/landing/Hero.svelte'
  import StatsBanner from '$components/landing/StatsBanner.svelte'
  import Features    from '$components/landing/Features.svelte'
  import HowItWorks  from '$components/landing/HowItWorks.svelte'
  import Methods     from '$components/landing/Methods.svelte'
  import CTASection  from '$components/landing/CTASection.svelte'
  import Footer      from '$components/landing/Footer.svelte'
</script>

<svelte:head>
  <title>Clex — Drop. Prepare. Share.</title>
  <meta name="description" content="One browser workspace for preparing files and sending them anywhere. Direct P2P, local network, or Google Drive. No account, no uploads, no friction." />
  <meta property="og:title" content="Clex — Drop. Prepare. Share." />
  <meta property="og:description" content="Prepare files and share them from one browser tab. Direct WebRTC transfer, local network routing, Google Drive fallback." />
</svelte:head>

<Hero />
<StatsBanner />
<HowItWorks />
<Features />
<Methods />
<CTASection />
<Footer />
