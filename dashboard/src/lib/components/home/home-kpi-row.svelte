<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';
	import { ALERT_LABEL, ALERT_BADGE, ALERT_STRIP } from '$lib/alert-ui';
	import type { AlertLevel } from '$lib/types';
	import type { DashboardSummary, LocationDetail } from '$lib/derive';

	type CardKey = 'safe' | 'risk' | 'next' | 'rain';

	interface Props {
		summary: DashboardSummary;
		details: LocationDetail[];
	}
	let { summary, details }: Props = $props();

	let activeCard = $state<CardKey | null>(null);
	function toggle(key: CardKey) {
		activeCard = activeCard === key ? null : key;
	}

	const kpis = $derived([
		{
			key: 'safe' as CardKey,
			label: 'An toàn',
			value: `${summary.greenCount}`,
			suffix: `/${summary.total}`,
			sub: `${summary.safePct}% khu vực`,
			tone: 'text-green-600'
		},
		{
			key: 'risk' as CardKey,
			label: 'Có cảnh báo',
			value: `${summary.atRiskCount}`,
			sub: 'Vàng hoặc đỏ',
			tone: 'text-yellow-600'
		},
		{
			key: 'next' as CardKey,
			label: 'Cảnh báo gần nhất',
			value: summary.nextAlertHours == null ? '—' : `${summary.nextAlertHours}`,
			unit: summary.nextAlertHours == null ? '' : 'giờ',
			sub: summary.nextAlertHours == null ? 'Không có cảnh báo' : 'Còn lại',
			tone: 'text-red-600'
		},
		{
			key: 'rain' as CardKey,
			label: 'Mưa ngày mai cao nhất',
			value: `${summary.peakRainTomorrow.toFixed(0)}`,
			unit: 'mm',
			sub: 'Trên toàn tỉnh',
			tone: 'text-gray-400'
		}
	]);

	const safeLocations = $derived(details.filter((d) => d.alertLevel === 'green'));
	const riskLocations = $derived(
		details
			.filter((d) => d.alertLevel !== 'green')
			.sort((a, b) => a.alert!.hoursAhead - b.alert!.hoursAhead)
	);
	const byUrgency = $derived(
		[...details].sort(
			(a, b) => (a.alert?.hoursAhead ?? Infinity) - (b.alert?.hoursAhead ?? Infinity)
		)
	);
	const byRainTomorrow = $derived(
		[...details].sort(
			(a, b) => (b.daily[1]?.rainSum ?? b.today.rainSum) - (a.daily[1]?.rainSum ?? a.today.rainSum)
		)
	);
</script>

{#snippet dot(level: AlertLevel)}
	<span
		class={clsx(
			'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
			ALERT_BADGE[level]
		)}
		aria-hidden="true"
	>
		<span class={clsx('h-2 w-2 rounded-full', ALERT_STRIP[level])}></span>
	</span>
{/snippet}

<section class="mb-6" aria-label="Chỉ số chính">
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
						>{/if}{#if 'unit' in kpi && kpi.unit}<span
							class="ml-1 text-lg font-medium text-gray-400">{kpi.unit}</span
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
				aria-label="Chi tiết"
			>
				{#if activeCard === 'safe'}
					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div>
							<p class="mb-3 text-[11px] font-semibold tracking-widest text-green-600 uppercase">
								An toàn — {safeLocations.length} khu vực
							</p>
							{#if safeLocations.length}
								<ul class="flex flex-col gap-0.5">
									{#each safeLocations as d (d.locationId)}
										<li class="flex items-center gap-2.5 py-1.5">
											{@render dot('green')}
											<span class="text-sm font-medium">{d.name}</span>
											<span class="ml-auto text-sm text-gray-400">{d.terrain}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-sm text-gray-400">Chưa có khu vực nào an toàn.</p>
							{/if}
						</div>
						<div>
							<p class="mb-3 text-[11px] font-semibold tracking-widest text-yellow-600 uppercase">
								Có cảnh báo — {riskLocations.length} khu vực
							</p>
							{#if riskLocations.length}
								<ul class="flex flex-col gap-0.5">
									{#each riskLocations as d (d.locationId)}
										<li class="flex items-center gap-2.5 py-1.5">
											{@render dot(d.alertLevel)}
											<span class="text-sm font-medium">{d.name}</span>
											<span
												class={clsx(
													'ml-auto rounded-full px-2 py-0.5 text-xs font-medium',
													ALERT_BADGE[d.alertLevel]
												)}>Còn {d.alert?.hoursAhead}h</span
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-sm text-gray-400">Tất cả khu vực đều an toàn.</p>
							{/if}
						</div>
					</div>
				{:else if activeCard === 'risk'}
					<p class="mb-4 text-[11px] font-semibold tracking-widest text-yellow-600 uppercase">
						Khu vực cần chú ý — {riskLocations.length}
					</p>
					{#if riskLocations.length}
						<ul class="flex flex-col divide-y divide-gray-100/80">
							{#each riskLocations as d (d.locationId)}
								<li class="flex items-center gap-4 py-3">
									{@render dot(d.alertLevel)}
									<span class="w-32 font-medium">{d.name}</span>
									<span class="text-sm text-gray-500">{d.alert?.reason}</span>
									<span
										class={clsx(
											'ml-auto rounded-full px-2.5 py-1 text-xs font-medium',
											ALERT_BADGE[d.alertLevel]
										)}>{ALERT_LABEL[d.alertLevel]}</span
									>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-gray-400">Tất cả khu vực trong ngưỡng an toàn.</p>
					{/if}
				{:else if activeCard === 'next'}
					<p class="mb-4 text-[11px] font-semibold tracking-widest text-red-500 uppercase">
						Xếp hạng theo thời gian còn lại
					</p>
					<ul class="flex flex-col divide-y divide-gray-100/80">
						{#each byUrgency as d, i (d.locationId)}
							<li class="flex items-center gap-4 py-3">
								<span class="w-5 text-sm font-bold tabular-nums text-gray-600">{i + 1}</span>
								{@render dot(d.alertLevel)}
								<span class="font-medium">{d.name}</span>
								<span class="ml-auto w-32 text-right text-sm font-semibold tabular-nums">
									{d.alert ? `Còn ${d.alert.hoursAhead}h` : 'Không có'}
								</span>
							</li>
						{/each}
					</ul>
				{:else if activeCard === 'rain'}
					<p class="mb-4 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
						Lượng mưa dự báo ngày mai (mm)
					</p>
					<ul class="flex flex-col divide-y divide-gray-100/80">
						{#each byRainTomorrow as d, i (d.locationId)}
							{@const rain = d.daily[1]?.rainSum ?? d.today.rainSum}
							<li class="flex items-center gap-4 py-3">
								<span class="w-5 text-sm font-bold tabular-nums text-gray-600">{i + 1}</span>
								{@render dot(d.alertLevel)}
								<span class="font-medium">{d.name}</span>
								<div class="ml-auto flex items-center gap-3">
									<div class="h-1.5 w-32 overflow-hidden rounded-full bg-gray-100">
										<div
											class="h-full rounded-full bg-accent/60"
											style="width: {Math.min((rain / 100) * 100, 100).toFixed(0)}%"
										></div>
									</div>
									<span class="w-14 text-right text-sm font-semibold tabular-nums">
										{rain.toFixed(0)} mm
									</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/key}
	{/if}
</section>
