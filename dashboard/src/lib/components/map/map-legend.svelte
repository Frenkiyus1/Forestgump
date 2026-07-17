<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import { ALERT_STRIP } from '$lib/alert-ui';

	const ITEMS = [
		{ level: 'green' as const, label: 'Safe', range: '< 1 g/L' },
		{ level: 'yellow' as const, label: 'Caution', range: '1 – 4 g/L' },
		{ level: 'red' as const, label: 'Danger', range: '> 4 g/L' }
	];
</script>

<div class={clsx(CARD, 'p-4')}>
	<p class="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">Legend</p>
	<ul class="flex flex-col gap-2">
		{#each ITEMS as item (item.level)}
			<li class="flex items-center gap-2 text-sm">
				<span class={clsx('h-2.5 w-2.5 rounded-full', ALERT_STRIP[item.level])} aria-hidden="true"
				></span>
				<span class="font-medium text-gray-700">{item.label}</span>
				<span class="ml-auto text-xs text-gray-400">{item.range}</span>
			</li>
		{/each}
	</ul>
</div>
