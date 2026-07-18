<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';
	import type { LocationDetail } from '$lib/derive';

	interface Props {
		detail: LocationDetail;
	}
	let { detail }: Props = $props();

	const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
	const dayLabels = $derived(detail.daily.map((d) => DAYS[new Date(d.date).getDay()]));
	const rain = $derived(detail.daily.map((d) => d.rainSum));

	// ---- area chart geometry (smooth Catmull-Rom → bezier) ----
	const W = 680;
	const H = 240;
	const PAD = 20;
	const maxY = $derived(Math.max(...rain, 1) * 1.18);
	const pts = $derived(
		rain.map((v, i) => {
			const x = PAD + (i / (rain.length - 1)) * (W - 2 * PAD);
			const y = H - PAD - (v / maxY) * (H - 2 * PAD);
			return [x, y] as const;
		})
	);
	function smooth(p: readonly (readonly [number, number])[]): string {
		if (p.length === 0) return '';
		let d = `M ${p[0][0]} ${p[0][1]}`;
		for (let i = 0; i < p.length - 1; i++) {
			const p0 = p[i - 1] ?? p[i];
			const p1 = p[i];
			const p2 = p[i + 1];
			const p3 = p[i + 2] ?? p2;
			const c1x = p1[0] + (p2[0] - p0[0]) / 6;
			const c1y = p1[1] + (p2[1] - p0[1]) / 6;
			const c2x = p2[0] - (p3[0] - p1[0]) / 6;
			const c2y = p2[1] - (p3[1] - p1[1]) / 6;
			d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
		}
		return d;
	}
	const linePath = $derived(smooth(pts));
	const areaPath = $derived(
		pts.length === 0
			? ''
			: `${linePath} L ${pts[pts.length - 1][0]} ${H - PAD} L ${pts[0][0]} ${H - PAD} Z`
	);
	const peak = $derived(rain.length ? Math.max(...rain) : 0);

	let hoveredIdx = $state<number | null>(null);
</script>

<section class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div use:reveal class={clsx(CARD_INTERACTIVE, 'p-6 lg:col-span-2')}>
		<div class="mb-4 flex items-end justify-between">
			<div>
				<h2 class="text-base font-semibold tracking-tight">Dự báo mưa — {detail.name}</h2>
				<p class="text-xs text-gray-400">7 ngày tới · mm/ngày</p>
			</div>
			<span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
				Đỉnh {peak.toFixed(0)}mm
			</span>
		</div>
		<svg
			viewBox="0 0 {W} {H}"
			class="h-56 w-full"
			role="img"
			aria-label="Biểu đồ dự báo mưa 7 ngày"
		>
			<defs>
				<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#1e6f5c" stop-opacity="0.28" />
					<stop offset="100%" stop-color="#1e6f5c" stop-opacity="0" />
				</linearGradient>
			</defs>
			{#each [0.25, 0.5, 0.75] as g (g)}
				<line
					x1={PAD}
					x2={W - PAD}
					y1={PAD + g * (H - 2 * PAD)}
					y2={PAD + g * (H - 2 * PAD)}
					stroke="#1f1910"
					stroke-opacity="0.06"
				/>
			{/each}
			<path d={areaPath} fill="url(#fill)" />
			<path
				d={linePath}
				fill="none"
				stroke="#1e6f5c"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{#each pts as p, i (i)}
				<circle
					cx={p[0]}
					cy={p[1]}
					r={hoveredIdx === i ? 5 : 3}
					fill="#fff"
					stroke="#1e6f5c"
					stroke-width="2"
					style="transition: r 0.15s ease; cursor: crosshair;"
					onmouseenter={() => (hoveredIdx = i)}
					onmouseleave={() => (hoveredIdx = null)}
					role="img"
					aria-label="{dayLabels[i]}: {rain[i]}mm"
				/>
			{/each}
			{#if hoveredIdx !== null}
				{@const tp = pts[hoveredIdx]}
				<g>
					<rect
						x={tp[0] - 34}
						y={tp[1] - 38}
						width="68"
						height="28"
						rx="6"
						fill="#1f1910"
						fill-opacity="0.88"
					/>
					<text
						x={tp[0]}
						y={tp[1] - 28}
						text-anchor="middle"
						fill="#fff"
						font-size="11"
						font-family="Inter, sans-serif"
						font-weight="600">{rain[hoveredIdx]}mm</text
					>
					<text
						x={tp[0]}
						y={tp[1] - 16}
						text-anchor="middle"
						fill="#4a9c87"
						font-size="10"
						font-family="Inter, sans-serif">{dayLabels[hoveredIdx]}</text
					>
				</g>
			{/if}
		</svg>
		<div class="mt-2 flex justify-between px-1 text-[11px] text-gray-400">
			{#each dayLabels as d, i (i)}<span>{d}</span>{/each}
		</div>
	</div>

	<div
		use:reveal={{ delay: 80 }}
		class={clsx(CARD_INTERACTIVE, 'flex flex-col items-center justify-center p-6')}
	>
		<h2 class="self-start text-base font-semibold tracking-tight">Trạm khí tượng</h2>
		<div class="relative my-4 grid place-items-center">
			<svg viewBox="0 0 120 120" class="h-40 w-40 -rotate-90">
				<circle
					cx="60"
					cy="60"
					r="52"
					fill="none"
					stroke="#1f1910"
					stroke-opacity="0.08"
					stroke-width="10"
				/>
				<circle
					cx="60"
					cy="60"
					r="52"
					fill="none"
					stroke="#1e6f5c"
					stroke-width="10"
					stroke-linecap="round"
					stroke-dasharray="{2 * Math.PI * 52} {2 * Math.PI * 52}"
				/>
			</svg>
			<div class="absolute text-center">
				<p class="text-3xl font-semibold tracking-tight">3/3</p>
				<p class="text-[11px] text-gray-400">khu vực có dữ liệu</p>
			</div>
		</div>
		<p class="text-center text-xs text-gray-500">
			Dữ liệu mock — sẽ nối với Đài KTTV Tây Bắc + Open-Meteo
		</p>
	</div>
</section>
