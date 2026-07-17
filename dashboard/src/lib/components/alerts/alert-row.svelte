<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { ALERT_LABEL, ALERT_BADGE, ALERT_STRIP, relativeTime } from '$lib/alert-ui';
	import type { WeatherAlertEvent } from '$lib/derive';

	interface Props {
		event: WeatherAlertEvent;
	}
	let { event }: Props = $props();
</script>

<a
	href={resolve(`/locations/${event.locationId}`)}
	class="flex items-center gap-4 px-6 py-4 transition hover:bg-cream/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
>
	<span
		class={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full', ALERT_BADGE[event.level])}
	>
		<span class={clsx('h-2.5 w-2.5 rounded-full', ALERT_STRIP[event.level])} aria-hidden="true"
		></span>
	</span>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<p class="truncate text-sm font-semibold tracking-tight">{event.locationName}</p>
			<span class="text-xs text-gray-400">· {event.terrain}</span>
		</div>
		<p class="truncate text-xs text-gray-500">{event.message}</p>
	</div>

	<div class="hidden text-right sm:block">
		<p class="text-sm font-semibold tracking-tight">Còn {event.hoursAhead}h</p>
		<span
			class={clsx(
				'text-xs font-medium',
				event.level === 'red' ? 'text-red-600' : 'text-yellow-600'
			)}
		>
			{ALERT_LABEL[event.level]}
		</span>
	</div>

	<span class="w-20 shrink-0 text-right text-xs text-gray-400">{relativeTime(event.ts)}</span>
</a>
