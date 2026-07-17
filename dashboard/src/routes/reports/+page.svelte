<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import AppShell from '$lib/components/app-shell.svelte';
	import ReportSummary from '$lib/components/reports/report-summary.svelte';
	import ReportTable from '$lib/components/reports/report-table.svelte';

	let { data }: { data: PageData } = $props();
	const report = $derived(data.report);

	const PERIODS = [
		{ days: 7, label: '7 days', href: resolve('/reports?period=7') },
		{ days: 30, label: '30 days', href: resolve('/reports?period=30') }
	];

	const generated = $derived(
		new Date(report.generatedAt).toLocaleString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	);

	const tab = (active: boolean) =>
		clsx(
			'rounded-full px-4 py-1.5 text-sm font-medium transition',
			active ? 'bg-accent text-white' : 'bg-white/80 text-gray-500 hover:text-gray-900'
		);
</script>

<svelte:head><title>Reports — SaliGuard</title></svelte:head>

<AppShell>
	<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1
				class="text-4xl leading-tight font-semibold tracking-tight"
				style="font-family: 'Lora', serif;"
			>
				Reports
			</h1>
			<p class="mt-2 text-[15px] text-gray-500">
				Network summary over the last {report.periodDays} days · generated {generated}.
			</p>
		</div>
		<div class="flex gap-1 rounded-full bg-gray-100/70 p-1">
			{#each PERIODS as p (p.days)}
				<a href={p.href} data-sveltekit-preload-data class={tab(report.periodDays === p.days)}>
					{p.label}
				</a>
			{/each}
		</div>
	</div>

	<div class="mb-6">
		<ReportSummary network={report.network} />
	</div>

	<ReportTable stations={report.stations} periodDays={report.periodDays} />
</AppShell>
