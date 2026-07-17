<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { MAP_VIEWBOX, type DienBienHotspot } from '$lib/dienbien-hotspots';

	interface Props {
		regions: DienBienHotspot[];
		onSelect: (id: number) => void;
	}
	let { regions, onSelect }: Props = $props();

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

	function select(id: number) {
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
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,14rem)]">
	<div
		class={clsx(
			CARD,
			'relative overflow-hidden p-0'
		)}
	>
		<div class="relative">
			<img
				src="/dienbien-map.png"
				alt="Bản đồ Điện Biên"
				class="block w-full h-auto select-none"
				draggable="false"
			/>
			<svg
				viewBox={MAP_VIEWBOX}
				class="absolute inset-0 w-full h-full"
				role="group"
				aria-label="Bản đồ tương tác Điện Biên"
			>
				{#each regions as region (region.id)}
					<path
						d={region.path}
						class="cursor-pointer outline-none transition-colors duration-150"
						fill={hoveredId === region.id || selectedId === region.id
							? 'rgba(243,178,74,0.12)'
							: 'rgba(243,178,74,0.03)'}
						stroke={hoveredId === region.id || selectedId === region.id
							? 'rgba(224,138,18,0.8)'
							: 'rgba(224,138,18,0.2)'}
						stroke-width="1.25"
						vector-effect="non-scaling-stroke"
						role="button"
						tabindex="0"
						aria-label={region.name}
						onclick={() => select(region.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(region.id); }
						}}
						onmouseenter={() => { hoverRegion(region.id); showPin(region); }}
						onmouseleave={() => { hoverRegion(null); hidePin(); }}
						onfocus={() => { hoverRegion(region.id); showPin(region); }}
						onblur={() => { hoverRegion(null); hidePin(); }}
					/>
				{/each}
			</svg>

			{#if pinPos}
				<div
					class="pointer-events-none absolute z-10 min-w-[140px] max-w-[200px] rounded-xl bg-[rgba(17,24,39,0.92)] px-3 py-2 text-sm text-white shadow-xl"
					style="left: {(pinPos.x / 926) * 100}%; top: {(pinPos.y / 1178) * 100}%; transform: translate(-50%, -120%)"
				>
					<small class="block text-amber-200">
						{selectedRegion?.id === hoveredId || (!selectedRegion && hoveredId)
							? `Đơn vị số ${hoveredId}`
							: selectedRegion
								? `Đơn vị số ${selectedRegion.id}`
								: ''}
					</small>
					<strong class="block text-white">
						{regions.find((r) => r.id === (hoveredId ?? selectedId))?.name ?? ''}
					</strong>
				</div>
			{/if}

			<div class="absolute bottom-3 left-3 rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-bold text-[#92400e]">
				Bản đồ bấm theo từng vùng
			</div>
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
			</div>
		{/if}

		<input
			type="text"
			placeholder="Tìm theo tên xã/phường…"
			autocomplete="off"
			bind:value={searchQuery}
			class="w-full rounded-xl border border-[#d0d7e2] px-3 py-2.5 text-sm"
		/>

		<div class="flex flex-col gap-1.5 overflow-auto max-h-[60vh]">
			{#each filteredRegions as region (region.id)}
				<button
					type="button"
					onclick={() => select(region.id)}
					onmouseenter={() => { hoverRegion(region.id); showPin(region); }}
					onmouseleave={() => { hoverRegion(null); hidePin(); }}
					onfocus={() => { hoverRegion(region.id); showPin(region); }}
					onblur={() => { hoverRegion(null); hidePin(); }}
					class={clsx(
						'rounded-xl border-0 px-3 py-2.5 text-left text-sm transition',
						selectedId === region.id
							? 'bg-[#fef3c7] text-[#92400e]'
							: 'bg-[#f7f9fc] hover:bg-[#fef3c7] hover:text-[#92400e]'
					)}
				>
					{region.id}. {region.name}
				</button>
			{/each}
		</div>

		<p class="text-xs text-[#667085]">
			Các vùng bấm được bo theo biên hiển thị trên ảnh. Bấm vào từng vùng để chọn.
		</p>
	</aside>
</div>
