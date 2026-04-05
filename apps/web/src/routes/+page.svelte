<script lang="ts">
  import Hero from '$components/landing/Hero.svelte'
  import Features from '$components/landing/Features.svelte'
  import HowItWorks from '$components/landing/HowItWorks.svelte'
  import Methods from '$components/landing/Methods.svelte'
  import Footer from '$components/landing/Footer.svelte'
</script>

<svelte:head>
  <title>Clex — Smart File Workspace</title>
  <meta name="description" content="Prepare and share files the smart way. P2P transfer, local network sharing, and Google Drive — all in one premium workspace." />
</svelte:head>

<Hero />
<Features />
<HowItWorks />
<Methods />
<Footer />
