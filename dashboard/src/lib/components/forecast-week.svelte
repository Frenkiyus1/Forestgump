<script lang="ts">
	import type { AlertType, DayForecast } from '$lib/types';
	import HazardIcon from './hazard-icon.svelte';

	let { daily }: { daily: DayForecast[] } = $props();

	const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

	function weekdayLabel(dateStr: string): string {
		return WEEKDAYS[new Date(dateStr).getDay()];
	}

	function dayLabel(dateStr: string): string {
		const [, m, d] = dateStr.split('-');
		return `${d}/${m}`;
	}

	// Chỉ chọn icon minh hoạ cho từng ngày — KHÔNG phải logic cảnh báo/ngưỡng,
	// đó vẫn là việc của backend thật (weather.ts) sẽ thay thế fixture này.
	function dayIcon(day: DayForecast): AlertType {
		if (day.rainSum >= 30) return 'lu-quet';
		if (day.tempMin <= 8) return 'bang-gia';
		if (day.visibilityMin <= 1500) return 'suong-mu';
		return null;
	}
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
	{#each daily as day (day.date)}
		<div class="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4">
			<span class="text-sm font-bold text-slate-900">{weekdayLabel(day.date)}</span>
			<span class="text-xs text-slate-500">{dayLabel(day.date)}</span>
			<HazardIcon type={dayIcon(day)} class="h-10 w-10 text-slate-500" />
			<span class="text-lg font-bold text-slate-900">
				{Math.round(day.tempMax)}°<span class="font-medium text-slate-400"
					>/{Math.round(day.tempMin)}°</span
				>
			</span>
			<span class="text-xs text-slate-500">{Math.round(day.rainSum)}mm mưa</span>
		</div>
	{/each}
</div>
