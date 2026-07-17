<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import type { WeatherAlertEvent } from '$lib/derive';
	import AlertRow from './alert-row.svelte';

	interface Props {
		events: WeatherAlertEvent[];
	}
	let { events }: Props = $props();
</script>

{#if events.length === 0}
	<div class={clsx(CARD, 'py-16 text-center')}>
		<p class="text-sm font-medium text-gray-500">Không có cảnh báo nào</p>
		<p class="mt-1 text-xs text-gray-400">Tất cả khu vực đang trong ngưỡng an toàn.</p>
	</div>
{:else}
	<div class={clsx(CARD, 'overflow-hidden')}>
		<div class="divide-y divide-gray-100/80">
			{#each events as event (event.id)}
				<AlertRow {event} />
			{/each}
		</div>
	</div>
{/if}
