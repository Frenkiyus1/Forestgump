<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import AppShell from '$lib/components/app-shell.svelte';
	import RegionHazardHeatmap from '$lib/components/map/region-hazard-heatmap.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const anchorEntry = $derived(
		data.forecastEntries.find((e) => e.location.name === 'Xã Tủa Chùa') ?? null
	);
</script>

<svelte:head><title>Xã Tủa Chùa — SaliGuard</title></svelte:head>

<AppShell>
	<nav class="mb-3 flex items-center gap-1.5 text-sm text-gray-400">
		<a href={resolve('/map')} class="transition hover:text-gray-600"> Điện Biên </a>
		<span aria-hidden="true">›</span>
		<span class="font-semibold text-gray-900">Xã Tủa Chùa</span>
	</nav>

	<h1
		class="text-4xl leading-tight font-semibold tracking-tight"
		style="font-family: 'Lora', serif;"
	>
		Xã Tủa Chùa
	</h1>
	<p class="mt-2 text-[15px] text-gray-500">
		Bản đồ chi tiết khu vực Xã Tủa Chùa — huyện Điện Biên Phủ.
	</p>

	<div class={clsx(CARD, 'relative mt-6 overflow-hidden p-0')}>
		<img
			src="/tua-chua/map.png"
			alt="Bản đồ Tủa Chùa"
			class="block h-auto w-full select-none"
			draggable="false"
		/>
	</div>

	{#if anchorEntry}
		<div class={clsx(CARD, 'mt-6 p-6')}>
			<RegionHazardHeatmap entry={anchorEntry} />
		</div>
	{:else}
		<div class={clsx(CARD, 'mt-6 p-8 text-center text-gray-500')}>
			Không có dữ liệu dự báo cho khu vực này.
		</div>
	{/if}
</AppShell>
