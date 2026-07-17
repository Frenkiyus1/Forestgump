<script lang="ts">
	import type { StationView, AlertLevel } from '$lib/types';
	interface Props {
		view: StationView;
	}
	let { view }: Props = $props();

	const DOT: Record<AlertLevel, string> = {
		green: 'bg-green-500',
		yellow: 'bg-yellow-500',
		red: 'bg-red-600'
	};
	const dotClass = $derived(view.reading ? DOT[view.reading.alert] : 'bg-gray-300');
	const forecast = $derived(view.reading ? `${view.reading.forecast_24h} g/L` : '—');
</script>

<li class="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50">
	<span class="h-2.5 w-2.5 rounded-full {dotClass}" aria-hidden="true"></span>
	<div class="flex flex-col">
		<span class="text-sm font-medium">{view.station.name}</span>
		<span class="text-xs text-gray-500">{view.station.station_id}</span>
	</div>
	<span class="ml-auto text-sm text-gray-600">{forecast}</span>
</li>
