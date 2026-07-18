<script lang="ts">
	import { untrack } from 'svelte';
	import { clsx } from '$lib/clsx';
	import { HOTSPOT_REGIONS } from '$lib/dienbien-hotspots';
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
	import DienBienMap from '$lib/components/map/dien-bien-map.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedHazard = $state<DienBienHazard>(
		untrack(() => pickDefaultHazard(data.forecastEntries))
	);
	let selectedDayIndex = $state(0);

	const days = $derived(availableDays(data.forecastEntries));
	const heat = $derived(
		buildRegionHeat(HOTSPOT_REGIONS, data.forecastEntries, selectedHazard, selectedDayIndex)
	);

	const HAZARDS: DienBienHazard[] = ['cold_damage', 'heavy_rain_flood', 'fog'];

	function selectRegion(id: number) {
		const region = HOTSPOT_REGIONS.find((item) => item.id === id) ?? null;
		if (!region) return;

		goto(resolve(`/map/${String(id)}`));
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

	<div class="mb-4 flex flex-col gap-3">
		<div class="flex flex-wrap items-center gap-2">
			{#each HAZARDS as hazard (hazard)}
				<button
					type="button"
					onclick={() => (selectedHazard = hazard)}
					aria-pressed={selectedHazard === hazard}
					class={clsx(
						'rounded-full px-3 py-1.5 text-sm font-medium transition',
						selectedHazard === hazard
							? 'bg-gray-900 text-white'
							: 'bg-gray-100 text-gray-600 hover:bg-gray-200'
					)}
				>
					{DIENBIEN_HAZARD_LABEL[hazard]}
				</button>
			{/each}

			{#if days.length}
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
			{/if}
		</div>
	</div>

	<DienBienMap
		regions={HOTSPOT_REGIONS}
		onSelect={selectRegion}
		{heat}
		forecastEntries={data.forecastEntries}
	/>
</AppShell>