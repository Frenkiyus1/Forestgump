<script lang="ts">
	import type { DienBienForecastEntry } from '$lib/types';

	interface Props {
		forecastEntries?: DienBienForecastEntry[];
	}
	let { forecastEntries = [] }: Props = $props();

	const fallbackLocationNames = $derived(
		forecastEntries.filter((e) => e.source === 'openweathermap').map((e) => e.location.name)
	);
</script>

<div class="mt-3 flex flex-col gap-1.5">
	<p class="text-xs text-gray-400">
		Nguồn dữ liệu: Open-Meteo (dự báo chính) — mưa đá dựa trên CAPE + mực đóng băng; sạt lở đất dựa
		trên độ ẩm đất + mưa tích luỹ 3 ngày. Dự phòng OpenWeatherMap khi Open-Meteo lỗi/timeout.
	</p>
	{#if fallbackLocationNames.length}
		<p class="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
			⚠ {fallbackLocationNames.join(', ')} đang dùng nguồn dự phòng OpenWeatherMap — mưa đá/sạt lở đất
			tạm thời <strong>chưa đánh giá được</strong> cho khu vực này do thiếu dữ liệu CAPE/độ ẩm đất.
		</p>
	{/if}
</div>
