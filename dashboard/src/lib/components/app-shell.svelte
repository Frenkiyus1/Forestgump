<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { clearSession } from '$lib/auth';
	import logo from '$lib/assets/logo.png';
	import { t } from '$lib/i18n.svelte';
	import { uiState } from '$lib/ui-state.svelte';

	let { children }: { children: Snippet } = $props();

	const path = $derived(page.url.pathname);
	let mobileOpen = $state(false);

	// fade the sticky search pill as the page scrolls so it doesn't clash
	// with content underneath; clear at the very top, faint once scrolled.
	let scrollY = $state(0);
	$effect(() => {
		const onScroll = () => (scrollY = window.scrollY);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
	const searchOpacity = $derived(Math.max(0.1, 1 - scrollY / 90));

	type NavIcon = 'overview' | 'stations' | 'map' | 'alerts' | 'reports';
	type NavHref = '/' | '/stations' | '/map' | '/alerts' | '/reports';
	type NavItem = {
		label: string;
		href?: NavHref;
		icon: NavIcon;
		active?: boolean;
		muted?: boolean;
	};

	const nav = $derived<NavItem[]>([
		{ label: t('nav.overview'), href: '/', icon: 'overview', active: path === '/' },
		{
			label: t('nav.stations'),
			href: '/stations',
			icon: 'stations',
			active: path.startsWith('/stations')
		},
		{ label: t('nav.map'), href: '/map', icon: 'map', active: path.startsWith('/map') },
		{ label: t('nav.alerts'), href: '/alerts', icon: 'alerts', active: path.startsWith('/alerts') },
		{
			label: t('nav.reports'),
			href: '/reports',
			icon: 'reports',
			active: path.startsWith('/reports')
		}
	]);

	const linkBase = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition';
	const linkIdle = 'text-gray-500 hover:bg-cream/70 hover:text-gray-900';
	const linkActive = 'bg-accent/10 font-medium text-accent';
	const linkMuted = 'cursor-default text-gray-300 select-none';

	function logout() {
		clearSession();
		goto(resolve('/login'));
	}
</script>

{#snippet icon(name: NavIcon)}
	<svg
		viewBox="0 0 24 24"
		class="h-[18px] w-[18px] shrink-0"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if name === 'overview'}
			<path d="M3 12 12 3l9 9" /><path d="M5 10v10h14V10" />
		{:else if name === 'stations'}
			<path d="M5 22L12 9l7 13" stroke-linecap="round" stroke-linejoin="round" /><line
				x1="8"
				y1="17"
				x2="16"
				y2="17"
				stroke-linecap="round"
			/><path d="M10 6.5a3 3 0 0 1 4 0" stroke-linecap="round" /><path
				d="M8 4a6 6 0 0 1 8 0"
				stroke-linecap="round"
			/><circle cx="12" cy="9" r="1.2" fill="currentColor" stroke="none" />
		{:else if name === 'map'}
			<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" /><path d="M9 3v15M15 6v15" />
		{:else if name === 'alerts'}
			<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
		{:else if name === 'reports'}
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path
				d="M14 2v6h6M8 13h8M8 17h8M8 9h2"
			/>
		{/if}
	</svg>
{/snippet}

<div class="relative min-h-screen bg-cream font-[Inter] text-gray-900">
	<!-- shared ambient background -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div
			class="absolute -top-32 -right-24 h-[34rem] w-[34rem] rounded-full opacity-60 blur-3xl"
			style="background: radial-gradient(circle, #fde9c8 0%, transparent 70%);"
		></div>
		<div
			class="absolute top-1/3 -left-40 h-[30rem] w-[30rem] rounded-full opacity-50 blur-3xl"
			style="background: radial-gradient(circle, #d9efe9 0%, transparent 70%);"
		></div>
	</div>

	<!-- mobile backdrop -->
	{#if mobileOpen}
		<button
			type="button"
			aria-label="Close menu"
			class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
			onclick={() => (mobileOpen = false)}
		></button>
	{/if}

	<!-- sidebar -->
	<aside
		class={clsx(
			'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-black/[0.04] bg-white/80 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0',
			mobileOpen ? 'translate-x-0' : '-translate-x-full'
		)}
	>
		<div class="flex items-center gap-2 px-6 py-5">
			<img
				src={logo}
				alt="SaliGuard"
				class="h-[53px] w-[53px] shrink-0 rounded-full object-cover"
			/>
			<span class="text-[18px] font-semibold tracking-tight">SaliGuard</span>
		</div>

		<nav class="flex-1 px-4 py-2" aria-label="Primary">
			<p class="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
				Menu
			</p>
			<ul class="flex flex-col gap-1">
				{#each nav as item (item.label)}
					<li>
						{#if item.muted}
							<span class={clsx(linkBase, linkMuted)}>
								{@render icon(item.icon)}
								{item.label}
							</span>
						{:else}
							<a
								href={resolve(item.href ?? '/')}
								data-sveltekit-preload-data
								class={clsx(linkBase, item.active ? linkActive : linkIdle)}
								aria-current={item.active ? 'page' : undefined}
								onclick={() => (mobileOpen = false)}
							>
								{@render icon(item.icon)}
								{item.label}
							</a>
						{/if}
					</li>
				{/each}
			</ul>
		</nav>

		<!-- account footer -->
		<div class="border-t border-black/[0.04] p-4">
			<div class="flex items-center gap-3">
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
					>AT</span
				>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">Admin</p>
					<p class="truncate text-xs text-gray-400">admin@saliguard.vn</p>
				</div>
				<button
					type="button"
					onclick={() => {
						uiState.settingsOpen = true;
						mobileOpen = false;
					}}
					aria-label={t('nav.settings')}
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-cream/70 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-accent"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path
							d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle cx="12" cy="12" r="3" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
				<button
					type="button"
					onclick={logout}
					aria-label={t('nav.logout')}
					class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 transition hover:bg-cream/70 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-accent"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path
							d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</button>
			</div>
		</div>
	</aside>

	<!-- content column -->
	<div class="lg:pl-64">
		<!-- slim top bar -->
		<header
			class="sticky top-0 z-30 border-b border-black/[0.04] bg-white/70 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none"
		>
			<div class="flex items-center gap-3 px-6 py-3.5">
				<button
					type="button"
					aria-label="Open menu"
					class="grid h-9 w-9 place-items-center rounded-lg text-gray-500 transition hover:bg-cream/70 lg:hidden"
					onclick={() => (mobileOpen = true)}
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round" />
					</svg>
				</button>
				<div
					style="--so: {searchOpacity}"
					class="flex items-center gap-2 rounded-full border border-gray-200/70 bg-white/70 px-3.5 py-1.5 opacity-[var(--so)] backdrop-blur-sm transition-opacity duration-200 hover:opacity-100"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4 text-gray-400"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" stroke-linecap="round" />
					</svg>
					<span class="text-sm text-gray-400">Search stations…</span>
				</div>
			</div>
		</header>

		<main class="relative z-10 mx-auto max-w-6xl px-6 pt-10 pb-20">
			{@render children()}
		</main>
	</div>
</div>
