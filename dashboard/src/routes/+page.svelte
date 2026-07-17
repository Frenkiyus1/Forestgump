<script lang="ts">
	import type { PageData } from './$types';
	import type { StationView } from '$lib/types';
	import { fetchDashboardViews } from '$lib/api';
	import AppShell from '$lib/components/app-shell.svelte';
	import HomeHero from '$lib/components/home/home-hero.svelte';
	import HomeKpiRow from '$lib/components/home/home-kpi-row.svelte';
	import HomeTrendChart from '$lib/components/home/home-trend-chart.svelte';
	import HomeStationsTable from '$lib/components/home/home-stations-table.svelte';
	import HomeAlerts from '$lib/components/home/home-alerts.svelte';

	type Alert = 'green' | 'yellow' | 'red';
	type Row = { name: string; ec: number; forecast: number; level: number; alert: Alert };

	let { data }: { data: PageData } = $props();

	// Latest poll result; falls back to the server-loaded data until the first poll.
	let polled = $state<StationView[] | null>(null);
	const views = $derived(polled ?? data.views);

	// TẠM: poll mỗi 3s cho demo (khớp chu kỳ gửi telemetry firmware) - tăng lại
	// (vd 60s) khi không cần cập nhật gần-tức-thời nữa. Giữ nguyên `polled` nếu
	// lần poll bị lỗi (mất mạng tạm thời) thay vì xoá dữ liệu đang hiển thị.
	$effect(() => {
		const id = setInterval(async () => {
			try {
				polled = await fetchDashboardViews(fetch);
			} catch (err) {
				console.warn('[overview] poll failed, keeping last known data:', err);
			}
		}, 3000);
		return () => clearInterval(id);
	});

	// Fallback data so the page always renders rich while the API returns mocks/errors.
	const MOCK_STATIONS: Row[] = [
		{ name: 'Lạch Tray', ec: 4.6, forecast: 5.0, level: 1.9, alert: 'red' },
		{ name: 'Bạch Đằng', ec: 2.3, forecast: 2.8, level: 1.6, alert: 'yellow' },
		{ name: 'Cấm', ec: 1.4, forecast: 1.7, level: 1.4, alert: 'yellow' },
		{ name: 'Văn Úc', ec: 0.6, forecast: 0.8, level: 1.2, alert: 'green' },
		{ name: 'Đá Bạc', ec: 0.4, forecast: 0.5, level: 1.1, alert: 'green' }
	];

	const liveStations = $derived(
		views
			.filter((v) => v.reading !== null)
			.map((v) => ({
				name: v.station.name,
				ec: v.reading!.ec,
				forecast: v.reading!.forecast_24h,
				level: v.reading!.level,
				alert: v.reading!.alert
			}))
	);
	const stations = $derived<Row[]>(liveStations.length ? liveStations : MOCK_STATIONS);

	const total = $derived(stations.length);
	const greenCount = $derived(stations.filter((s) => s.alert === 'green').length);
	const atRisk = $derived(stations.filter((s) => s.alert !== 'green').length);
	const safePct = $derived(total === 0 ? 0 : Math.round((greenCount / total) * 100));
	const peak = $derived(stations.length ? Math.max(...stations.map((s) => s.forecast)) : 0);
	const avgLevel = $derived(
		stations.length ? stations.reduce((a, s) => a + s.level, 0) / stations.length : 0
	);

	const alerts = $derived(
		stations
			.filter((s) => s.alert !== 'green')
			.map((s) => ({
				station: s.name,
				level: s.alert,
				text:
					s.alert === 'red'
						? 'Exceeded 4 g/L — close the gates'
						: 'Approaching the caution threshold'
			}))
	);
</script>

<svelte:head><title>Overview — ForestGump</title></svelte:head>

<AppShell>
	{#if data.error}
		<p class="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
			Showing sample data — live API unavailable ({data.error}).
		</p>
	{/if}

	<HomeHero {total} />
	<HomeKpiRow {greenCount} {total} {safePct} {atRisk} {peak} {avgLevel} {stations} />
	<HomeTrendChart />
	<HomeStationsTable {stations} />
	<HomeAlerts {alerts} />
</AppShell>
