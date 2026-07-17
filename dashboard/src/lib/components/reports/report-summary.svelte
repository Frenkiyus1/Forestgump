<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import type { ReportData } from '$lib/types';

	interface Props {
		network: ReportData['network'];
	}
	let { network }: Props = $props();

	const cards = $derived([
		{ label: 'Avg salinity', value: network.avgEc.toFixed(2), unit: 'g/L', tone: 'text-gray-500' },
		{ label: 'Peak salinity', value: network.peakEc.toFixed(2), unit: 'g/L', tone: 'text-red-600' },
		{
			label: 'Alerts',
			value: String(network.redAlerts + network.yellowAlerts),
			sub: `${network.redAlerts} danger · ${network.yellowAlerts} caution`,
			tone: 'text-amber-600'
		},
		{
			label: 'Sensors reporting',
			value: `${network.stationsReporting} / ${network.totalStations}`,
			tone: 'text-green-600'
		}
	]);
</script>

<section class="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Network summary">
	{#each cards as c (c.label)}
		<div class={clsx(CARD, 'p-5')}>
			<p class="text-[13px] font-medium text-gray-500">{c.label}</p>
			<p class="mt-3 text-3xl font-semibold tracking-tight">
				{c.value}{#if c.unit}<span class="ml-1 text-lg font-medium text-gray-400">{c.unit}</span
					>{/if}
			</p>
			<p class={clsx('mt-1 text-xs font-medium', c.tone)}>{c.sub ?? ' '}</p>
		</div>
	{/each}
</section>
