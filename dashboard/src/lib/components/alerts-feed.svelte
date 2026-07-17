<script lang="ts">
	import type { AlertFeedItem } from '$lib/mock';
	import type { AlertLevel } from '$lib/types';
	interface Props {
		items: AlertFeedItem[];
	}
	let { items }: Props = $props();

	const DOT: Record<AlertLevel, string> = {
		green: 'bg-green-500',
		yellow: 'bg-yellow-500',
		red: 'bg-red-600'
	};
	const unread = $derived(items.filter((i) => i.level !== 'green').length);
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<header>
		<h2 class="text-lg font-semibold">Cảnh báo gần đây</h2>
		<p class="text-sm text-gray-500" aria-live="polite">{unread} cảnh báo cần chú ý</p>
	</header>
	<ul class="flex flex-col gap-3">
		{#each items as item (item.id)}
			<li class="flex items-center gap-3">
				<span class="h-2.5 w-2.5 rounded-full {DOT[item.level]}" aria-hidden="true"></span>
				<div class="flex flex-col">
					<span class="text-sm font-medium">{item.station}</span>
					<span class="text-xs text-gray-500">{item.message}</span>
				</div>
				<span class="ml-auto text-xs text-gray-400">{item.ago}</span>
			</li>
		{/each}
	</ul>
</section>
