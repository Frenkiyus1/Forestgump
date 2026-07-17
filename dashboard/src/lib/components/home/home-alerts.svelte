<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';
	import { ALERT_STRIP, ALERT_BADGE, ALERT_LABEL } from '$lib/alert-ui';
	import type { WeatherAlertEvent } from '$lib/derive';

	interface Props {
		alerts: WeatherAlertEvent[];
	}
	let { alerts }: Props = $props();
</script>

<section use:reveal class={clsx(CARD_INTERACTIVE, 'p-6')} aria-label="Cảnh báo gần đây">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold tracking-tight">Cảnh báo đang hoạt động</h2>
		<span class="text-xs text-gray-400">{alerts.length} cần chú ý</span>
	</div>
	{#if alerts.length}
		<ul class="flex flex-col gap-3">
			{#each alerts as a (a.id)}
				<li class="flex items-center gap-3">
					<span
						class={clsx(
							'grid h-8 w-8 shrink-0 place-items-center rounded-full',
							ALERT_BADGE[a.level]
						)}
					>
						<span class={clsx('h-2 w-2 rounded-full', ALERT_STRIP[a.level])} aria-hidden="true"
						></span>
					</span>
					<div class="min-w-0">
						<p class="truncate text-sm font-medium">{a.locationName}</p>
						<p class="truncate text-xs text-gray-500">{a.message}</p>
					</div>
					<span
						class={clsx(
							'ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
							ALERT_BADGE[a.level]
						)}
					>
						{ALERT_LABEL[a.level]}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-gray-400">Không có cảnh báo. Tất cả khu vực trong ngưỡng an toàn.</p>
	{/if}
</section>
