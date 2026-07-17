<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import type { StationDetail } from '$lib/types';
	import { ALERT_LABEL, ALERT_STRIP, relativeTime } from '$lib/alert-ui';
	import LeafStatus from '$lib/components/leaf-status.svelte';

	interface Props {
		station: StationDetail;
	}
	let { station }: Props = $props();

	const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' } as const;
	const TREND_TONE = {
		up: 'text-red-600',
		down: 'text-green-600',
		flat: 'text-gray-400'
	} as const;

	const cardClass = clsx(
		CARD_INTERACTIVE,
		'group block w-full overflow-hidden text-left',
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
	);
</script>

<a href={resolve(`/stations/${station.station_id}`)} class={cardClass}>
	<div class="flex flex-col gap-4 p-5">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="truncate text-base font-semibold tracking-tight">{station.name}</p>
				<p class="truncate text-xs text-gray-500">
					<span class="font-mono text-gray-400">{station.station_id}</span> · {station.region}
				</p>
			</div>
			<span class="flex shrink-0 items-center gap-1.5">
				<span
					class={clsx('h-2.5 w-2.5 rounded-full', ALERT_STRIP[station.alert])}
					aria-hidden="true"
				></span>
				<span class="text-xs font-medium text-gray-500">{ALERT_LABEL[station.alert]}</span>
			</span>
		</div>

		<div class="flex items-center justify-between gap-2">
			<div>
				<p class="text-3xl font-semibold tracking-tight">
					{station.ec}<span class="ml-1 text-base font-medium text-gray-400">g/L</span>
				</p>
				<p class="text-xs text-gray-400">Salinity (EC)</p>
			</div>
			<LeafStatus alert={station.alert} />
			<span class={clsx('text-lg font-semibold', TREND_TONE[station.trend])} aria-hidden="true">
				{TREND_GLYPH[station.trend]}
			</span>
		</div>

		<div
			class="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400"
		>
			<span>Updated {relativeTime(station.updated_at)}</span>
			<span class="flex items-center gap-2">
				<span class={station.battery < 25 ? 'text-red-600' : 'text-gray-500'}>
					{station.battery}%
				</span>
				<span class="flex items-end gap-0.5" aria-label="Signal {station.signal} of 4">
					{#each [1, 2, 3, 4] as bar (bar)}
						<span
							class={clsx(
								'w-0.5 rounded-sm',
								bar <= station.signal ? 'bg-gray-500' : 'bg-gray-200'
							)}
							style="height: {bar * 2 + 2}px"
						></span>
					{/each}
				</span>
			</span>
		</div>
	</div>
</a>
