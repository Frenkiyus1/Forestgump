<script lang="ts">
	import { clsx } from '$lib/clsx';

	type Level = 'all' | 'yellow' | 'red';

	interface Props {
		regions: string[];
		onFilter: (region: string | null, level: Level) => void;
	}
	let { regions, onFilter }: Props = $props();

	let region = $state('all');
	let level = $state<Level>('all');

	function emit() {
		onFilter(region === 'all' ? null : region, level);
	}

	const pill = clsx(
		'rounded-full border bg-white/80 px-4 py-2 text-sm backdrop-blur transition',
		'focus-visible:outline-2 focus-visible:outline-accent'
	);
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
	<label class="sr-only" for="level-filter">Filter by level</label>
	<select
		id="level-filter"
		bind:value={level}
		onchange={emit}
		class={clsx(
			pill,
			level === 'all' ? 'border-gray-200 text-gray-700' : 'border-accent text-accent'
		)}
	>
		<option value="all">All levels</option>
		<option value="red">Danger</option>
		<option value="yellow">Caution</option>
	</select>

	<label class="sr-only" for="region-filter">Filter by region</label>
	<select
		id="region-filter"
		bind:value={region}
		onchange={emit}
		class={clsx(
			pill,
			region === 'all' ? 'border-gray-200 text-gray-700' : 'border-accent text-accent'
		)}
	>
		<option value="all">All regions</option>
		{#each regions as r (r)}
			<option value={r}>{r}</option>
		{/each}
	</select>
</div>
