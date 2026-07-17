<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import type { LocationDetail } from '$lib/derive';
	import { ALERT_LABEL, ALERT_STRIP, relativeTime } from '$lib/alert-ui';
	import HazardIcon from '$lib/components/hazard-icon.svelte';

	interface Props {
		detail: LocationDetail;
	}
	let { detail }: Props = $props();

	const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' } as const;
	const TREND_TONE = {
		up: 'text-red-600',
		down: 'text-green-600',
		flat: 'text-gray-400'
	} as const;

	const cardClass = clsx(
		CARD_INTERACTIVE,
		'group block w-full overflow-hidden text-left',
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
	);

	const hazardType = $derived(detail.alert?.type ?? null);
</script>

<a href={resolve(`/locations/${detail.locationId}`)} class={cardClass}>
	<div class="flex flex-col gap-4 p-5">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="truncate text-base font-semibold tracking-tight">{detail.name}</p>
				<p class="truncate text-xs text-gray-500">{detail.terrain}</p>
			</div>
			<span class="flex shrink-0 items-center gap-1.5">
				<span
					class={clsx('h-2.5 w-2.5 rounded-full', ALERT_STRIP[detail.alertLevel])}
					aria-hidden="true"
				></span>
				<span class="text-xs font-medium text-gray-500">{ALERT_LABEL[detail.alertLevel]}</span>
			</span>
		</div>

		<div class="flex items-center justify-between gap-2">
			<div>
				<p class="text-3xl font-semibold tracking-tight">
					{Math.round(detail.today.tempMin)}–{Math.round(detail.today.tempMax)}<span
						class="ml-1 text-base font-medium text-gray-400">°C</span
					>
				</p>
				<p class="text-xs text-gray-400">Mưa hôm nay {detail.today.rainSum.toFixed(0)}mm</p>
			</div>
			<HazardIcon type={hazardType} class="h-11 w-10 shrink-0 text-gray-500" />
			<span class={clsx('text-lg font-semibold', TREND_TONE[detail.trend])} aria-hidden="true">
				{TREND_GLYPH[detail.trend]}
			</span>
		</div>

		<div
			class="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400"
		>
			<span>Cập nhật {relativeTime(detail.updatedAt)}</span>
			<span>{detail.alert ? `Còn ${detail.alert.hoursAhead}h` : 'Không có cảnh báo'}</span>
		</div>
	</div>
</a>
