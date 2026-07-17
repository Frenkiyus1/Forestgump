<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import type { AlertEvent } from '$lib/types';
	import AlertRow from './alert-row.svelte';

	interface Props {
		events: AlertEvent[];
	}
	let { events }: Props = $props();
</script>

{#if events.length === 0}
	<div class={clsx(CARD, 'py-16 text-center')}>
		<p class="text-sm font-medium text-gray-500">No alerts found</p>
		<p class="mt-1 text-xs text-gray-400">Try a different level or region.</p>
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
