<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { ALERT_LABEL, ALERT_STRIP } from '$lib/alert-ui';
	import type { StationDetail } from '$lib/types';

	interface Props {
		stations: StationDetail[];
		selectedId?: string | null;
		onHover: (id: string | null) => void;
	}
	let { stations, selectedId = null, onHover }: Props = $props();

	function byStationId(a: StationDetail, b: StationDetail) {
		return a.station_id.localeCompare(b.station_id);
	}
	const aggregateStations = $derived(stations.filter((s) => s.isAggregate).sort(byStationId));
	const monitorStations = $derived(stations.filter((s) => !s.isAggregate).sort(byStationId));

	// Danh sách "Trạm ForestGump" (trạm quan trắc) thường dài hơn nhiều so với
	// trạm tổng hợp — thu gọn mặc định để sidebar không quá dài, người dùng bấm
	// để mở khi cần.
	let monitorExpanded = $state(false);
</script>

{#snippet stationList(list: StationDetail[])}
	<ul class="divide-y divide-gray-100/80">
		{#each list as s (s.station_id)}
			<li>
				<a
					href={resolve(`/stations/${s.station_id}`)}
					onmouseenter={() => onHover(s.station_id)}
					onmouseleave={() => onHover(null)}
					onfocus={() => onHover(s.station_id)}
					onblur={() => onHover(null)}
					class={clsx(
						'flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-cream/60',
						s.station_id === selectedId && 'bg-cream/80'
					)}
				>
					<span
						class={clsx('h-2.5 w-2.5 shrink-0 rounded-full', ALERT_STRIP[s.alert])}
						aria-hidden="true"
					></span>
					<span class="min-w-0">
						<span class="block truncate text-sm font-medium">{s.name}</span>
						<span class="block text-xs text-gray-400">{s.region}</span>
					</span>
					<span class="ml-auto text-right">
						{#if s.isAggregate}
							<!-- Trạm tổng hợp là số liệu trung bình — chỉ hiện dự báo + cảnh báo,
							     không hiện hàm lượng muối hiện tại (dễ hiểu nhầm là số đo trực tiếp). -->
							<span class="block text-sm font-semibold tracking-tight">
								{s.forecast_24h}<span class="text-[10px] font-normal text-gray-400"> g/L·24h</span>
							</span>
						{:else}
							<span class="block text-sm font-semibold tracking-tight">{s.ec} g/L</span>
						{/if}
						<span class="block text-xs text-gray-400">{ALERT_LABEL[s.alert]}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<div class={clsx(CARD, 'overflow-hidden')}>
	<div class="px-5 pt-4 pb-3">
		<h2 class="text-base font-semibold tracking-tight">Stations</h2>
		<p class="text-xs text-gray-400">Hover to locate · click to open</p>
	</div>

	{#if aggregateStations.length > 0}
		<p class="px-5 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">
			Trạm tổng hợp
		</p>
		{@render stationList(aggregateStations)}
	{/if}

	{#if monitorStations.length > 0}
		<button
			type="button"
			onclick={() => (monitorExpanded = !monitorExpanded)}
			aria-expanded={monitorExpanded}
			class={clsx(
				'flex w-full items-center justify-between px-5 pt-3 pb-1.5 text-left transition hover:bg-cream/40',
				aggregateStations.length > 0 && 'border-t border-gray-100/80'
			)}
		>
			<span class="text-xs font-semibold tracking-wide text-gray-400 uppercase">
				Trạm ForestGump <span class="text-gray-300">· {monitorStations.length}</span>
			</span>
			<svg
				viewBox="0 0 24 24"
				class={clsx(
					'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform',
					monitorExpanded && 'rotate-180'
				)}
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
		{#if monitorExpanded}
			{@render stationList(monitorStations)}
		{/if}
	{/if}
</div>
