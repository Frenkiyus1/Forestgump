<script lang="ts">
	import type { PageData } from './$types';
	import AppShell from '$lib/components/app-shell.svelte';
	import AlertList from '$lib/components/alerts/alert-list.svelte';

	let { data }: { data: PageData } = $props();

	const dangerCount = $derived(data.alerts.filter((a) => a.level === 'red').length);
	const cautionCount = $derived(data.alerts.filter((a) => a.level === 'yellow').length);
</script>

<svelte:head><title>Cảnh báo — ForestGump</title></svelte:head>

<AppShell>
	{#if data.apiError}
		<div
			class="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
		>
			<p class="font-medium">
				Chưa kết nối được backend — đang hiển thị dữ liệu mặc định (xanh lá).
			</p>
			<p class="mt-1 text-amber-700">{data.apiError}</p>
		</div>
	{/if}

	<div class="mb-8">
		<h1
			class="text-4xl leading-tight font-semibold tracking-tight"
			style="font-family: 'Lora', serif;"
		>
			Cảnh báo
		</h1>
		<p class="mt-2 text-[15px] text-gray-500">
			{dangerCount} nguy hiểm · {cautionCount} cảnh báo đang hoạt động. Gần nhất trước — bấm vào một dòng
			để xem chi tiết khu vực.
		</p>
	</div>

	<AlertList events={data.alerts} />
</AppShell>
