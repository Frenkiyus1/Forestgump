<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';
	import { t } from '$lib/i18n.svelte';

	type Alert = 'green' | 'yellow' | 'red';
	type Row = { name: string; ec: number; forecast: number; level: number; alert: Alert };
	type CardKey = 'safe' | 'risk' | 'peak' | 'level';

	interface Props {
		greenCount: number;
		total: number;
		safePct: number;
		atRisk: number;
		peak: number;
		avgLevel: number;
		stations: Row[];
	}
	let { greenCount, total, safePct, atRisk, peak, avgLevel, stations }: Props = $props();

	let activeCard = $state<CardKey | null>(null);
	function toggle(key: CardKey) {
		activeCard = activeCard === key ? null : key;
	}

	const kpis = $derived([
		{
			key: 'safe' as CardKey,
			label: t('kpi.safe'),
			value: `${greenCount}`,
			suffix: `/${total}`,
			sub: t('kpi.safe.sub', { pct: safePct }),
			tone: 'text-green-600'
		},
		{
			key: 'risk' as CardKey,
			label: t('kpi.risk'),
			value: `${atRisk}`,
			sub: t('kpi.risk.sub'),
			tone: 'text-yellow-600'
		},
		{
			key: 'peak' as CardKey,
			label: t('kpi.peak'),
			value: `${peak.toFixed(1)}`,
			unit: 'g/L',
			sub: t('kpi.peak.sub'),
			tone: 'text-red-600'
		},
		{
			key: 'level' as CardKey,
			label: t('kpi.level'),
			value: `${avgLevel.toFixed(1)}`,
			unit: 'm',
			sub: t('kpi.level.sub'),
			tone: 'text-gray-400'
		}
	]);

	const DOT: Record<Alert, string> = {
		green: 'bg-green-500',
		yellow: 'bg-yellow-500',
		red: 'bg-red-600'
	};
	const DOT_HALO: Record<Alert, string> = {
		green: 'bg-green-100',
		yellow: 'bg-yellow-100',
		red: 'bg-red-100'
	};
	const BADGE: Record<Alert, string> = {
		green: 'bg-green-50 text-green-700',
		yellow: 'bg-yellow-50 text-yellow-700',
		red: 'bg-red-50 text-red-700'
	};
	const LABEL = $derived<Record<Alert, string>>({
		green: t('alert.green'),
		yellow: t('alert.yellow'),
		red: t('alert.red')
	});

	const safeStations = $derived(stations.filter((s) => s.alert === 'green'));
	const riskStations = $derived(
		stations.filter((s) => s.alert !== 'green').sort((a, b) => b.ec - a.ec)
	);
	const byForecast = $derived([...stations].sort((a, b) => b.forecast - a.forecast));
	const byLevel = $derived([...stations].sort((a, b) => b.level - a.level));
</script>

{#snippet dot(alert: Alert)}
	<span
		class={clsx(
			'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
			DOT_HALO[alert]
		)}
		aria-hidden="true"
	>
		<span class={clsx('h-2 w-2 rounded-full', DOT[alert])}></span>
	</span>
{/snippet}

<section class="mb-6" aria-label="Key metrics">
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		{#each kpis as kpi, i (kpi.key)}
			<button
				type="button"
				use:reveal={{ delay: i * 80 }}
				class={clsx(
					CARD_INTERACTIVE,
					'cursor-pointer p-5 text-left focus-visible:outline-2 focus-visible:outline-accent',
					activeCard === kpi.key && 'ring-2 ring-accent/30'
				)}
				onclick={() => toggle(kpi.key)}
				aria-expanded={activeCard === kpi.key}
			>
				<div class="flex items-start justify-between">
					<p class="text-[13px] font-medium text-gray-500">{kpi.label}</p>
					<svg
						viewBox="0 0 24 24"
						class={clsx(
							'mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-transform duration-200',
							activeCard === kpi.key && 'rotate-180 text-accent'
						)}
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</div>
				<p class="mt-3 text-3xl font-semibold tracking-tight">
					{kpi.value}{#if 'suffix' in kpi}<span class="text-gray-400">{kpi.suffix}</span
						>{/if}{#if 'unit' in kpi}<span class="ml-1 text-lg font-medium text-gray-400"
							>{kpi.unit}</span
						>{/if}
				</p>
				<p class={clsx('mt-1 text-xs font-medium', kpi.tone)}>{kpi.sub}</p>
			</button>
		{/each}
	</div>

	{#if activeCard}
		{#key activeCard}
			<div
				use:reveal
				class="mt-4 rounded-3xl border border-black/[0.04] bg-white p-6 shadow-[0_1px_2px_rgba(31,25,16,0.04)]"
				role="region"
				aria-label="Detail breakdown"
			>
				{#if activeCard === 'safe'}
					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div>
							<p class="mb-3 text-[11px] font-semibold tracking-widest text-green-600 uppercase">
								Safe — {safeStations.length} station{safeStations.length !== 1 ? 's' : ''}
							</p>
							{#if safeStations.length}
								<ul class="flex flex-col gap-0.5">
									{#each safeStations as s (s.name)}
										<li class="flex items-center gap-2.5 py-1.5">
											{@render dot('green')}
											<span class="text-sm font-medium">{s.name}</span>
											<span class="ml-auto text-sm tabular-nums text-gray-400">{s.ec} g/L</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-sm text-gray-400">No stations currently safe.</p>
							{/if}
						</div>
						<div>
							<p class="mb-3 text-[11px] font-semibold tracking-widest text-yellow-600 uppercase">
								At risk — {riskStations.length} station{riskStations.length !== 1 ? 's' : ''}
							</p>
							{#if riskStations.length}
								<ul class="flex flex-col gap-0.5">
									{#each riskStations as s (s.name)}
										<li class="flex items-center gap-2.5 py-1.5">
											{@render dot(s.alert)}
											<span class="text-sm font-medium">{s.name}</span>
											<span
												class={clsx(
													'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
													BADGE[s.alert]
												)}>{s.ec} g/L</span
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-sm text-gray-400">All stations safe.</p>
							{/if}
						</div>
					</div>
				{:else if activeCard === 'risk'}
					<p class="mb-4 text-[11px] font-semibold tracking-widest text-yellow-600 uppercase">
						Stations needing attention — {riskStations.length}
					</p>
					{#if riskStations.length}
						<ul class="flex flex-col divide-y divide-gray-100/80">
							{#each riskStations as s (s.name)}
								<li class="flex items-center gap-4 py-3">
									{@render dot(s.alert)}
									<span class="w-28 font-medium">{s.name}</span>
									<span class="text-sm text-gray-500">EC {s.ec} g/L</span>
									<span class="text-sm text-gray-300" aria-hidden="true">→</span>
									<span class="text-sm font-medium">Forecast {s.forecast.toFixed(1)} g/L</span>
									<span
										class={clsx(
											'ml-auto rounded-full px-2.5 py-1 text-xs font-medium',
											BADGE[s.alert]
										)}>{LABEL[s.alert]}</span
									>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-gray-400">All stations in safe range.</p>
					{/if}
				{:else if activeCard === 'peak'}
					<p class="mb-4 text-[11px] font-semibold tracking-widest text-red-500 uppercase">
						Stations ranked by 24h forecast
					</p>
					<ul class="flex flex-col divide-y divide-gray-100/80">
						{#each byForecast as s, i (s.name)}
							<li class="flex items-center gap-4 py-3">
								<span class="w-5 text-sm font-bold tabular-nums text-gray-600">{i + 1}</span>
								{@render dot(s.alert)}
								<span class="font-medium">{s.name}</span>
								<span class="ml-auto text-sm text-gray-400">Now {s.ec} g/L</span>
								<span class="w-32 text-right text-sm font-semibold tabular-nums"
									>→ {s.forecast.toFixed(1)} g/L</span
								>
							</li>
						{/each}
					</ul>
				{:else if activeCard === 'level'}
					<p class="mb-4 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
						Water level across stations (m)
					</p>
					<ul class="flex flex-col divide-y divide-gray-100/80">
						{#each byLevel as s, i (s.name)}
							<li class="flex items-center gap-4 py-3">
								<span class="w-5 text-sm font-bold tabular-nums text-gray-600">{i + 1}</span>
								{@render dot(s.alert)}
								<span class="font-medium">{s.name}</span>
								<div class="ml-auto flex items-center gap-3">
									<div class="h-1.5 w-32 overflow-hidden rounded-full bg-gray-100">
										<div
											class="h-full rounded-full bg-accent/60"
											style="width: {Math.min((s.level / 2.5) * 100, 100).toFixed(0)}%"
										></div>
									</div>
									<span class="w-12 text-right text-sm font-semibold tabular-nums"
										>{s.level.toFixed(1)} m</span
									>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/key}
	{/if}
</section>
