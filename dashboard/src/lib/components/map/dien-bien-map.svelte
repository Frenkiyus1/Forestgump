<script module lang="ts">
	/**
	 * Cả 3 anchor có dữ liệu đo thật (khớp DienBienForecastEntry.location.name,
	 * tức tên hành chính hiện hành trong backend/src/config/locations.ts) đều
	 * thuộc phạm vi tính năng heatmap hiểm hoạ theo ngày — trước đây Mường Nhé
	 * bị bỏ sót khỏi danh sách này dù buildRegionHeat() vẫn coi nó là anchor
	 * (isAnchor: true), khiến bấm vào Mường Nhé không hiện heatmap như 2 anchor
	 * còn lại và không khớp caption "Mường Nhé, Tủa Chùa, Điện Biên Phủ" ở
	 * routes/map/+page.svelte.
	 */
	export const HAZARD_HEATMAP_ANCHOR_NAMES: ReadonlySet<string> = new Set([
		'Xã Tủa Chùa',
		'Phường Điện Biên Phủ',
		'Xã Mường Nhé'
	]);
</script>

<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { MAP_VIEWBOX, type DienBienHotspot } from '$lib/dienbien-hotspots';
	import { ALERT_HEX, ALERT_LABEL } from '$lib/alert-ui';
	import type { RegionHeat } from '$lib/dienbien-heatmap';
	import type { DienBienForecastEntry } from '$lib/types';
	import RegionHazardHeatmap from './region-hazard-heatmap.svelte';

	interface Props {
		regions: DienBienHotspot[];
		onSelect: (id: number) => void;
		/** Màu cảnh báo theo từng vùng (hazard + ngày đang chọn) — null khi chưa có dữ liệu. */
		heat?: Map<number, RegionHeat> | null;
		/** Dự báo đầy đủ theo anchor — dùng để vẽ heatmap hiểm hoạ khi chọn 1 trong 3 anchor
		 * thuộc phạm vi (xem HAZARD_HEATMAP_ANCHOR_NAMES). */
		forecastEntries?: DienBienForecastEntry[];
	}
	let { regions, onSelect, heat = null, forecastEntries = [] }: Props = $props();

	let hoveredId = $state<number | null>(null);
	let selectedId = $state<number | null>(null);
	let searchQuery = $state('');
	let pinPos = $state<{ x: number; y: number } | null>(null);

	const filteredRegions = $derived(
		searchQuery
			? regions.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: regions
	);

	const selectedRegion = $derived(regions.find((r) => r.id === selectedId) ?? null);
	const pinRegionId = $derived(hoveredId ?? selectedId);
	const pinRegion = $derived(regions.find((r) => r.id === pinRegionId) ?? null);
	const pinHeat = $derived(pinRegionId != null ? (heat?.get(pinRegionId) ?? null) : null);

	const entryByName = $derived(new Map(forecastEntries.map((e) => [e.location.name, e])));
	/** Chỉ khác null khi vùng đang chọn là 1 trong 3 anchor thuộc phạm vi heatmap. */
	const selectedAnchorEntry = $derived(
		selectedRegion && HAZARD_HEATMAP_ANCHOR_NAMES.has(selectedRegion.name)
			? (entryByName.get(selectedRegion.name) ?? null)
			: null
	);

	const ZOOM_DURATION_MS = 500;
	const ZOOM_SCALE = 2.5;
	let zoomingRegionId = $state<number | null>(null);
	let zoomStyle = $state<string>('');

	function select(id: number) {
		const region = regions.find((r) => r.id === id);
		if (region && HAZARD_HEATMAP_ANCHOR_NAMES.has(region.name)) {
			const [cx, cy] = region.centroid;
			const cxPct = (cx / 926) * 100;
			const cyPct = (cy / 1178) * 100;
			zoomingRegionId = id;
			selectedId = id;
			zoomStyle = `transform: translate(calc(50% - ${cxPct * ZOOM_SCALE}%), calc(50% - ${cyPct * ZOOM_SCALE}%)) scale(${ZOOM_SCALE}); transform-origin: 0 0; transition: transform ${ZOOM_DURATION_MS}ms ease-in-out;`;
			setTimeout(() => {
				onSelect(id);
				zoomingRegionId = null;
			}, ZOOM_DURATION_MS);
			return;
		}
		selectedId = id;
		onSelect(id);
	}
	function showPin(region: DienBienHotspot) {
		pinPos = { x: region.centroid[0], y: region.centroid[1] };
	}
	function hidePin() {
		if (selectedId === null) {
			pinPos = null;
		} else {
			const r = regions.find((v) => v.id === selectedId);
			if (r) showPin(r);
		}
	}
	function hoverRegion(id: number | null) {
		hoveredId = id;
	}

	/** Fill = 1 opacity cố định, chỉ đổi theo alertLevel (KHÔNG theo độ tin cậy). Độ tin
	 * cậy vẫn thể hiện qua viền: dày hơn cho anchor, nét đứt cho ước tính tin cậy thấp. */
	const REGION_FILL_OPACITY = 0.5;
	const REGION_FILL_OPACITY_ACTIVE = 0.7;

	function regionStyle(region: DienBienHotspot, isActive: boolean) {
		const h = heat?.get(region.id) ?? null;
		if (!h) {
			return {
				fill: isActive ? 'rgba(243,178,74,0.12)' : 'rgba(243,178,74,0.03)',
				stroke: isActive ? 'rgba(224,138,18,0.8)' : 'rgba(224,138,18,0.2)',
				strokeWidth: isActive ? 2 : 1.25,
				dashed: false
			};
		}
		const color = ALERT_HEX[h.alertLevel];
		return {
			fill: hexToRgba(color, isActive ? REGION_FILL_OPACITY_ACTIVE : REGION_FILL_OPACITY),
			stroke: color,
			strokeWidth: h.isAnchor ? (isActive ? 3 : 2.5) : isActive ? 2 : 1.25,
			dashed: h.confidence === 'low'
		};
	}

	function hexToRgba(hex: string, alpha: number): string {
		const n = parseInt(hex.slice(1), 16);
		const r = (n >> 16) & 255;
		const g = (n >> 8) & 255;
		const b = n & 255;
		return `rgba(${r},${g},${b},${alpha})`;
	}
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,14rem)]">
	<div class={clsx(CARD, 'relative overflow-hidden p-0')}>
		<div class="relative" style={zoomingRegionId ? zoomStyle : ''}>
			<img
				src="/dienbien-map.png"
				alt="Bản đồ Điện Biên"
				class="block h-auto w-full select-none"
				draggable="false"
			/>
			<svg
				viewBox={MAP_VIEWBOX}
				class="absolute inset-0 h-full w-full"
				role="group"
				aria-label="Bản đồ tương tác Điện Biên"
			>
				{#each regions as region (region.id)}
					{@const isActive = hoveredId === region.id || selectedId === region.id}
					{@const style = regionStyle(region, isActive)}
					<path
						d={region.path}
						class="cursor-pointer outline-none transition-colors duration-150"
						fill={style.fill}
						stroke={style.stroke}
						stroke-width={style.strokeWidth}
						stroke-dasharray={style.dashed ? '4 3' : undefined}
						vector-effect="non-scaling-stroke"
						role="button"
						tabindex="0"
						aria-label={region.name}
						onclick={() => select(region.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								select(region.id);
							}
						}}
						onmouseenter={() => {
							hoverRegion(region.id);
							showPin(region);
						}}
						onmouseleave={() => {
							hoverRegion(null);
							hidePin();
						}}
						onfocus={() => {
							hoverRegion(region.id);
							showPin(region);
						}}
						onblur={() => {
							hoverRegion(null);
							hidePin();
						}}
					/>
				{/each}
			</svg>

			{#if pinPos && pinRegion}
				<div
					class="pointer-events-none absolute z-10 min-w-[160px] max-w-[260px] rounded-xl bg-[rgba(17,24,39,0.92)] px-3 py-2 text-sm text-white shadow-xl"
					style="left: {(pinPos.x / 926) * 100}%; top: {(pinPos.y / 1178) *
						100}%; transform: translate(-50%, -120%)"
				>
					<small class="block text-amber-200">Đơn vị số {pinRegion.id}</small>
					<strong class="block text-white">{pinRegion.name}</strong>
					{#if pinHeat}
						<div class="mt-1.5 flex items-center gap-1.5">
							<span
								class="h-2 w-2 shrink-0 rounded-full"
								style="background-color: {ALERT_HEX[pinHeat.alertLevel]}"
								aria-hidden="true"
							></span>
							<span class="text-xs font-semibold">{ALERT_LABEL[pinHeat.alertLevel]}</span>
						</div>
						{#if pinHeat.isAnchor}
							<p class="mt-1 text-[11px] text-emerald-300">● Dữ liệu đo thật</p>
						{:else}
							<p class="mt-1 text-[11px] text-white/60">
								○ Ước tính theo vùng địa hình{pinHeat.confidence === 'low'
									? ' (độ tin cậy thấp)'
									: ''}
							</p>
						{/if}
						{#if pinHeat.weather}
							<dl
								class="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-white/15 pt-1.5 text-[11px] text-white/85"
							>
								<dt class="text-white/50">Nhiệt độ</dt>
								<dd>{pinHeat.weather.tempMinC}–{pinHeat.weather.tempMaxC}°C</dd>
								<dt class="text-white/50">Mưa</dt>
								<dd>{pinHeat.weather.precipitationMm} mm</dd>
								<dt class="text-white/50">Độ ẩm</dt>
								<dd>{pinHeat.weather.humidityPct}%</dd>
								<dt class="text-white/50">Gió</dt>
								<dd>{pinHeat.weather.windSpeedKmh} km/h</dd>
							</dl>
						{/if}
					{/if}
				</div>
			{/if}

			{#if heat}
				<div
					class="absolute right-3 bottom-3 rounded-xl bg-[rgba(255,255,255,0.92)] px-3 py-2 text-[11px] shadow-lg"
				>
					<p class="mb-1.5 font-semibold text-gray-700">Chú giải</p>
					<div class="flex flex-col gap-1">
						{#each ['green', 'yellow', 'orange', 'red'] as const as level (level)}
							<div class="flex items-center gap-1.5">
								<span
									class="h-2.5 w-2.5 rounded-full"
									style="background-color: {ALERT_HEX[level]}"
									aria-hidden="true"
								></span>
								<span class="text-gray-600">{ALERT_LABEL[level]}</span>
							</div>
						{/each}
					</div>
					<div class="mt-2 border-t border-gray-200 pt-1.5 text-gray-500">
						<p>━ Viền đậm = đo thật</p>
						<p>┄ Viền đứt = ước tính, tin cậy thấp</p>
					</div>
				</div>
			{:else}
				<div
					class="absolute bottom-3 left-3 rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-bold text-[#92400e]"
				>
					Bản đồ bấm theo từng vùng
				</div>
			{/if}
		</div>
	</div>

	<aside class="flex flex-col gap-3">
		{#if selectedRegion}
			<div class="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
				<small class="block text-[#b45309]">Đang chọn</small>
				<strong class="mt-1 block text-lg">{selectedRegion.name}</strong>
				<div class="mt-1 text-sm text-[#475467]">
					Mã vùng: {selectedRegion.id}
				</div>
				{#if selectedAnchorEntry}
					<p class="mt-1.5 text-xs text-[#b45309]">
						↓ Xem heatmap hiểm hoạ theo ngày bên dưới bản đồ.
					</p>
				{/if}
			</div>
		{/if}

		<input
			type="text"
			placeholder="Tìm theo tên xã/phường…"
			autocomplete="off"
			bind:value={searchQuery}
			class="w-full rounded-xl border border-[#d0d7e2] px-3 py-2.5 text-sm"
		/>

		<div class="flex max-h-[60vh] flex-col gap-1.5 overflow-auto">
			{#each filteredRegions as region (region.id)}
				{@const regionHeat = heat?.get(region.id) ?? null}
				<button
					type="button"
					onclick={() => select(region.id)}
					onmouseenter={() => {
						hoverRegion(region.id);
						showPin(region);
					}}
					onmouseleave={() => {
						hoverRegion(null);
						hidePin();
					}}
					onfocus={() => {
						hoverRegion(region.id);
						showPin(region);
					}}
					onblur={() => {
						hoverRegion(null);
						hidePin();
					}}
					class={clsx(
						'flex items-center gap-2 rounded-xl border-0 px-3 py-2.5 text-left text-sm transition',
						selectedId === region.id
							? 'bg-[#fef3c7] text-[#92400e]'
							: 'bg-[#f7f9fc] hover:bg-[#fef3c7] hover:text-[#92400e]'
					)}
				>
					{#if regionHeat}
						<span
							class="h-2 w-2 shrink-0 rounded-full"
							style="background-color: {ALERT_HEX[regionHeat.alertLevel]}"
							aria-hidden="true"
						></span>
					{/if}
					<span>{region.id}. {region.name}</span>
				</button>
			{/each}
		</div>

		<p class="text-xs text-[#667085]">
			Các vùng bấm được bo theo biên hiển thị trên ảnh. Bấm vào từng vùng để chọn.
		</p>
	</aside>
</div>

{#if selectedAnchorEntry}
	<div class={clsx(CARD, 'mt-6 p-6')}>
		<RegionHazardHeatmap entry={selectedAnchorEntry} />
	</div>
{/if}
