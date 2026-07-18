<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { HOTSPOT_REGIONS } from '$lib/dienbien-hotspots';
	import { ALERT_BADGE, ALERT_LABEL } from '$lib/alert-ui';
	import {
		DIENBIEN_HAZARD_LABEL,
		DIENBIEN_HAZARDS,
		buildRegionHeat,
		pickDefaultHazard,
		availableDays
	} from '$lib/dienbien-heatmap';
	import type { DienBienHazard } from '$lib/types';
	import AppShell from '$lib/components/app-shell.svelte';
	import RegionHazardHeatmap from '$lib/components/map/region-hazard-heatmap.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const region = $derived(HOTSPOT_REGIONS.find((r) => r.id === data.regionId) ?? null);

	const ANCHOR_MAP_IMG: Record<number, string> = {
		44: '/dien-bien-phu/map.png',
		1: '/muong-nhe/map.png',
		16: '/tua-chua/map.png'
	};
	const mapImg = $derived(ANCHOR_MAP_IMG[data.regionId] ?? null);

	let selectedHazard = $state<DienBienHazard>(
		untrack(() => pickDefaultHazard(data.forecastEntries))
	);
	let selectedDayIndex = $state(0);

	const days = $derived(availableDays(data.forecastEntries));
	const heat = $derived(
		region
			? buildRegionHeat([region], data.forecastEntries, selectedHazard, selectedDayIndex).get(region.id) ?? null
			: null
	);

	const anchorEntry = $derived(
		region ? data.forecastEntries.find((e) => e.location.name === region.name) ?? null : null
	);

	function formatDay(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
	}
</script>

<svelte:head>
	<title>{region?.name ?? 'Không tìm thấy'} — ForestGump</title>
</svelte:head>

<AppShell>
	<nav class="mb-3 flex items-center gap-1.5 text-sm text-gray-400">
		<a href={resolve('/map')} class="transition hover:text-gray-600"> Điện Biên </a>
		<span aria-hidden="true">›</span>
		<span class="font-semibold text-gray-900">{region?.name ?? 'Không tìm thấy'}</span>
	</nav>

	{#if !region}
		<div class={clsx(CARD, 'p-8 text-center text-gray-500')}>
			Không tìm thấy khu vực này.
		</div>
	{:else}
		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			{region.name}
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			Thông tin chi tiết khu vực {region.name}
			{#if heat?.isAnchor}
				— dữ liệu đo thật
			{:else if heat}
				— ước tính theo vùng địa hình{heat.confidence === 'low' ? ' (độ tin cậy thấp)' : ''}
			{/if}
		</p>

		{#if heat}
			<div class={clsx(CARD, 'mt-6 p-6')}>
				<div class="flex flex-wrap items-center gap-3">
					<span
						class={clsx(
							'rounded-full px-3 py-1 text-sm font-semibold',
							ALERT_BADGE[heat.alertLevel]
						)}
					>
						{ALERT_LABEL[heat.alertLevel]}
					</span>
					<span class="text-sm text-gray-600">
						{DIENBIEN_HAZARD_LABEL[selectedHazard]}
					</span>
				</div>
				{#if !heat.isAnchor}
					<p class="mt-3 text-sm text-gray-500">
						Dữ liệu ước tính từ <strong>{heat.sourceAnchorName ?? 'anchor cùng nhóm địa hình'}</strong>
						{heat.confidence === 'low' ? ' (độ tin cậy thấp)' : ''}.
					</p>
				{/if}
				{#if heat.detail}
					<p class="mt-2 text-sm text-gray-700">{heat.detail}</p>
				{/if}
			</div>
		{/if}

		{#if mapImg}
			<div class={clsx(CARD, 'relative mt-6 overflow-hidden p-0')}>
				<img
					src={mapImg}
					alt="Bản đồ {region.name}"
					class="block h-auto w-full select-none"
					draggable="false"
				/>
			</div>
		{/if}

		<div class="mt-6 flex flex-wrap items-center gap-2">
			{#each DIENBIEN_HAZARDS as hazard (hazard)}
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

		{#if anchorEntry}
			<div class={clsx(CARD, 'mt-6 p-6')}>
				<RegionHazardHeatmap entry={anchorEntry} />
			</div>
		{:else if heat}
			<div class={clsx(CARD, 'mt-6 p-6')}>
				<p class="text-sm font-semibold text-gray-900">
					Heatmap hiểm hoạ theo ngày — {region.name}
				</p>
				<p class="mt-1 text-xs text-gray-500">
					Mức cảnh báo ước tính từ dữ liệu của <strong>{heat.sourceAnchorName ?? 'anchor cùng nhóm địa hình'}</strong>.
				</p>
			</div>
		{/if}
	{/if}
</AppShell>