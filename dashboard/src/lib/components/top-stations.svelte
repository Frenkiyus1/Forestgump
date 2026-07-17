<script lang="ts">
	import type { TopStation } from '$lib/types';
	interface Props {
		items: TopStation[];
	}
	let { items }: Props = $props();

	const max = $derived(items.reduce((m, i) => Math.max(m, i.value), 0) || 1);
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="text-lg font-semibold">Trạm độ mặn cao nhất</h2>
	<ul class="flex flex-col gap-3">
		{#each items as item (item.name)}
			<li class="flex flex-col gap-1">
				<div class="flex justify-between text-sm">
					<span>{item.name}</span>
					<span class="text-gray-500">{item.value} g/L</span>
				</div>
				<div class="h-2 rounded-full bg-accent-soft">
					<div class="h-2 rounded-full bg-accent" style="width: {(item.value / max) * 100}%"></div>
				</div>
			</li>
		{/each}
	</ul>
</section>
