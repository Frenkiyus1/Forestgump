<script lang="ts">
	import { untrack } from 'svelte';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { HOTSPOT_REGIONS, type DienBienHotspot } from '$lib/dienbien-hotspots';
	import { ALERT_BADGE, ALERT_LABEL } from '$lib/alert-ui';
	import {
		DIENBIEN_HAZARD_LABEL,
		buildRegionHeat,
		pickDefaultHazard,
		availableDays
	} from '$lib/dienbien-heatmap';
	import type { DienBienHazard } from '$lib/types';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/app-shell.svelte';
	import DienBienMap, {
		HAZARD_HEATMAP_ANCHOR_NAMES
	} from '$lib/components/map/dien-bien-map.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedRegion = $state<DienBienHotspot | null>(null);
	let selectedHazard = $state<DienBienHazard>(
		untrack(() => pickDefaultHazard(data.forecastEntries))
	);
	let selectedDayIndex = $state(0);

	const days = $derived(availableDays(data.forecastEntries));
	const heat = $derived(
		buildRegionHeat(HOTSPOT_REGIONS, data.forecastEntries, selectedHazard, selectedDayIndex)
	);
	const selectedHeat = $derived(selectedRegion ? (heat.get(selectedRegion.id) ?? null) : null);

	const HAZARDS: DienBienHazard[] = ['cold_damage', 'heavy_rain_flood', 'fog'];

	function selectRegion(id: number) {
		const r = HOTSPOT_REGIONS.find((r) => r.id === id) ?? null;
		if (r && HAZARD_HEATMAP_ANCHOR_NAMES.has(r.name)) {
			const slug =
				r.name === 'Phường Điện Biên Phủ'
					? 'dien-bien-phu'
					: r.name === 'Xã Mường Nhé'
						? 'muong-nhe'
						: 'tua-chua';
			goto(resolve(`/map/${slug}`));
			return;
		}
		selectedRegion = r;
	}
	function backToOverview() {
		selectedRegion = null;
	}
	function formatDay(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
	}
</script>

<svelte:head><title>Map — Điện Biên — ForestGump</title></svelte:head>

<AppShell>
	{#if data.apiError}
		<div
			class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
		>
			<p class="font-medium">
				Chưa kết nối được backend — đang hiển thị bản đồ ở chế độ mặc định (xanh lá).
			</p>
			<p class="mt-1 text-amber-700">{data.apiError}</p>
		</div>
	{/if}

	<div class="mb-3">
		<nav class="mb-1 flex items-center gap-1.5 text-sm text-gray-400">
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
			class="text-2xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			{selectedRegion ? selectedRegion.name : 'Điện Biên'}
		</h1>
		<p class="mt-1 text-sm text-gray-500">
			{#if !selectedRegion}
				Chọn một khu vực tại Điện Biên để xem chi tiết, hoặc đổi hiểm hoạ/ngày để xem heatmap
				cảnh báo.
			{:else}
				Khu vực {selectedRegion.name} — mã vùng {selectedRegion.id}.
			{/if}
		</p>
	</div>

	<div class="mb-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
			<div class="flex flex-wrap gap-1.5" role="group" aria-label="Chọn loại hiểm hoạ">
				{#each HAZARDS as hazard (hazard)}
					<button
						type="button"
						onclick={() => (selectedHazard = hazard)}
						aria-pressed={selectedHazard === hazard}
						class={clsx(
							'rounded-full px-3 py-1.5 text-xs font-medium transition',
							selectedHazard === hazard
								? 'bg-gray-900 text-white'
								: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
						)}
					>
						{DIENBIEN_HAZARD_LABEL[hazard]}
					</button>
				{/each}
			</div>

			{#if days.length}
				<div class="hidden h-5 w-px shrink-0 bg-gray-200 sm:block" aria-hidden="true"></div>
				<div class="flex flex-wrap gap-1" role="group" aria-label="Chọn ngày dự báo">
					{#each days as day, i (day)}
						<button
							type="button"
							onclick={() => (selectedDayIndex = i)}
							aria-pressed={selectedDayIndex === i}
							class={clsx(
								'rounded-lg px-2.5 py-1 text-[11px] font-medium transition',
								selectedDayIndex === i
									? 'bg-accent text-white'
									: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
							)}
						>
							{formatDay(day)}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="min-h-0 flex-1 overflow-auto">
			{#if !selectedRegion}
				<DienBienMap
					regions={HOTSPOT_REGIONS}
					onSelect={selectRegion}
					{heat}
					forecastEntries={data.forecastEntries}
				/>
			{:else}
				<div class={clsx(CARD, 'h-full overflow-auto p-8')}>
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p class="text-lg font-semibold text-gray-900">{selectedRegion.name}</p>
							<p class="mt-1 text-sm text-gray-500">Mã vùng: {selectedRegion.id}</p>
						</div>
						{#if selectedHeat}
							<span
								class={clsx(
									'rounded-full px-3 py-1 text-sm font-semibold',
									ALERT_BADGE[selectedHeat.alertLevel]
								)}
							>
								{ALERT_LABEL[selectedHeat.alertLevel]} — {DIENBIEN_HAZARD_LABEL[selectedHazard]}
							</span>
						{/if}
					</div>

					{#if selectedHeat}
						<div class="mt-4 text-sm text-gray-600">
							{#if selectedHeat.isAnchor}
								<p class="font-medium text-emerald-700">● Dữ liệu đo thật tại địa điểm này.</p>
							{:else}
								<p>
									○ Ước tính theo vùng địa hình từ dữ liệu đo tại
									<strong>{selectedHeat.sourceAnchorName ?? '—'}</strong>
									— độ tin cậy phân loại địa hình:
									<strong>{selectedHeat.confidence}</strong>.
								</p>
							{/if}
							{#if selectedHeat.detail}
								<p class="mt-2">{selectedHeat.detail}</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>

</AppShell>
