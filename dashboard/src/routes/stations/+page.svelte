<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { fetchStationDetails } from '$lib/api';
	import { HAI_PHONG_REGIONS } from '$lib/stations-mock';
	import type { StationDetail } from '$lib/types';
	import AppShell from '$lib/components/app-shell.svelte';
	import StationFilterBar from '$lib/components/stations/station-filter-bar.svelte';
	import StationGrid from '$lib/components/stations/station-grid.svelte';

	let { data }: { data: PageData } = $props();

	// Latest poll result; falls back to the server-loaded data until the first poll.
	let polled = $state<StationDetail[] | null>(null);
	let filterRegion = $state<string | null>(null);
	let filterQuery = $state('');

	const stations = $derived(polled ?? data.stations);

	// Demo aid: ?skeleton renders the loading state for screenshots.
	const loading = $derived(page.url.searchParams.has('skeleton'));

	const filtered = $derived(
		stations.filter(
			(s) =>
				(filterRegion === null || s.region === filterRegion) &&
				(filterQuery === '' || s.name.toLowerCase().includes(filterQuery.toLowerCase()))
		)
	);

	function onFilter(region: string | null, query: string) {
		filterRegion = region;
		filterQuery = query;
	}

	// TẠM: poll mỗi 3s cho demo (tăng lại 60_000 khi không cần cập nhật gần-tức-thời).
	$effect(() => {
		const id = setInterval(async () => {
			polled = await fetchStationDetails(fetch);
		}, 3000);
		return () => clearInterval(id);
	});
</script>

<svelte:head><title>Stations — ForestGump</title></svelte:head>

<AppShell>
	<div class="mb-8">
		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			Stations
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			Monitoring {stations.length} field stations across {HAI_PHONG_REGIONS.length} districts —
			the first pilot region in ForestGump's nationwide rollout.
		</p>
	</div>

	<div class="mb-6">
		<StationFilterBar regions={HAI_PHONG_REGIONS} {onFilter} />
	</div>

	<StationGrid stations={filtered} {loading} />
</AppShell>
