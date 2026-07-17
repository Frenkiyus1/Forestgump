<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';
	import { ALERT_LABEL, ALERT_STRIP, ALERT_BADGE } from '$lib/alert-ui';
	import type { LocationDetail } from '$lib/derive';

	interface Props {
		details: LocationDetail[];
	}
	let { details }: Props = $props();
</script>

<section use:reveal class={clsx(CARD_INTERACTIVE, 'mb-6 overflow-hidden')} aria-label="Khu vực">
	<div class="flex items-center justify-between px-6 pt-5 pb-3">
		<h2 class="text-base font-semibold tracking-tight">Khu vực</h2>
		<a
			href={resolve('/locations')}
			class="text-sm font-medium text-accent transition hover:underline">Xem tất cả</a
		>
	</div>
	<div class="divide-y divide-gray-100/80">
		{#each details as d (d.locationId)}
			<div class="flex items-center gap-4 px-6 py-3.5 transition hover:bg-cream/60">
				<span
					class={clsx('h-2.5 w-2.5 shrink-0 rounded-full', ALERT_STRIP[d.alertLevel])}
					aria-hidden="true"
				></span>
				<span class="w-40 font-medium">{d.name}</span>
				<span class="hidden flex-1 text-sm text-gray-500 sm:block">
					{Math.round(d.today.tempMin)}–{Math.round(d.today.tempMax)}°C · Mưa {d.today.rainSum.toFixed(
						0
					)}mm
				</span>
				<span class="ml-auto text-sm text-gray-400">Còn lại</span>
				<span class="w-16 text-right font-semibold tracking-tight">
					{d.alert ? `${d.alert.hoursAhead}h` : '—'}
				</span>
				<span
					class={clsx(
						'hidden w-24 rounded-full px-2.5 py-1 text-center text-xs font-medium md:block',
						ALERT_BADGE[d.alertLevel]
					)}
				>
					{ALERT_LABEL[d.alertLevel]}
				</span>
			</div>
		{/each}
	</div>
</section>
