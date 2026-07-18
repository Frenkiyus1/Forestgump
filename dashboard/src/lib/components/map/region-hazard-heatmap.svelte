<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { ALERT_HEX, ALERT_LABEL } from '$lib/alert-ui';
	import { DIENBIEN_HAZARD_LABEL } from '$lib/dienbien-heatmap';
	import type { DienBienForecastEntry, DienBienHazard } from '$lib/types';

	interface Props {
		/** Dự báo đầy đủ của 1 anchor (đã lọc theo HAZARD_HEATMAP_ANCHOR_NAMES ở component cha). */
		entry: DienBienForecastEntry;
	}
	let { entry }: Props = $props();

	const HAZARDS: DienBienHazard[] = ['cold_damage', 'heavy_rain_flood', 'fog'];

	interface HoveredCell {
		hazard: DienBienHazard;
		dayIndex: number;
	}
	let hovered = $state<HoveredCell | null>(null);

	function isHovered(hazard: DienBienHazard, dayIndex: number): boolean {
		return hovered?.hazard === hazard && hovered.dayIndex === dayIndex;
	}
	function setHovered(hazard: DienBienHazard, dayIndex: number) {
		hovered = { hazard, dayIndex };
	}
	function clearHovered() {
		hovered = null;
	}
	function formatDay(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
	}
</script>

<div>
	<p class="text-sm font-semibold text-gray-900">
		Heatmap hiểm hoạ theo ngày — {entry.location.name}
	</p>
	<p class="mt-1 text-xs text-gray-500">
		Mỗi ô là mức cảnh báo của 1 hiểm hoạ trong 1 ngày dự báo (dữ liệu đo thật tại anchor này). Di
		chuột hoặc tab vào ô để xem chi tiết.
	</p>

	<div class="mt-4 overflow-x-auto">
		<table class="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
			<thead>
				<tr>
					<th class="w-36 text-left font-medium text-gray-500"></th>
					{#each entry.days as day (day.date)}
						<th class="px-1 py-1 text-center font-medium text-gray-500">{formatDay(day.date)}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each HAZARDS as hazard (hazard)}
					<tr>
						<th scope="row" class="pr-2 text-left align-middle font-medium text-gray-700">
							{DIENBIEN_HAZARD_LABEL[hazard]}
						</th>
						{#each entry.days as day, dayIndex (day.date)}
							{@const risk = day.hazards.find((h) => h.hazard === hazard) ?? null}
							{@const level = risk?.alert_level ?? 'green'}
							<td class="relative p-0 text-center">
								<button
									type="button"
									class={clsx(
										'h-9 w-full rounded-md outline-none transition',
										isHovered(hazard, dayIndex) && 'ring-2 ring-gray-900 ring-offset-1'
									)}
									style="background-color: {ALERT_HEX[level]}"
									aria-label="{DIENBIEN_HAZARD_LABEL[hazard]} ngày {day.date}: {ALERT_LABEL[level]}"
									onmouseenter={() => setHovered(hazard, dayIndex)}
									onmouseleave={clearHovered}
									onfocus={() => setHovered(hazard, dayIndex)}
									onblur={clearHovered}
								></button>
								{#if isHovered(hazard, dayIndex)}
									<div
										class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-[rgba(17,24,39,0.95)] px-3 py-2 text-left text-[11px] text-white shadow-xl"
									>
										<strong class="block text-white">
											{DIENBIEN_HAZARD_LABEL[hazard]} — {formatDay(day.date)}
										</strong>
										<span
											class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
											style="background-color: {ALERT_HEX[level]}"
										>
											{ALERT_LABEL[level]}
										</span>
										{#if risk?.detail}
											<p class="mt-1.5 text-white/85">{risk.detail}</p>
										{/if}
										<dl
											class="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-white/15 pt-1.5 text-white/85"
										>
											<dt class="text-white/50">Nhiệt độ</dt>
											<dd>{day.tempMinC}–{day.tempMaxC}°C</dd>
											<dt class="text-white/50">Mưa</dt>
											<dd>{day.precipitationMm} mm</dd>
										</dl>
									</div>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
