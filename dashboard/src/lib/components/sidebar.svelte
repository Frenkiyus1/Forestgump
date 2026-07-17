<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { clearSession } from '$lib/auth';
	import LogoIcon from '$lib/components/logo-icon.svelte';
	import { t } from '$lib/i18n.svelte';
	import { uiState } from '$lib/ui-state.svelte';

	function logout() {
		clearSession();
		goto(resolve('/login'));
	}

	const NAV_ITEMS = [
		{ key: 'nav.overview', href: '/' },
		{ key: 'nav.stations', href: '/stations' },
		{ key: 'nav.map', href: '/map' },
		{ key: 'nav.alerts', href: '/alerts' },
		{ key: 'nav.reports', href: '/reports' }
	] as const;

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path.startsWith(href);
	}
</script>

<aside class="hidden h-full w-64 flex-col gap-6 bg-card p-6 lg:flex">
	<div class="flex items-center gap-2">
		<LogoIcon class="h-7 w-7 shrink-0" />
		<span class="text-lg font-semibold">ForestGump</span>
	</div>

	<label class="sr-only" for="sidebar-search">{t('search')}</label>
	<input
		id="sidebar-search"
		type="search"
		placeholder={t('search')}
		class="rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
	/>

	<nav aria-label="Điều hướng chính">
		<ul class="flex flex-col gap-1">
			{#each NAV_ITEMS as item (item.key)}
				<li>
					<a
						href={resolve(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class={isActive(item.href)
							? 'block rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent'
							: 'block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50'}
					>
						{t(item.key)}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="mt-auto flex flex-col gap-1">
		<!-- Settings button -->
		<button
			type="button"
			onclick={() => {
				uiState.settingsOpen = true;
			}}
			class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent"
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
			{t('nav.settings')}
		</button>

		<!-- Logout button -->
		<button
			type="button"
			onclick={logout}
			class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent"
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
			{t('nav.logout')}
		</button>
	</div>
</aside>
