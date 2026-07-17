<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/logo.png';
	import ChatWidget from '$lib/components/chat-widget.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from '$lib/motion';
	import { getSession, isOnboardingDone, accountForcesOnboarding } from '$lib/auth';
	import SettingsOverlay from '$lib/components/settings-overlay.svelte';
	import { uiState } from '$lib/ui-state.svelte';

	let { children } = $props();

	// Cross-route fade; honour reduced-motion by collapsing the duration.
	const fadeDuration = $derived(prefersReducedMotion() ? 0 : 200);

	// Re-read the session on every navigation (localStorage isn't reactive, so
	// track the pathname to recompute after login/logout redirects).
	const session = $derived.by(() => {
		void page.url.pathname;
		return browser ? getSession() : null;
	});
	const onLogin = $derived(page.url.pathname === '/login');
	const onOnboarding = $derived(page.url.pathname === '/onboarding');
	const showApp = $derived(onLogin || onOnboarding || !!session);

	// Redirect side effects only — no state writes here.
	$effect(() => {
		if (!session && !onLogin && !onOnboarding) goto(resolve('/login'));
		else if (session && onLogin) {
			const skipOnboarding = !accountForcesOnboarding(session.email) && isOnboardingDone();
			goto(resolve(skipOnboarding ? '/' : '/onboarding'));
		}
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showApp}
	{#key page.url.pathname}
		<div in:fade={{ duration: fadeDuration }}>
			{@render children()}
		</div>
	{/key}
	{#if !onLogin && !onOnboarding}<ChatWidget />{/if}
	{#if uiState.settingsOpen && !onLogin && !onOnboarding}
		<SettingsOverlay />
	{/if}
{/if}
