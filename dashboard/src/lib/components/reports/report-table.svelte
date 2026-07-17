<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { ALERT_LABEL, ALERT_BADGE, ALERT_STRIP } from '$lib/alert-ui';
	import { toCsv, downloadCsv } from '$lib/csv';
	import type { StationReport } from '$lib/types';

	interface Props {
		stations: StationReport[];
		periodDays: number;
	}
	let { stations, periodDays }: Props = $props();

	function exportCsv() {
		const header = ['Station', 'Region', 'Avg EC (g/L)', 'Peak EC (g/L)', 'Alerts', 'Status'];
		const rows = stations.map((s) => [
			s.name,
			s.region,
			s.avgEc,
			s.peakEc,
			s.alertCount,
			ALERT_LABEL[s.level]
		]);
		const stamp = new Date().toISOString().slice(0, 10);
		downloadCsv(`forestgump-report-${periodDays}d-${stamp}.csv`, toCsv([header, ...rows]));
	}
</script>

<section class={clsx(CARD, 'overflow-hidden')} aria-label="Per-station report">
	<div class="flex items-center justify-between px-6 pt-5 pb-3">
		<div>
			<h2 class="text-base font-semibold tracking-tight">By station</h2>
			<p class="text-xs text-gray-400">Last {periodDays} days</p>
		</div>
		<button
			type="button"
			onclick={exportCsv}
			class="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
					d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			Export CSV
		</button>
	</div>

	<!-- header row (desktop) -->
	<div
		class="hidden grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.7fr_0.9fr] gap-4 border-b border-gray-100 px-6 py-2 text-[11px] font-semibold tracking-wide text-gray-400 uppercase sm:grid"
	>
		<span>Station</span>
		<span>Region</span>
		<span class="text-right">Avg EC</span>
		<span class="text-right">Peak EC</span>
		<span class="text-right">Alerts</span>
		<span class="text-right">Status</span>
	</div>

	<div class="divide-y divide-gray-100/80">
		{#each stations as s (s.station_id)}
			<a
				href={resolve(`/stations/${s.station_id}`)}
				class="grid grid-cols-2 gap-x-4 gap-y-1 px-6 py-3.5 transition hover:bg-cream/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.7fr_0.9fr] sm:items-center"
			>
				<span class="flex items-center gap-2 font-medium">
					<span
						class={clsx('h-2.5 w-2.5 shrink-0 rounded-full', ALERT_STRIP[s.level])}
						aria-hidden="true"
					></span>
					{s.name}
				</span>
				<span class="text-sm text-gray-500">{s.region}</span>
				<span class="text-sm sm:text-right">
					<span class="mr-1 text-gray-400 sm:hidden">Avg</span>{s.avgEc} g/L
				</span>
				<span class="text-sm sm:text-right">
					<span class="mr-1 text-gray-400 sm:hidden">Peak</span>{s.peakEc} g/L
				</span>
				<span class="text-sm sm:text-right">
					<span class="mr-1 text-gray-400 sm:hidden">Alerts</span>{s.alertCount}
				</span>
				<span class="sm:text-right">
					<span class={clsx('rounded-full px-2.5 py-1 text-xs font-medium', ALERT_BADGE[s.level])}>
						{ALERT_LABEL[s.level]}
					</span>
				</span>
			</a>
		{/each}
	</div>
</section>
