<script module lang="ts">
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
	import DataSourceNote from './data-source-note.svelte';

	interface Props {
		regions: DienBienHotspot[];
		onSelect: (id: number) => void;
		heat?: Map<number, RegionHeat> | null;
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
		if (!region) return;

		selectedId = id;
		if (HAZARD_HEATMAP_ANCHOR_NAMES.has(region.name)) {
			const [cx, cy] = region.centroid;
			const cxPct = (cx / 926) * 100;
			const cyPct = (cy / 1178) * 100;
			zoomingRegionId = id;
			zoomStyle = `transform: translate(calc(50% - ${cxPct * ZOOM_SCALE}%), calc(50% - ${cyPct * ZOOM_SCALE}%)) scale(${ZOOM_SCALE}); transform-origin: 0 0; transition: transform ${ZOOM_DURATION_MS}ms ease-in-out;`;
			setTimeout(() => {
				onSelect(id);
				zoomingRegionId = null;
			}, ZOOM_DURATION_MS);
			return;
		}

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

	// Tooltip pin neo theo góc (left/top HOẶC right/bottom) tuỳ vùng đang trỏ
	// nằm nửa nào của bản đồ — luôn "mở" về phía tâm bản đồ, không tràn ra
	// ngoài card (card có overflow-hidden để cắt ảnh khi zoom). Chỉ dùng %
	// đơn thuần (như trước) sẽ bị cắt/che mất ở rìa phải/dưới vì tooltip neo
	// bằng góc trên-trái nhưng lại rộng tới 260px.
	const pinXPct = $derived(pinPos ? (pinPos.x / 926) * 100 : 0);
	const pinYPct = $derived(pinPos ? (pinPos.y / 1178) * 100 : 0);
	const pinAnchorRight = $derived(pinXPct > 55);
	const pinAnchorBottom = $derived(pinYPct > 60);
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,26rem)]">
	<div class={clsx(CARD, 'relative w-full overflow-hidden rounded-2xl p-0')} style="height: 80vh;">
		<div class="relative h-full w-full touch-none select-none">
			<div
				class="h-full w-full"
				style={zoomingRegionId
					? zoomStyle
					: ''}
			>
				<img
					src="/dienbien-map.png"
					alt="Bản đồ Điện Biên"
					class="pointer-events-none block h-full w-full object-contain select-none"
					draggable="false"
				/>
				<svg
					viewBox={MAP_VIEWBOX}
					preserveAspectRatio="xMidYMid meet"
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
						class="pointer-events-none absolute z-30"
						style={`${pinAnchorRight ? `right: ${100 - pinXPct}%;` : `left: ${pinXPct}%;`} ${pinAnchorBottom ? `bottom: ${100 - pinYPct}%;` : `top: ${pinYPct}%;`}`}
					>
					<div
						class="min-w-[160px] max-w-[260px] rounded-xl bg-slate-900/95 px-3 py-2 text-[15px] text-white shadow-xl"
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
									<span class="text-[15px] font-semibold">{ALERT_LABEL[pinHeat.alertLevel]}</span>
								</div>
								{#if pinHeat.isAnchor}
									<p class="mt-1 text-[15px] text-emerald-300">● Dữ liệu đo thật</p>
								{:else}
									<p class="mt-1 text-[15px] text-white/60">
										○ Ước tính theo vùng địa hình{pinHeat.confidence === 'low'
											? ' (độ tin cậy thấp)'
											: ''}
									</p>
								{/if}
								{#if pinHeat.weather}
									<dl
										class="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-white/15 pt-1.5 text-[15px] text-white/85"
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
					</div>
				{/if}
			</div>
		</div>

		{#if heat}
			<div
				class="pointer-events-none absolute left-3 bottom-3 z-20 rounded-xl bg-white/95 px-3 py-2 text-[15px] shadow-lg"
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
		{/if}
	</div>

	<aside class="flex min-h-0 flex-col gap-1 self-start" style="max-height: calc(100vh - 230px); min-height: 420px;">
		<input
			type="text"
			placeholder="Tìm xã/phường…"
			autocomplete="off"
			bind:value={searchQuery}
			class="w-full shrink-0 rounded border border-gray-200 px-1.5 py-1 text-[15px]"
		/>

		<div class="flex min-h-0 flex-1 flex-col gap-px overflow-auto">
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
						'flex items-center gap-2 rounded border-0 px-3 py-1.5 text-left text-[15px] transition',
						selectedId === region.id
							? 'bg-amber-100 text-amber-800'
							: 'bg-gray-50 hover:bg-amber-100 hover:text-amber-800'
					)}
				>
					{#if regionHeat}
						<span
							class="h-3 w-3 shrink-0 rounded-full"
							style="background-color: {ALERT_HEX[regionHeat.alertLevel]}"
							aria-hidden="true"
						></span>
					{/if}
					<span>{region.id}. {region.name}</span>
				</button>
			{/each}
		</div>

		<p class="shrink-0 text-[15px] text-gray-500">
			Bấm vào vùng trên bản đồ hoặc danh sách.
		</p>
	</aside>
</div>

{#if selectedAnchorEntry}
	<div class={clsx(CARD, 'mt-6 p-6')}>
		<RegionHazardHeatmap entry={selectedAnchorEntry} />
	</div>
{/if}

<DataSourceNote {forecastEntries} />