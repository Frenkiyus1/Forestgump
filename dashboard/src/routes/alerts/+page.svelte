<script lang="ts">
	import type { PageData } from './$types';
	import { fetchAlertHistory } from '$lib/api';
	import { HAI_PHONG_REGIONS } from '$lib/stations-mock';
	import type { AlertEvent } from '$lib/types';
	import AppShell from '$lib/components/app-shell.svelte';
	import AlertFilter from '$lib/components/alerts/alert-filter.svelte';
	import AlertList from '$lib/components/alerts/alert-list.svelte';

	let { data }: { data: PageData } = $props();

	type Level = 'all' | 'yellow' | 'red';

	// Latest poll result; falls back to the server-loaded data until the first poll.
	let polled = $state<AlertEvent[] | null>(null);
	let filterRegion = $state<string | null>(null);
	let filterLevel = $state<Level>('all');

	const alerts = $derived(polled ?? data.alerts);

	const filtered = $derived(
		alerts.filter(
			(a) =>
				(filterRegion === null || a.region === filterRegion) &&
				(filterLevel === 'all' || a.level === filterLevel)
		)
	);

	const dangerCount = $derived(alerts.filter((a) => a.level === 'red').length);
	const cautionCount = $derived(alerts.filter((a) => a.level === 'yellow').length);

	function onFilter(region: string | null, level: Level) {
		filterRegion = region;
		filterLevel = level;
	}

	// TẠM: poll mỗi 3s cho demo (tăng lại 60_000 khi không cần cập nhật gần-tức-thời).
	$effect(() => {
		const id = setInterval(async () => {
			polled = await fetchAlertHistory(fetch);
		}, 3000);
		return () => clearInterval(id);
	});
</script>

<svelte:head><title>Alerts — ForestGump</title></svelte:head>

<AppShell>
	<div class="mb-8">
		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			Alerts
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			{dangerCount} danger · {cautionCount} caution events recorded. Newest first — tap a row to open
			the station.
		</p>
	</div>

	<div class="mb-6">
		<AlertFilter regions={HAI_PHONG_REGIONS} {onFilter} />
	</div>

	<AlertList events={filtered} />
</AppShell>
