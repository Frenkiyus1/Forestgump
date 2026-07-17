<script lang="ts">
	import type { PageData } from './$types';
	import type { Bulletin } from '$lib/types';
	import { getForecast } from '$lib/weather';
	import { generateBulletin } from '$lib/bulletin';
	import { mostUrgent } from '$lib/derive';
	import AppShell from '$lib/components/app-shell.svelte';
	import AlertBanner from '$lib/components/alert-banner.svelte';
	import AlertBannerSkeleton from '$lib/components/alert-banner-skeleton.svelte';
	import HomeHero from '$lib/components/home/home-hero.svelte';
	import HomeKpiRow from '$lib/components/home/home-kpi-row.svelte';
	import HomeTrendChart from '$lib/components/home/home-trend-chart.svelte';
	import HomeLocationsTable from '$lib/components/home/home-locations-table.svelte';
	import HomeAlerts from '$lib/components/home/home-alerts.svelte';

	let { data }: { data: PageData } = $props();

	let lang = $state<Bulletin['lang']>('vi');
	let bulletin = $state<Bulletin | null>(null);
	let bulletinLoading = $state(true);

	// Khu vực nguy cấp nhất (còn ít giờ nhất) dẫn đầu trang — hành động cụ thể
	// luôn là thứ đầu tiên người dùng thấy, không phải số liệu.
	const featured = $derived(mostUrgent(data.details) ?? data.details[0]);

	async function loadBulletin() {
		bulletinLoading = true;
		try {
			const forecast = await getForecast(featured.locationId);
			bulletin = await generateBulletin(forecast, lang);
		} finally {
			bulletinLoading = false;
		}
	}

	$effect(() => {
		void featured.locationId;
		void lang;
		loadBulletin();
	});
</script>

<svelte:head><title>Tổng quan — ForestGump</title></svelte:head>

<AppShell {lang} onLangChange={(l) => (lang = l)}>
	<div class="mb-8">
		{#if bulletinLoading}
			<AlertBannerSkeleton />
		{:else}
			<AlertBanner alert={featured.alert} {bulletin} {bulletinLoading} />
		{/if}
	</div>

	<HomeHero total={data.summary.total} />
	<HomeKpiRow summary={data.summary} details={data.details} />
	<HomeTrendChart detail={featured} />
	<HomeLocationsTable details={data.details} />
	<HomeAlerts alerts={data.alerts} />
</AppShell>
