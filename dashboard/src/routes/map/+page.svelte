<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { HOTSPOT_REGIONS, type DienBienHotspot } from '$lib/dienbien-hotspots';
	import AppShell from '$lib/components/app-shell.svelte';
	import DienBienMap from '$lib/components/map/dien-bien-map.svelte';

	let selectedRegion = $state<DienBienHotspot | null>(null);

	function selectRegion(id: number) {
		const r = HOTSPOT_REGIONS.find((r) => r.id === id) ?? null;
		selectedRegion = r;
	}
	function backToOverview() {
		selectedRegion = null;
	}
</script>

<svelte:head><title>Map — Điện Biên — ForestGump</title></svelte:head>

<AppShell>
	<div class="mb-6">
		<nav class="mb-3 flex items-center gap-1.5 text-sm text-gray-400">
			<button
				type="button"
				onclick={backToOverview}
				class={clsx(
					'transition hover:text-gray-600',
					!selectedRegion && 'font-semibold text-gray-900'
				)}
			>
				Điện Biên
			</button>
			{#if selectedRegion}
				<span aria-hidden="true">›</span>
				<span class="font-semibold text-gray-900">{selectedRegion.name}</span>
			{/if}
		</nav>

		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			{selectedRegion ? selectedRegion.name : 'Điện Biên'}
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			{#if !selectedRegion}
				Chọn một khu vực tại Điện Biên để xem chi tiết.
			{:else}
				Khu vực {selectedRegion.name} — mã vùng {selectedRegion.id}.
			{/if}
		</p>
	</div>

	{#if !selectedRegion}
		<DienBienMap regions={HOTSPOT_REGIONS} onSelect={selectRegion} />
	{:else}
		<div class={clsx(CARD, 'flex items-center justify-center p-12 text-center')}>
			<div>
				<p class="text-lg font-semibold text-gray-900">{selectedRegion.name}</p>
				<p class="mt-1 text-sm text-gray-500">Mã vùng: {selectedRegion.id}</p>
			</div>
		</div>
	{/if}
</AppShell>
