<script lang="ts">
	import type { QuickAction } from '$lib/mock';
	interface Props {
		items: QuickAction[];
	}
	let { items }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="text-lg font-semibold">Thao tác nhanh</h2>
	<div class="flex flex-wrap gap-2">
		{#each items as action (action.id)}
			<a
				href="#{action.id}"
				class="rounded-full border border-accent-soft px-4 py-2 text-sm text-accent hover:bg-accent-soft"
			>
				{action.label}
			</a>
		{/each}
	</div>
</section>
