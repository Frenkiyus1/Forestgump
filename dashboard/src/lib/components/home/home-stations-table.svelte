<script lang="ts">
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';

	type Alert = 'green' | 'yellow' | 'red';
	type Row = { name: string; ec: number; forecast: number; level: number; alert: Alert };

	interface Props {
		stations: Row[];
	}
	let { stations }: Props = $props();

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

<section use:reveal class={clsx(CARD_INTERACTIVE, 'mb-6 overflow-hidden')} aria-label="Stations">
	<div class="flex items-center justify-between px-6 pt-5 pb-3">
		<h2 class="text-base font-semibold tracking-tight">Stations</h2>
		<a
			href={resolve('/stations')}
			class="text-sm font-medium text-accent transition hover:underline">View all</a
		>
	</div>
	<div class="divide-y divide-gray-100/80">
		{#each stations as s (s.name)}
			<div class="flex items-center gap-4 px-6 py-3.5 transition hover:bg-cream/60">
				<span class={clsx('h-2.5 w-2.5 shrink-0 rounded-full', DOT[s.alert])} aria-hidden="true"
				></span>
				<span class="w-32 font-medium">{s.name}</span>
				<span class="hidden flex-1 text-sm text-gray-500 sm:block"
					>EC {s.ec} g/L · Level {s.level} m</span
				>
				<span class="ml-auto text-sm text-gray-400">Forecast</span>
				<span class="w-14 text-right font-semibold tracking-tight">{s.forecast}</span>
				<span
					class={clsx(
						'hidden w-20 rounded-full px-2.5 py-1 text-center text-xs font-medium capitalize md:block',
						SOFT[s.alert]
					)}
				>
					{s.alert}
				</span>
			</div>
		{/each}
	</div>
</section>
