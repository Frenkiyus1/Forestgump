<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';

	type Alert = 'green' | 'yellow' | 'red';
	type AlertItem = { station: string; level: Alert; text: string };

	interface Props {
		alerts: AlertItem[];
	}
	let { alerts }: Props = $props();

	const DOT: Record<Alert, string> = {
		green: 'bg-green-500',
		yellow: 'bg-yellow-500',
		red: 'bg-red-600'
	};
	const SOFT: Record<Alert, string> = {
		green: 'bg-green-50 text-green-700',
		yellow: 'bg-yellow-50 text-yellow-700',
		red: 'bg-red-50 text-red-700'
	};
</script>

<section use:reveal class={clsx(CARD_INTERACTIVE, 'p-6')} aria-label="Recent alerts">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-base font-semibold tracking-tight">Recent alerts</h2>
		<span class="text-xs text-gray-400">{alerts.length} need attention</span>
	</div>
	{#if alerts.length}
		<ul class="flex flex-col gap-3">
			{#each alerts as a (a.station)}
				<li class="flex items-center gap-3">
					<span
						class={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full', SOFT[a.level])}
					>
						<span class={clsx('h-2 w-2 rounded-full', DOT[a.level])} aria-hidden="true"></span>
					</span>
					<div class="min-w-0">
						<p class="truncate text-sm font-medium">{a.station}</p>
						<p class="truncate text-xs text-gray-500">{a.text}</p>
					</div>
					<span
						class={clsx(
							'ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
							SOFT[a.level]
						)}
					>
						{a.level}
					</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-gray-400">No active alerts. All stations within safe range.</p>
	{/if}
</section>
