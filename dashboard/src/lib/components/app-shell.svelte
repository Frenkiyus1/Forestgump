<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import logo from '$lib/assets/logo.png';
	import { getSession, clearSession } from '$lib/auth';
	import LanguageToggle from './language-toggle.svelte';
	import ChatWidget from './chat-widget.svelte';
	import type { Bulletin } from '$lib/types';

	let {
		children,
		lang = 'vi',
		onLangChange,
		compact = false,
		noHeader = false
	}: {
		children: Snippet;
		lang?: Bulletin['lang'];
		onLangChange?: (l: Bulletin['lang']) => void;
		/** Fits main content to the viewport height on large screens (no page scroll) — used by
		 * pages like /map that manage their own internal scroll regions. */
		compact?: boolean;
		/** Hides the sticky top bar — used by pages that want full-bleed content. */
		noHeader?: boolean;
	} = $props();

	const path = $derived(page.url.pathname);
	let mobileOpen = $state(false);

	// Re-read on every navigation — localStorage isn't reactive on its own.
	const session = $derived.by(() => {
		void path;
		return getSession();
	});
	const isGuest = $derived(!session || session.email === 'Guest');
	const accountName = $derived(isGuest ? 'Khách' : 'Admin');
	const accountEmail = $derived(isGuest ? 'Chế độ khách' : (session?.email ?? ''));
	const accountInitials = $derived(accountName.slice(0, 2).toUpperCase());

	function logout() {
		clearSession();
		mobileOpen = false;
		goto(resolve('/login'));
	}

	type NavIcon = 'overview' | 'locations' | 'map' | 'alerts';
	type NavHref = '/' | '/locations' | '/map' | '/alerts';
	type NavItem = { label: string; href: NavHref; icon: NavIcon; active: boolean };

	const nav = $derived<NavItem[]>([
		{ label: 'Tổng quan', href: '/', icon: 'overview', active: path === '/' },
		{
			label: 'Khu vực',
			href: '/locations',
			icon: 'locations',
			active: path.startsWith('/locations')
		},
		{ label: 'Bản đồ', href: '/map', icon: 'map', active: path.startsWith('/map') },
		{ label: 'Cảnh báo', href: '/alerts', icon: 'alerts', active: path.startsWith('/alerts') }
	]);

	const linkBase = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition';
	const linkIdle = 'text-gray-500 hover:bg-cream/70 hover:text-gray-900';
	const linkActive = 'bg-accent/10 font-medium text-accent';
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
		{:else if name === 'locations'}
			<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" /><circle
				cx="12"
				cy="10"
				r="2.5"
			/>
		{:else if name === 'map'}
			<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3Z" /><path d="M9 3v15M15 6v15" />
		{:else if name === 'alerts'}
			<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
		{/if}
	</svg>
{/snippet}

<div class="relative min-h-screen bg-cream font-[Inter] text-gray-900">
	<!-- shared ambient background -->
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div
			class="absolute -top-32 -right-24 h-[34rem] w-[34rem] rounded-full opacity-60 blur-3xl"
			style="background: radial-gradient(circle, #d9efe9 0%, transparent 70%);"
		></div>
		<div
			class="absolute top-1/3 -left-40 h-[30rem] w-[30rem] rounded-full opacity-50 blur-3xl"
			style="background: radial-gradient(circle, #fde9c8 0%, transparent 70%);"
		></div>
	</div>

	<!-- mobile backdrop -->
	{#if mobileOpen}
		<button
			type="button"
			aria-label="Đóng menu"
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
			<img src={logo} alt="" class="h-[53px] w-[53px] shrink-0 rounded-full object-cover" />
			<span class="text-[18px] font-semibold tracking-tight">ForestGump</span>
		</div>

		<nav class="flex-1 px-4 py-2" aria-label="Điều hướng chính">
			<p class="px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
				Menu
			</p>
			<ul class="flex flex-col gap-1">
				{#each nav as item (item.label)}
					<li>
						<a
							href={resolve(item.href)}
							data-sveltekit-preload-data
							class={clsx(linkBase, item.active ? linkActive : linkIdle)}
							aria-current={item.active ? 'page' : undefined}
							onclick={() => (mobileOpen = false)}
						>
							{@render icon(item.icon)}
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<!-- account footer -->
		<div class="border-t border-black/[0.04] p-4">
			<div class="flex items-center gap-3">
				<span
					class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
					>{accountInitials}</span
				>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">{accountName}</p>
					<p class="truncate text-xs text-gray-400">{accountEmail}</p>
				</div>
				<button
					type="button"
					disabled
					aria-label="Cài đặt (sắp ra mắt)"
					title="Cài đặt (sắp ra mắt)"
					class="grid h-9 w-9 shrink-0 cursor-not-allowed place-items-center rounded-lg text-gray-300"
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
					aria-label="Đăng xuất"
					title="Đăng xuất"
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
		{#if !noHeader}
			<!-- slim top bar -->
			<header
				class="sticky top-0 z-30 border-b border-black/[0.04] bg-white/70 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none"
			>
				<div class="flex items-center gap-3 px-6 py-3.5">
					<button
						type="button"
						aria-label="Mở menu"
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
					<div class="ml-auto flex items-center gap-2">
						{#if onLangChange}
							<LanguageToggle {lang} onChange={onLangChange} />
						{/if}
					</div>
				</div>
			</header>
		{/if}

		<main
			class={clsx(
				'relative z-10 mx-auto max-w-6xl',
				compact
					? 'flex flex-col px-6 pt-1 pb-4 lg:h-[calc(100vh-64px)] lg:overflow-y-auto'
					: noHeader
						? 'flex flex-col px-6 pt-1 pb-4 lg:h-screen lg:overflow-y-auto'
						: 'px-6 pt-10 pb-20'
			)}
		>
			{@render children()}
		</main>
	</div>
</div>

<ChatWidget />
