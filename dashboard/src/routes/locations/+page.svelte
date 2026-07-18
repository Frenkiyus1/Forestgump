<script lang="ts">
	import type { PageData } from './$types';
	import AppShell from '$lib/components/app-shell.svelte';
	import LocationGrid from '$lib/components/locations/location-grid.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Khu vực — ForestGump</title></svelte:head>

<AppShell>
	{#if data.apiError}
		<div
			class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
		>
			<p class="font-medium">
				Chưa kết nối được backend — đang hiển thị dữ liệu mặc định (xanh lá).
			</p>
			<p class="mt-1 text-amber-700">{data.apiError}</p>
		</div>
	{/if}

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
