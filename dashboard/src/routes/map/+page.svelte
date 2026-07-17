<script lang="ts">
	import type { PageData } from './$types';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { VIETNAM_REGIONS, type RegionKey } from '$lib/vietnam-regions';
	import AppShell from '$lib/components/app-shell.svelte';
	import VietnamMap from '$lib/components/map/vietnam-map.svelte';
	import ProvinceList from '$lib/components/map/province-list.svelte';
	import ProvinceEmptyState from '$lib/components/map/province-empty-state.svelte';
	import StationMap from '$lib/components/map/station-map.svelte';
	import MapSidebar from '$lib/components/map/map-sidebar.svelte';
	import MapLegend from '$lib/components/map/map-legend.svelte';

	let { data }: { data: PageData } = $props();

	// Shared hover/focus state links the sidebar list to the map markers.
	let focusId = $state<string | null>(null);

	// Mọi trạm đều hiển thị — vị trí trên map (station-map.svelte) được rải
	// theo đúng nhánh sông (river) của từng trạm, không còn phụ thuộc lon/lat
	// nên không cần ẩn trạm đặt sai chỗ như trước nữa.
	const shownStations = $derived(data.stations);

	// Drill-down: Việt Nam → miền → tỉnh/thành. Only Hải Phòng has a real
	// station map wired up today; every other province is a display-only
	// placeholder until hardware ships there.
	let selectedRegionKey = $state<RegionKey | null>(null);
	let selectedProvince = $state<string | null>(null);
	const selectedRegion = $derived(VIETNAM_REGIONS.find((r) => r.key === selectedRegionKey) ?? null);

	function selectRegion(key: RegionKey) {
		selectedRegionKey = key;
		selectedProvince = null;
	}
	function selectProvince(name: string) {
		selectedProvince = name;
	}
	function backToVietnam() {
		selectedRegionKey = null;
		selectedProvince = null;
	}
	function backToRegion() {
		selectedProvince = null;
	}
</script>

<svelte:head><title>Map — SaliGuard</title></svelte:head>

<AppShell>
	<div class="mb-6">
		<nav class="mb-3 flex items-center gap-1.5 text-sm text-gray-400">
			<button
				type="button"
				onclick={backToVietnam}
				class={clsx(
					'transition hover:text-gray-600',
					!selectedRegion && 'font-semibold text-gray-900'
				)}
			>
				Việt Nam
			</button>
			{#if selectedRegion}
				<span aria-hidden="true">›</span>
				<button
					type="button"
					onclick={backToRegion}
					class={clsx(
						'transition hover:text-gray-600',
						!selectedProvince && 'font-semibold text-gray-900'
					)}
				>
					{selectedRegion.name}
				</button>
			{/if}
			{#if selectedProvince}
				<span aria-hidden="true">›</span>
				<span class="font-semibold text-gray-900">{selectedProvince}</span>
			{/if}
		</nav>

		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			Map
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			{#if !selectedRegion}
				Chọn một miền để xem các tỉnh/thành đang bị ảnh hưởng bởi xâm nhập mặn.
			{:else if !selectedProvince}
				Chọn một tỉnh/thành trong {selectedRegion.name} để xem vị trí thiết bị dự kiến.
			{:else if selectedProvince === 'Hải Phòng'}
				{shownStations.length} field stations across the Hải Phòng estuary. Hover a marker for details,
				click to open the station.
			{:else}
				Khu vực nằm trong kế hoạch mở rộng, chưa có trạm phần cứng.
			{/if}
		</p>
	</div>

	{#if !selectedRegion}
		<VietnamMap regions={VIETNAM_REGIONS} onSelect={selectRegion} />
	{:else if !selectedProvince}
		<ProvinceList region={selectedRegion} onSelect={selectProvince} />
	{:else if selectedProvince === 'Hải Phòng'}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
			<div class="flex flex-col gap-4">
				<MapSidebar
					stations={shownStations}
					selectedId={focusId}
					onHover={(id) => (focusId = id)}
				/>
				<MapLegend />
			</div>

			<div class={clsx(CARD, 'h-[70vh] min-h-[420px] overflow-hidden p-3')}>
				<StationMap stations={shownStations} {focusId} />
			</div>
		</div>
	{:else}
		<ProvinceEmptyState province={selectedProvince} />
	{/if}
</AppShell>
