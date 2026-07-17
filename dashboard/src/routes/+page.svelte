<script lang="ts">
	import type { Bulletin, Forecast } from '$lib/types';
	import { LOCATIONS } from '$lib/locations';
	import { getForecast } from '$lib/weather';
	import { generateBulletin } from '$lib/bulletin';
	import LocationPicker from '$lib/components/location-picker.svelte';
	import LanguageToggle from '$lib/components/language-toggle.svelte';
	import AlertBanner from '$lib/components/alert-banner.svelte';
	import AlertBannerSkeleton from '$lib/components/alert-banner-skeleton.svelte';
	import ForecastWeek from '$lib/components/forecast-week.svelte';
	import ForecastWeekSkeleton from '$lib/components/forecast-week-skeleton.svelte';
	import ErrorState from '$lib/components/error-state.svelte';

	let selectedId = $state(LOCATIONS[0].id);
	let lang = $state<Bulletin['lang']>('vi');

	let forecast = $state<Forecast | null>(null);
	let forecastLoading = $state(true);
	let forecastError = $state<string | null>(null);

	let bulletin = $state<Bulletin | null>(null);
	let bulletinLoading = $state(true);
	let bulletinError = $state<string | null>(null);

	async function loadForecast(locationId: string) {
		forecastLoading = true;
		forecastError = null;
		forecast = null;
		bulletin = null;
		try {
			forecast = await getForecast(locationId);
		} catch (err) {
			forecastError = err instanceof Error ? err.message : 'Lỗi không xác định';
		} finally {
			forecastLoading = false;
		}
	}

	async function loadBulletin(f: Forecast, l: Bulletin['lang']) {
		bulletinLoading = true;
		bulletinError = null;
		try {
			bulletin = await generateBulletin(f, l);
		} catch (err) {
			bulletinError = err instanceof Error ? err.message : 'Lỗi không xác định';
		} finally {
			bulletinLoading = false;
		}
	}

	// Tải lại forecast mỗi khi đổi khu vực.
	$effect(() => {
		loadForecast(selectedId);
	});

	// Tải lại bulletin mỗi khi có forecast mới hoặc đổi ngôn ngữ.
	$effect(() => {
		if (forecast) loadBulletin(forecast, lang);
	});
</script>

<svelte:head><title>Cảnh báo thời tiết Điện Biên</title></svelte:head>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-extrabold text-slate-900 sm:text-2xl">Cảnh báo thời tiết Điện Biên</h1>
		<p class="text-sm text-slate-500">Dữ liệu → Dự báo → Ngưỡng → Cảnh báo → Hành động</p>
	</header>

	<LocationPicker locations={LOCATIONS} {selectedId} onSelect={(id) => (selectedId = id)} />

	<div class="flex justify-end">
		<LanguageToggle {lang} onChange={(l) => (lang = l)} />
	</div>

	{#if forecastLoading}
		<AlertBannerSkeleton />
		<ForecastWeekSkeleton />
	{:else if forecastError}
		<ErrorState message={forecastError} onRetry={() => loadForecast(selectedId)} />
	{:else if forecast}
		<AlertBanner alert={forecast.alert} {bulletin} {bulletinLoading} />

		{#if bulletinError}
			<ErrorState
				message={bulletinError}
				onRetry={() => forecast && loadBulletin(forecast, lang)}
			/>
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="text-sm font-bold tracking-wide text-slate-500 uppercase">Dự báo 7 ngày</h2>
			<ForecastWeek daily={forecast.daily} />
		</section>
	{/if}
</main>
