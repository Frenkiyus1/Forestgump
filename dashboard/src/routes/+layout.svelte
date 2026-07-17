<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/logo.png';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from '$lib/motion';

	let { children } = $props();

	// Cross-route fade; honour reduced-motion by collapsing the duration.
	const fadeDuration = $derived(prefersReducedMotion() ? 0 : 200);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#key page.url.pathname}
	<div in:fade={{ duration: fadeDuration }}>
		{@render children()}
	</div>
{/key}
