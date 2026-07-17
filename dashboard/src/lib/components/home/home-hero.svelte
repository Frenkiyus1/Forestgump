<script lang="ts">
	import { reveal } from '$lib/actions/reveal';
	import { t } from '$lib/i18n.svelte';

	interface Props {
		total: number;
	}
	let { total }: Props = $props();
</script>

<div use:reveal class="mb-10">
	<p class="text-sm font-medium tracking-wide text-gray-400">Sunday · June 28, 2026 · Việt Nam</p>
	<h1
		class="mt-1 text-5xl leading-[1.05] font-semibold tracking-tight"
		style="font-family: 'Lora', serif;"
	>
		{t('home.title')}
	</h1>
	<p class="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-500">
		{t('home.sub', { total })}
	</p>
</div>
