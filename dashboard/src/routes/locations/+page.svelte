<script lang="ts">
	import type { PageData } from './$types';
	import AppShell from '$lib/components/app-shell.svelte';
	import LocationGrid from '$lib/components/locations/location-grid.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Khu vực — ForestGump</title></svelte:head>

<AppShell>
	<div class="mb-8">
		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			Khu vực
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			Theo dõi {data.details.length} khu vực tại Điện Biên — mỗi nơi một loại hình thái nguy hiểm đặc
			trưng.
		</p>
	</div>

	<LocationGrid details={data.details} />
</AppShell>
