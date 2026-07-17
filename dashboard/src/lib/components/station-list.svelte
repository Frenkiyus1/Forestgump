<script lang="ts">
	import type { StationView } from '$lib/types';
	import StationRow from './station-row.svelte';
	interface Props {
		views: StationView[];
	}
	let { views }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<header class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Trạm đo</h2>
		<span class="text-sm text-gray-500">Mới nhất</span>
	</header>
	<ul class="flex flex-col gap-1">
		{#each views as view (view.station.station_id)}
			<StationRow {view} />
		{/each}
	</ul>
	<a href="#stations" class="text-sm font-medium text-accent">Tất cả trạm →</a>
</section>
