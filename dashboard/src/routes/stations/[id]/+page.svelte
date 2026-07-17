<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import Chart from '$lib/chart.svelte';
	import { fetchHistory } from '$lib/api';
	import AppShell from '$lib/components/app-shell.svelte';
	import type { HistoryPoint } from '$lib/types';
	import {
		ALERT_LABEL,
		ALERT_BADGE,
		ALERT_HEX,
		ALERT_ADVICE,
		alertFor,
		relativeTime
	} from '$lib/alert-ui';

	let { data }: { data: PageData } = $props();
	const station = $derived(data.station);

	const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' } as const;
	const TREND_TONE = { up: 'text-red-600', down: 'text-green-600', flat: 'text-gray-400' } as const;

	const RANGES: { id: string; label: string; days: number }[] = [
		{ id: '24h', label: '24h', days: 1 },
		{ id: '7d', label: '7 days', days: 7 },
		{ id: '30d', label: '30 days', days: 30 }
	];
	let range = $state('7d');
	// History for non-default ranges, fetched on the client. The 7-day window
	// comes straight from the server load (data.history) so it renders on SSR.
	let fetched = $state<HistoryPoint[]>([]);
	let loadingHistory = $state(false);

	const history = $derived(range === '7d' ? data.history : fetched);

	// Refetch when switching to a non-default range (7d is already server-loaded).
	$effect(() => {
		const days = RANGES.find((r) => r.id === range)?.days ?? 7;
		if (range === '7d') return;
		const id = station.station_id;
		let cancelled = false;
		loadingHistory = true;
		const to = new Date().toISOString();
		const from = new Date(Date.now() - days * 86_400_000).toISOString();
		fetchHistory(fetch, id, from, to).then((h) => {
			if (cancelled) return;
			fetched = h;
			loadingHistory = false;
		});
		return () => {
			cancelled = true;
		};
	});

	// Salinity metrics as colour-coded gauges (threshold 1 & 4 g/L).
	const GAUGE_MAX = 6;
	const GAUGE_C = 2 * Math.PI * 30;
	const gauges = $derived(
		[
			{ label: 'Salinity (EC)', value: station.ec },
			{ label: 'Forecast 24h', value: station.forecast_24h },
			{ label: 'Forecast 48h', value: station.forecast_48h }
		].map((g) => ({
			...g,
			level: alertFor(g.value),
			fill: Math.min(g.value / GAUGE_MAX, 1) * GAUGE_C
		}))
	);
	const extras = $derived([
		{ label: 'Temperature', value: `${station.temp}`, unit: '°C' },
		{ label: 'Water level', value: `${station.level}`, unit: 'm' },
		{ label: 'Battery', value: `${station.battery}`, unit: '%' },
		{
			label: 'Coordinates',
			value: `${station.lat.toFixed(3)}, ${station.lon.toFixed(3)}`,
			unit: ''
		}
	]);

	const rangeBtn = (active: boolean) =>
		clsx(
			'rounded-full px-3 py-1 text-xs font-medium transition',
			active ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'
		);
</script>

<svelte:head><title>{station.name} — SaliGuard</title></svelte:head>

<AppShell>
	<a
		href={resolve('/stations')}
		class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
	>
		<svg
			viewBox="0 0 24 24"
			class="h-4 w-4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		All stations
	</a>

	<!-- header -->
	<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1
					class="text-4xl leading-tight font-semibold tracking-tight"
					style="font-family: 'Lora', serif;"
				>
					{station.name}
				</h1>
				<span
					class={clsx('rounded-full px-2.5 py-1 text-xs font-medium', ALERT_BADGE[station.alert])}
				>
					{ALERT_LABEL[station.alert]}
				</span>
			</div>
			<p class="mt-2 text-[15px] text-gray-500">
				{station.region} · Updated {relativeTime(station.updated_at)}
			</p>
		</div>
		<div class="flex items-end gap-2">
			<p class="text-5xl font-semibold tracking-tight">
				{station.ec}<span class="ml-1 text-xl font-medium text-gray-400">g/L</span>
			</p>
			<span
				class={clsx('pb-2 text-2xl font-semibold', TREND_TONE[station.trend])}
				aria-hidden="true"
			>
				{TREND_GLYPH[station.trend]}
			</span>
		</div>
	</div>

	<!-- advisory quote — lời khuyên hành động theo đúng mức cảnh báo hiện tại -->
	<section class="mb-5">
		<div class={clsx(CARD, 'relative overflow-hidden p-6')}>
			<span
				class="absolute top-4 left-4 text-6xl leading-none select-none"
				style="font-family: 'Lora', serif; color: {ALERT_HEX[station.alert]}; opacity: 0.18;"
				aria-hidden="true">“</span
			>
			<blockquote class="relative pl-8">
				<p
					class="text-lg leading-relaxed font-medium text-gray-800 italic"
					style="font-family: 'Lora', serif;"
				>
					“{ALERT_ADVICE[station.alert].quote}”
				</p>
				<footer class="mt-4 text-sm text-gray-500">
					— <cite class="font-medium text-gray-700 not-italic"
						>{ALERT_ADVICE[station.alert].source}.</cite
					>
				</footer>
			</blockquote>
		</div>
	</section>

	<!-- gauges -->
	<section class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Salinity metrics">
		{#each gauges as g (g.label)}
			<div class={clsx(CARD, 'flex flex-col items-center p-6')}>
				<div class="relative grid place-items-center">
					<svg viewBox="0 0 72 72" class="h-28 w-28 -rotate-90">
						<circle
							cx="36"
							cy="36"
							r="30"
							fill="none"
							stroke={ALERT_HEX[g.level]}
							stroke-opacity="0.16"
							stroke-width="7"
						/>
						<circle
							cx="36"
							cy="36"
							r="30"
							fill="none"
							stroke={ALERT_HEX[g.level]}
							stroke-width="7"
							stroke-linecap="round"
							stroke-dasharray="{g.fill} {GAUGE_C}"
						/>
					</svg>
					<div class="absolute text-center">
						<p class="text-2xl leading-none font-semibold tracking-tight text-gray-900">
							{g.value}
						</p>
						<p class="text-[11px] text-gray-500">g/L</p>
					</div>
				</div>
				<p class="mt-3 text-sm font-medium text-gray-600">{g.label}</p>
				<span
					class={clsx(
						'mt-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
						ALERT_BADGE[g.level]
					)}
				>
					{ALERT_LABEL[g.level]}
				</span>
			</div>
		{/each}
	</section>

	<!-- extras -->
	<section class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Device readings">
		{#each extras as stat (stat.label)}
			<div class={clsx(CARD, 'px-5 py-4')}>
				<p class="text-[11px] text-gray-500">{stat.label}</p>
				<p class="mt-1 text-xl font-semibold tracking-tight">
					{stat.value}{#if stat.unit}<span class="ml-0.5 text-sm font-medium text-gray-400"
							>{stat.unit}</span
						>{/if}
				</p>
			</div>
		{/each}
	</section>

	<!-- history chart -->
	<section class={clsx(CARD, 'overflow-hidden p-6')} aria-label="Salinity history">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="text-base font-semibold tracking-tight">Salinity history</h2>
				<p class="text-xs text-gray-400">EC over time (g/L)</p>
			</div>
			<div class="flex gap-1 rounded-full bg-gray-50 p-1">
				{#each RANGES as r (r.id)}
					<button type="button" onclick={() => (range = r.id)} class={rangeBtn(range === r.id)}>
						{r.label}
					</button>
				{/each}
			</div>
		</div>
		<div class="min-h-[280px]">
			{#if loadingHistory}
				<div class="flex h-[280px] items-center justify-center text-sm text-gray-400">
					Loading chart…
				</div>
			{:else}
				<Chart {history} />
			{/if}
		</div>
	</section>
</AppShell>
