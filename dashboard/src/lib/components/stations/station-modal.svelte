<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { clsx } from '$lib/clsx';
	import Chart from '$lib/chart.svelte';
	import { fetchHistory } from '$lib/api';
	import type { StationDetail, HistoryPoint } from '$lib/types';
	import {
		ALERT_LABEL,
		ALERT_BADGE,
		ALERT_STRIP,
		ALERT_HEX,
		alertFor,
		relativeTime
	} from '$lib/alert-ui';

	interface Props {
		station: StationDetail | null;
		onClose: () => void;
	}
	let { station, onClose }: Props = $props();

	const RANGES: { id: string; label: string; days: number }[] = [
		{ id: '24h', label: '24h', days: 1 },
		{ id: '7d', label: '7 days', days: 7 },
		{ id: '30d', label: '30 days', days: 30 }
	];
	let range = $state('7d');
	let history = $state<HistoryPoint[]>([]);
	let loadingHistory = $state(false);

	// Fetch history whenever the open station or selected range changes.
	$effect(() => {
		const s = station;
		const days = RANGES.find((r) => r.id === range)?.days ?? 7;
		if (!s) return;
		let cancelled = false;
		loadingHistory = true;
		const to = new Date().toISOString();
		const from = new Date(Date.now() - days * 86_400_000).toISOString();
		fetchHistory(fetch, s.station_id, from, to).then((h) => {
			if (cancelled) return;
			history = h;
			loadingHistory = false;
		});
		return () => {
			cancelled = true;
		};
	});

	// Escape closes while open.
	$effect(() => {
		if (!station) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// Salinity metrics as colour-coded gauges (threshold 1 & 4 g/L).
	const GAUGE_MAX = 6;
	const GAUGE_C = 2 * Math.PI * 30;
	const gauges = $derived(
		station
			? [
					{ label: 'Salinity (EC)', value: station.ec },
					{ label: 'Forecast 24h', value: station.forecast_24h },
					{ label: 'Forecast 48h', value: station.forecast_48h }
				].map((g) => ({
					...g,
					level: alertFor(g.value),
					fill: Math.min(g.value / GAUGE_MAX, 1) * GAUGE_C
				}))
			: []
	);
	const extras = $derived(
		station
			? [
					{ label: 'Temperature', value: `${station.temp}`, unit: '°C' },
					{ label: 'Water level', value: `${station.level}`, unit: 'm' }
				]
			: []
	);

	const rangeBtn = (active: boolean) =>
		clsx(
			'rounded-full px-3 py-1 text-xs font-medium transition',
			active ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'
		);
</script>

{#if station}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
		transition:fade={{ duration: 150 }}
		onclick={onClose}
		onkeydown={() => {}}
		role="presentation"
	>
		<div
			class="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl sm:p-8"
			transition:fly={{ y: 24, duration: 220 }}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label="{station.name} details"
			tabindex="-1"
		>
			<div
				class={clsx('absolute inset-x-0 top-0 h-1.5 rounded-t-3xl', ALERT_STRIP[station.alert])}
				aria-hidden="true"
			></div>

			<div class="mb-6 flex items-start justify-between gap-4">
				<div>
					<h2 class="text-2xl font-semibold tracking-tight">{station.name}</h2>
					<p class="text-sm text-gray-500">{station.region}</p>
				</div>
				<div class="flex items-center gap-3">
					<span
						class={clsx('rounded-full px-2.5 py-1 text-xs font-medium', ALERT_BADGE[station.alert])}
					>
						{ALERT_LABEL[station.alert]}
					</span>
					<button
						type="button"
						onclick={onClose}
						aria-label="Close"
						class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-accent"
					>
						<svg
							viewBox="0 0 24 24"
							class="h-5 w-5"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
						</svg>
					</button>
				</div>
			</div>

			<div class="mb-3 grid grid-cols-3 gap-3">
				{#each gauges as g (g.label)}
					<div class={clsx('flex flex-col items-center rounded-2xl p-3', ALERT_BADGE[g.level])}>
						<div class="relative grid place-items-center">
							<svg viewBox="0 0 72 72" class="h-20 w-20 -rotate-90">
								<circle
									cx="36"
									cy="36"
									r="30"
									fill="none"
									stroke="currentColor"
									stroke-opacity="0.18"
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
								<p class="text-lg leading-none font-semibold tracking-tight text-gray-900">
									{g.value}
								</p>
								<p class="text-[10px] text-gray-500">g/L</p>
							</div>
						</div>
						<p class="mt-2 text-[11px] font-medium text-gray-600">{g.label}</p>
						<p class="text-[11px] font-semibold">{ALERT_LABEL[g.level]}</p>
					</div>
				{/each}
			</div>

			<div class="mb-6 grid grid-cols-2 gap-3">
				{#each extras as stat (stat.label)}
					<div class="rounded-2xl bg-cream px-4 py-3">
						<p class="text-[11px] text-gray-500">{stat.label}</p>
						<p class="mt-0.5 text-lg font-semibold tracking-tight">
							{stat.value}<span class="ml-0.5 text-xs font-medium text-gray-400">{stat.unit}</span>
						</p>
					</div>
				{/each}
			</div>

			<div class="mb-2 flex items-center justify-between">
				<h3 class="text-sm font-semibold tracking-tight">Salinity history</h3>
				<div class="flex gap-1 rounded-full bg-gray-50 p-1">
					{#each RANGES as r (r.id)}
						<button type="button" onclick={() => (range = r.id)} class={rangeBtn(range === r.id)}>
							{r.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="min-h-[240px]">
				{#if loadingHistory}
					<div class="flex h-[240px] items-center justify-center text-sm text-gray-400">
						Loading chart…
					</div>
				{:else}
					<Chart {history} />
				{/if}
			</div>

			<p class="mt-4 text-xs text-gray-400">Last updated: {relativeTime(station.updated_at)}</p>
		</div>
	</div>
{/if}
