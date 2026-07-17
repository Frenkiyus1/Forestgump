<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { i18n, t } from '$lib/i18n.svelte';
	import type { Lang } from '$lib/i18n.svelte';
	import { uiState } from '$lib/ui-state.svelte';
	import {
		getProfile,
		saveProfile,
		FARM_TYPES,
		AREAS,
		WATER_SOURCES,
		THRESHOLDS,
		LEAD_TIMES,
		EXPERIENCES
	} from '$lib/profile';
	import type { UserProfile } from '$lib/profile';

	type Tab = 'profile' | 'language';

	let activeTab = $state<Tab>('profile');
	let form = $state<UserProfile>(getProfile());
	let saved = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	function close() {
		uiState.settingsOpen = false;
	}

	function handleSave() {
		saveProfile(form);
		saved = true;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saved = false;
		}, 2000);
	}

	function handleLangChange(l: Lang) {
		i18n.setLang(l);
	}

	function optLabel(opt: { vi: string; en: string }): string {
		return i18n.lang === 'vi' ? opt.vi : opt.en;
	}

	$effect(() => {
		return () => clearTimeout(saveTimer);
	});

	$effect(() => {
		if (!uiState.settingsOpen) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') close();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const inputCls =
		'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent';
	const labelCls = 'mb-1.5 block text-xs font-medium text-gray-600';
</script>

<!-- Backdrop -->
<div
	role="presentation"
	class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
	onclick={close}
></div>

<!-- Dialog -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	aria-modal="true"
	role="dialog"
	aria-label={t('settings.title')}
>
	<div class="flex h-full max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
			<h2 class="text-base font-semibold text-gray-900">{t('settings.title')}</h2>
			<button
				type="button"
				onclick={close}
				aria-label={t('settings.close')}
				class="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-accent"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>

		<!-- Tab bar -->
		<div class="flex shrink-0 border-b border-gray-100 px-6">
			{#each ['profile', 'language'] as Tab[] as tab (tab)}
				<button
					type="button"
					onclick={() => {
						activeTab = tab;
						saved = false;
					}}
					class={clsx(
						'border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent',
						activeTab === tab
							? 'border-accent text-accent'
							: 'border-transparent text-gray-500 hover:text-gray-700'
					)}
				>
					{tab === 'profile' ? t('settings.tab.profile') : t('settings.tab.language')}
				</button>
			{/each}
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto px-6 py-6">
			{#if activeTab === 'profile'}
				<div class="flex flex-col gap-5">
					<!-- Location fields -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="set-province" class={labelCls}>
								{t('profile.province')}
							</label>
							<input id="set-province" type="text" bind:value={form.province} class={inputCls} />
						</div>
						<div>
							<label for="set-district" class={labelCls}>
								{t('profile.district')}
							</label>
							<input id="set-district" type="text" bind:value={form.district} class={inputCls} />
						</div>
						<div class="sm:col-span-2">
							<label for="set-commune" class={labelCls}>
								{t('profile.commune')}
								<span class="font-normal text-gray-400">({t('profile.commune.hint')})</span>
							</label>
							<input id="set-commune" type="text" bind:value={form.commune} class={inputCls} />
						</div>
					</div>

					<hr class="border-gray-100" />

					<!-- Choice fields -->
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="set-farmType" class={labelCls}>{t('profile.farmType')}</label>
							<select id="set-farmType" bind:value={form.farmType} class={inputCls}>
								<option value="">{t('profile.select')}</option>
								{#each FARM_TYPES as opt (opt.id)}
									<option value={opt.id}>{optLabel(opt)}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="set-farmArea" class={labelCls}>{t('profile.farmArea')}</label>
							<select id="set-farmArea" bind:value={form.farmArea} class={inputCls}>
								<option value="">{t('profile.select')}</option>
								{#each AREAS as opt (opt.id)}
									<option value={opt.id}>{optLabel(opt)}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="set-waterSource" class={labelCls}>{t('profile.waterSource')}</label>
							<select id="set-waterSource" bind:value={form.waterSource} class={inputCls}>
								<option value="">{t('profile.select')}</option>
								{#each WATER_SOURCES as opt (opt.id)}
									<option value={opt.id}>{optLabel(opt)}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="set-alertThreshold" class={labelCls}>{t('profile.alertThreshold')}</label>
							<select id="set-alertThreshold" bind:value={form.alertThreshold} class={inputCls}>
								<option value="">{t('profile.select')}</option>
								{#each THRESHOLDS as opt (opt.id)}
									<option value={opt.id}>{optLabel(opt)}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="set-leadTime" class={labelCls}>{t('profile.leadTime')}</label>
							<select id="set-leadTime" bind:value={form.leadTime} class={inputCls}>
								<option value="">{t('profile.select')}</option>
								{#each LEAD_TIMES as opt (opt.id)}
									<option value={opt.id}>{optLabel(opt)}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="set-experience" class={labelCls}>{t('profile.experience')}</label>
							<select id="set-experience" bind:value={form.experience} class={inputCls}>
								<option value="">{t('profile.select')}</option>
								{#each EXPERIENCES as opt (opt.id)}
									<option value={opt.id}>{optLabel(opt)}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
			{:else}
				<!-- Language tab -->
				<div>
					<p class="mb-1 text-sm font-medium text-gray-900">{t('lang.title')}</p>
					<p class="mb-5 text-xs text-gray-400">{t('lang.desc')}</p>

					<div class="flex flex-col gap-3">
						{#each ['vi', 'en'] as Lang[] as lang (lang)}
							<button
								type="button"
								onclick={() => handleLangChange(lang)}
								class={clsx(
									'flex items-center gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-accent',
									i18n.lang === lang
										? 'border-accent bg-accent/5 ring-1 ring-accent/20'
										: 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
								)}
							>
								<span class="text-sm font-semibold text-gray-900">
									{lang === 'vi' ? t('lang.vi') : t('lang.en')}
								</span>
								<span class="text-xs text-gray-400">
									{lang === 'vi' ? 'Vietnamese' : 'English'}
								</span>
								{#if i18n.lang === lang}
									<svg
										viewBox="0 0 24 24"
										class="ml-auto h-4 w-4 text-accent"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										aria-hidden="true"
									>
										<path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer (profile tab only) -->
		{#if activeTab === 'profile'}
			<div class="flex shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
				{#if saved}
					<span class="text-sm text-green-600" aria-live="polite">{t('settings.saved')}</span>
				{:else}
					<span></span>
				{/if}
				<button
					type="button"
					onclick={handleSave}
					class="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent"
				>
					{t('settings.save')}
				</button>
			</div>
		{/if}
	</div>
</div>
