<script lang="ts">
	import type { Location } from '$lib/locations';
	import HazardIcon from './hazard-icon.svelte';

	let {
		locations,
		selectedId,
		onSelect
	}: { locations: Location[]; selectedId: string; onSelect: (id: string) => void } = $props();
</script>

<div class="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Chọn khu vực">
	{#each locations as loc (loc.id)}
		{@const active = loc.id === selectedId}
		<button
			type="button"
			role="radio"
			aria-checked={active}
			onclick={() => onSelect(loc.id)}
			class="flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition {active
				? 'border-slate-900 bg-slate-900 text-white'
				: 'border-slate-200 bg-white text-slate-900 hover:border-slate-400'}"
		>
			<HazardIcon
				type={loc.primaryRisk}
				class="h-9 w-9 shrink-0 {active ? 'text-white' : 'text-slate-500'}"
			/>
			<span class="min-w-0">
				<span class="block truncate text-base font-bold">{loc.name}</span>
				<span class="block truncate text-xs {active ? 'text-white/70' : 'text-slate-500'}">
					{loc.terrain}
				</span>
			</span>
		</button>
	{/each}
</div>
