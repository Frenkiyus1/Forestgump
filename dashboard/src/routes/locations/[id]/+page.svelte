<script lang="ts">
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';
	import Chart from '$lib/chart.svelte';
	import type { Bulletin } from '$lib/types';
	import { getForecast } from '$lib/weather';
	import { generateBulletin } from '$lib/bulletin';
	import AppShell from '$lib/components/app-shell.svelte';
	import AlertBanner from '$lib/components/alert-banner.svelte';
	import AlertBannerSkeleton from '$lib/components/alert-banner-skeleton.svelte';
	import { ALERT_LABEL, ALERT_BADGE, ALERT_HEX, HAZARD_LABEL, relativeTime } from '$lib/alert-ui';

	let { data }: { data: PageData } = $props();
	const detail = $derived(data.detail);
	// Poll 10s ở +layout.svelte tạo `detail` object mới mỗi lần dù nội dung
	// không đổi -> tách locationId ra $derived riêng để effect bên dưới chỉ
	// load lại bản tin khi chuỗi locationId thực sự khác, tránh banner giật
	// về skeleton mỗi lần poll (xem cùng pattern ở routes/+page.svelte).
	const detailLocationId = $derived(detail.locationId);

	let lang = $state<Bulletin['lang']>('vi');
	let bulletin = $state<Bulletin | null>(null);
	let bulletinLoading = $state(true);

	async function loadBulletin(locationId: string, currentLang: Bulletin['lang']) {
		bulletinLoading = true;
		try {
			const forecast = await getForecast(locationId);
			bulletin = await generateBulletin(forecast, currentLang);
		} finally {
			bulletinLoading = false;
		}
	}

	$effect(() => {
		loadBulletin(detailLocationId, lang);
	});

	// Gauge hiển thị 3 chỉ số hôm nay, tô màu theo mức cảnh báo hiện tại của khu
	// vực (không suy diễn ngưỡng riêng cho từng chỉ số — tránh bịa số liệu).
	const GAUGE_C = 2 * Math.PI * 30;
	const gauges = $derived(
		[
			{ label: 'Nhiệt độ cao nhất', value: detail.today.tempMax, unit: '°C', max: 40 },
			{ label: 'Lượng mưa', value: detail.today.rainSum, unit: 'mm', max: 100 },
			{ label: 'Tầm nhìn thấp nhất', value: detail.today.visibilityMin, unit: 'm', max: 5000 }
		].map((g) => ({
			...g,
			fill: Math.min(g.value / g.max, 1) * GAUGE_C
		}))
	);

	const extras = $derived([
		{ label: 'Nhiệt độ thấp nhất', value: `${detail.today.tempMin}`, unit: '°C' },
		{ label: 'Mưa cực đại', value: `${detail.today.rainMax1h}`, unit: 'mm/h' },
		{ label: 'Độ ẩm cao nhất', value: `${detail.today.humidityMax}`, unit: '%' },
		{
			label: 'Toạ độ',
			value: `${detail.lat.toFixed(3)}, ${detail.lon.toFixed(3)}`,
			unit: ''
		}
	]);

	const rainPoints = $derived(detail.daily.map((d) => ({ ts: d.date, value: d.rainSum })));
</script>

<svelte:head><title>{detail.name} — ForestGump</title></svelte:head>

<AppShell {lang} onLangChange={(l) => (lang = l)}>
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

	<a
		href={resolve('/locations')}
		class="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
	>
		<svg
			viewBox="0 0 24 24"
			class="h-4 w-4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="m15 18-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Tất cả khu vực
	</a>

	<!-- header -->
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<div class="flex items-center gap-3">
				<h1
					class="text-4xl leading-tight font-semibold tracking-tight"
					style="font-family: 'Lora', serif;"
				>
					{detail.name}
				</h1>
				<span
					class={clsx(
						'rounded-full px-2.5 py-1 text-xs font-medium',
						ALERT_BADGE[detail.alertLevel]
					)}
				>
					{ALERT_LABEL[detail.alertLevel]}
				</span>
			</div>
			<p class="mt-2 text-[15px] text-gray-500">
				{detail.terrain} · Cập nhật {relativeTime(detail.updatedAt)}
				{#if detail.alert?.type}
					· Rủi ro chính: {HAZARD_LABEL[detail.alert.type]}
				{/if}
			</p>
		</div>
	</div>

	<div class="mb-6">
		{#if bulletinLoading}
			<AlertBannerSkeleton />
		{:else}
			<AlertBanner alert={detail.alert} {bulletin} {bulletinLoading} />
		{/if}
	</div>

	<!-- gauges -->
	<section class="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Chỉ số hôm nay">
		{#each gauges as g (g.label)}
			<div class={clsx(CARD, 'flex flex-col items-center p-6')}>
				<div class="relative grid place-items-center">
					<svg viewBox="0 0 72 72" class="h-28 w-28 -rotate-90">
						<circle
							cx="36"
							cy="36"
							r="30"
							fill="none"
							stroke={ALERT_HEX[detail.alertLevel]}
							stroke-opacity="0.16"
							stroke-width="7"
						/>
						<circle
							cx="36"
							cy="36"
							r="30"
							fill="none"
							stroke={ALERT_HEX[detail.alertLevel]}
							stroke-width="7"
							stroke-linecap="round"
							stroke-dasharray="{g.fill} {GAUGE_C}"
						/>
					</svg>
					<div class="absolute text-center">
						<p class="text-2xl leading-none font-semibold tracking-tight text-gray-900">
							{g.value}
						</p>
						<p class="text-[11px] text-gray-500">{g.unit}</p>
					</div>
				</div>
				<p class="mt-3 text-sm font-medium text-gray-600">{g.label}</p>
			</div>
		{/each}
	</section>

	<!-- extras -->
	<section class="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Chỉ số khác">
		{#each extras as stat (stat.label)}
			<div class={clsx(CARD, 'px-5 py-4')}>
				<p class="text-[11px] text-gray-500">{stat.label}</p>
				<p class="mt-1 text-xl font-semibold tracking-tight">
					{stat.value}{#if stat.unit}<span class="ml-0.5 text-sm font-medium text-gray-400"
							>{stat.unit}</span
						>{/if}
				</p>
			</div>
		{/each}
	</section>

	<!-- 7-day rain chart -->
	<section class={clsx(CARD, 'overflow-hidden p-6')} aria-label="Dự báo mưa 7 ngày">
		<div class="mb-4">
			<h2 class="text-base font-semibold tracking-tight">Dự báo mưa 7 ngày</h2>
			<p class="text-xs text-gray-400">mm/ngày</p>
		</div>
		<div class="min-h-[240px]">
			<Chart points={rainPoints} label="Mưa" unit="mm" />
		</div>
	</section>
</AppShell>
