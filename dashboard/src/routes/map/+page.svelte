<script lang="ts">
	import { untrack } from 'svelte';
	import { clsx } from '$lib/clsx';
	import { HOTSPOT_REGIONS } from '$lib/dienbien-hotspots';
	import {
		DIENBIEN_HAZARD_LABEL,
		DIENBIEN_HAZARDS,
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

<AppShell compact={true} noHeader={true}>
	<header class="mb-3 text-center">
		<h1 class="text-[28px] font-semibold tracking-tight text-gray-900">
			Bản đồ tỉnh Điện Biên
		</h1>
		<div class="mx-auto mt-1.5 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent"></div>
	</header>

	{#if data.apiError}
		<div
			class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[15px] text-amber-800"
		>
			<p class="font-medium">
				Chưa kết nối được backend — đang hiển thị bản đồ ở chế độ mặc định (xanh lá).
			</p>
			<p class="mt-1 text-amber-700">{data.apiError}</p>
		</div>
	{/if}

	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<div class="flex flex-wrap items-center gap-2">
			{#each DIENBIEN_HAZARDS as hazard (hazard)}
				<button
					type="button"
					onclick={() => (selectedHazard = hazard)}
					aria-pressed={selectedHazard === hazard}
					class={clsx(
						'rounded-full px-3 py-1.5 text-[15px] font-medium transition',
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
			<div class="flex flex-wrap items-center gap-2">
				{#each days as day, i (day)}
					<button
						type="button"
						onclick={() => (selectedDayIndex = i)}
						aria-pressed={selectedDayIndex === i}
						class={clsx(
							'rounded-lg px-2.5 py-1 text-[15px] font-medium transition',
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

	<DienBienMap
		regions={HOTSPOT_REGIONS}
		onSelect={selectRegion}
		{heat}
		forecastEntries={data.forecastEntries}
	/>

	<p class="mt-3 text-center text-[13px] text-gray-400">
		Ranh giới 130 xã: bản đồ hành chính Điện Biên sau sáp nhập. Rủi ro sạt
		lở/lũ quét theo xã: mô hình DEM + dữ liệu mưa quan trắc/dự báo
		(<code class="rounded bg-gray-100 px-1 py-0.5 text-[12px]">docs/dienbien_risk_theo_xa.csv</code>,
		xem <code class="rounded bg-gray-100 px-1 py-0.5 text-[12px]">ai_engine/train_terrain.py</code>).
	</p>
</AppShell>