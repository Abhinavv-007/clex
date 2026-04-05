<script lang="ts">
  import Hero from '$components/landing/Hero.svelte'
  import Features from '$components/landing/Features.svelte'
  import HowItWorks from '$components/landing/HowItWorks.svelte'
  import Methods from '$components/landing/Methods.svelte'
  import Footer from '$components/landing/Footer.svelte'
</script>

<svelte:head>
  <title>Clex — Motion-Grade File Workspace</title>
  <meta name="description" content="A premium browser-native workspace for file preparation and sharing. Direct P2P, local routing, and Drive fallback in one polished flow." />
</svelte:head>

<Hero />
<Features />
<HowItWorks />
<Methods />
<Footer />
