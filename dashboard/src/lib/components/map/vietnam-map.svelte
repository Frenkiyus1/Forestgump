<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import type { RegionKey, VietnamRegion } from '$lib/vietnam-regions';
	import { VN_CUT1, VN_CUT2, VN_MAINLAND, VN_ISLANDS, VN_NEIGHBOURS } from '$lib/vietnam-geo';

	interface Props {
		regions: VietnamRegion[];
		onSelect: (key: RegionKey) => void;
	}
	let { regions, onSelect }: Props = $props();

	let hoveredKey = $state<RegionKey | null>(null);

	// Canvas is wider than the projected mainland (which ends at x≈320) so the
	// far-offshore archipelagos have sea to sit in on the right.
	const MAP_W = 440;

	// Real Vietnam coastline (Natural Earth 50m) sliced into 3 latitude bands.
	// Each band is a full-width rect clipped to the country outline, so the
	// clickable region carries the accurate coastline yet the cut between
	// regions is a clean horizontal line. Clipping also gates hit-testing —
	// clicks land only on the country, not the surrounding sea.
	const BANDS: Record<RegionKey, { y: number; h: number }> = {
		bac: { y: 0, h: VN_CUT1 },
		trung: { y: VN_CUT1, h: VN_CUT2 - VN_CUT1 },
		nam: { y: VN_CUT2, h: 620 - VN_CUT2 }
	};

	// Region name anchor points (viewBox coords), centred over each band.
	const REGION_LABEL: Record<RegionKey, { x: number; y: number }> = {
		bac: { x: 140, y: 82 },
		trung: { x: 226, y: 300 },
		nam: { x: 190, y: 548 }
	};

	// Non-interactive place labels (countries over land, seas over water).
	const PLACE_LABELS = [
		{ text: 'TRUNG QUỐC', x: 104, y: 20, tone: 'land' as const, rot: 0 },
		{ text: 'LÀO', x: 96, y: 236, tone: 'land' as const, rot: 0 },
		{ text: 'THÁI LAN', x: 34, y: 356, tone: 'land' as const, rot: 0 },
		{ text: 'CAM-PU-CHIA', x: 66, y: 452, tone: 'land' as const, rot: 0 },
		{ text: 'BIỂN ĐÔNG', x: 350, y: 400, tone: 'sea' as const, rot: 90 },
		{ text: 'VỊNH BẮC BỘ', x: 322, y: 150, tone: 'sea' as const, rot: 90 },
		{ text: 'VỊNH THÁI LAN', x: 58, y: 596, tone: 'sea' as const, rot: 0 }
	];

	// Hoàng Sa (Đà Nẵng) & Trường Sa (Khánh Hòa): far offshore in the Biển Đông,
	// outside the admin dataset — drawn as Việt Nam-territory island clusters at
	// their (compressed) real bearing east / south-east of the mainland. Phú Quốc
	// is a real coastal island already in VN_ISLANDS (SW gulf) — just labelled.
	const HOANG_SA = [
		{ x: 360, y: 240, r: 2.2 },
		{ x: 368, y: 235, r: 1.7 },
		{ x: 375, y: 241, r: 2 },
		{ x: 363, y: 247, r: 1.6 },
		{ x: 371, y: 249, r: 2.1 },
		{ x: 379, y: 247, r: 1.6 },
		{ x: 366, y: 255, r: 1.9 },
		{ x: 374, y: 257, r: 1.7 },
		{ x: 358, y: 251, r: 1.4 },
		{ x: 381, y: 239, r: 1.5 }
	];
	const TRUONG_SA = [
		{ x: 374, y: 478, r: 1.8 },
		{ x: 366, y: 488, r: 1.5 },
		{ x: 380, y: 486, r: 2 },
		{ x: 386, y: 496, r: 1.6 },
		{ x: 376, y: 500, r: 1.7 },
		{ x: 392, y: 502, r: 2 },
		{ x: 384, y: 510, r: 1.5 },
		{ x: 398, y: 512, r: 1.7 },
		{ x: 390, y: 520, r: 1.9 },
		{ x: 402, y: 522, r: 1.5 },
		{ x: 396, y: 530, r: 1.8 },
		{ x: 408, y: 528, r: 1.6 },
		{ x: 386, y: 536, r: 1.5 },
		{ x: 400, y: 542, r: 1.9 },
		{ x: 412, y: 540, r: 1.6 },
		{ x: 404, y: 552, r: 1.7 },
		{ x: 416, y: 550, r: 1.5 },
		{ x: 394, y: 558, r: 1.6 },
		{ x: 408, y: 564, r: 1.8 },
		{ x: 420, y: 560, r: 1.4 }
	];

	// Territory labels (amber = Việt Nam sovereignty), not interactive.
	const TERRITORY_LABELS = [
		{ text: 'HOÀNG SA', x: 369, y: 220 },
		{ text: 'TRƯỜNG SA', x: 404, y: 462 },
		{ text: 'PHÚ QUỐC', x: 92, y: 556 }
	];

	function select(key: RegionKey) {
		onSelect(key);
	}
	function onKeydown(e: KeyboardEvent, key: RegionKey) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select(key);
		}
	}
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
	<div
		class={clsx(
			'border border-black/4 bg-white shadow-[0_1px_2px_rgba(31,25,16,0.04),0_18px_40px_-24px_rgba(31,25,16,0.22)]',
			'mx-auto w-full max-w-85 self-start p-2'
		)}
	>
		<svg viewBox="0 0 {MAP_W} 620" class="h-auto w-full" role="group" aria-label="Bản đồ Việt Nam">
			<defs>
				<clipPath id="vn-clip">
					<path d={VN_MAINLAND} />
					<path d={VN_ISLANDS} />
				</clipPath>
			</defs>

			<!-- Biển (Biển Đông + các vịnh) -->
			<rect x="0" y="0" width={MAP_W} height="620" fill="#d7e8f0" />

			<!-- Quốc gia lân cận: KHÔNG bấm được (xám nhạt) -->
			<g fill="#e6e5dd" stroke="#d0cfc3" stroke-width="0.8" class="pointer-events-none">
				<path d={VN_NEIGHBOURS.china} />
				<path d={VN_NEIGHBOURS.thailand} />
				<path d={VN_NEIGHBOURS.cambodia} />
				<path d={VN_NEIGHBOURS.laos} />
			</g>

			<!-- Việt Nam: 3 miền bấm được (rect cắt theo đường bờ biển thật) -->
			<g clip-path="url(#vn-clip)">
				{#each regions as region (region.key)}
					{@const band = BANDS[region.key]}
					<rect
						x="0"
						y={band.y}
						width={MAP_W}
						height={band.h}
						role="button"
						tabindex="0"
						aria-label="Chọn {region.name}"
						onclick={() => select(region.key)}
						onkeydown={(e) => onKeydown(e, region.key)}
						onmouseenter={() => (hoveredKey = region.key)}
						onmouseleave={() => (hoveredKey = null)}
						onfocus={() => (hoveredKey = region.key)}
						onblur={() => (hoveredKey = null)}
						class="cursor-pointer outline-none transition-colors duration-150"
						fill={hoveredKey === region.key ? 'var(--color-accent)' : 'var(--color-accent-soft)'}
					/>
				{/each}
				<!-- Ranh giới giữa các miền (mảnh, không tương tác) -->
				<line x1="0" y1={VN_CUT1} x2={MAP_W} y2={VN_CUT1} stroke="#fff" stroke-width="1.2" />
				<line x1="0" y1={VN_CUT2} x2={MAP_W} y2={VN_CUT2} stroke="#fff" stroke-width="1.2" />
			</g>

			<!-- Viền đất liền + đảo (trang trí, không tương tác) -->
			<path
				d={VN_MAINLAND}
				fill="none"
				stroke="#e08a12"
				stroke-width="0.9"
				class="pointer-events-none"
			/>
			<path d={VN_ISLANDS} fill="#f3b24a" class="pointer-events-none" />

			<!-- Hoàng Sa & Trường Sa: quần đảo của Việt Nam (không tương tác) -->
			<g fill="#f3b24a" class="pointer-events-none">
				{#each HOANG_SA as d (d.x + '-' + d.y)}
					<circle cx={d.x} cy={d.y} r={d.r} />
				{/each}
				{#each TRUONG_SA as d (d.x + '-' + d.y)}
					<circle cx={d.x} cy={d.y} r={d.r} />
				{/each}
			</g>

			<!-- Nhãn quần đảo / đảo thuộc Việt Nam -->
			{#each TERRITORY_LABELS as label (label.text)}
				<text
					x={label.x}
					y={label.y}
					text-anchor="middle"
					class="pointer-events-none select-none"
					font-size="9"
					letter-spacing="0.6"
					font-weight="600"
					fill="#c07d16"
				>
					{label.text}
				</text>
			{/each}

			<!-- Nhãn quốc gia / biển -->
			{#each PLACE_LABELS as label (label.text)}
				<text
					x={label.x}
					y={label.y}
					text-anchor="middle"
					class="pointer-events-none select-none"
					font-size={label.tone === 'sea' ? 10 : 11}
					letter-spacing="0.8"
					fill={label.tone === 'sea' ? '#8fb3c6' : '#a7a699'}
					transform={label.rot ? `rotate(${label.rot} ${label.x} ${label.y})` : ''}
				>
					{label.text}
				</text>
			{/each}

			<!-- Nhãn 3 miền -->
			{#each regions as region (region.key)}
				{@const pos = REGION_LABEL[region.key]}
				<text
					x={pos.x}
					y={pos.y}
					text-anchor="middle"
					class="pointer-events-none select-none"
					font-size="12.5"
					font-weight="600"
					fill={hoveredKey === region.key ? '#3a2c05' : '#7a5a10'}
					style="paint-order: stroke; stroke: #fff; stroke-width: 3px;"
				>
					{region.name}
				</text>
			{/each}
		</svg>
	</div>

	<ul class="flex flex-col gap-2">
		{#each regions as region (region.key)}
			<li>
				<button
					type="button"
					onclick={() => select(region.key)}
					onmouseenter={() => (hoveredKey = region.key)}
					onmouseleave={() => (hoveredKey = null)}
					onfocus={() => (hoveredKey = region.key)}
					onblur={() => (hoveredKey = null)}
					class={clsx(
						CARD,
						'flex w-full items-center gap-4 px-5 py-4 text-left transition',
						hoveredKey === region.key && 'ring-1 ring-accent'
					)}
				>
					<div class="min-w-0 flex-1">
						<p class="text-base font-semibold tracking-tight text-gray-900">{region.name}</p>
						<p class="mt-0.5 text-sm text-gray-500">{region.blurb}</p>
						<p class="mt-1.5 text-xs font-medium text-gray-400">
							{region.provinces.length} tỉnh/thành nhiễm mặn chính
						</p>
					</div>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5 shrink-0 text-gray-300"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</li>
		{/each}
	</ul>
</div>
