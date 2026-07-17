<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD_INTERACTIVE } from '$lib/ui';
	import { reveal } from '$lib/actions/reveal';

	const TREND = [0.6, 0.9, 1.4, 2.1, 3.2, 2.6, 1.8];
	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	// ---- area chart geometry (smooth Catmull-Rom → bezier) ----
	const W = 680;
	const H = 240;
	const PAD = 20;
	const maxY = Math.max(...TREND) * 1.18;
	const pts = TREND.map((v, i) => {
		const x = PAD + (i / (TREND.length - 1)) * (W - 2 * PAD);
		const y = H - PAD - (v / maxY) * (H - 2 * PAD);
		return [x, y] as const;
	});
	function smooth(p: readonly (readonly [number, number])[]): string {
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
	const linePath = smooth(pts);
	const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${H - PAD} L ${pts[0][0]} ${H - PAD} Z`;

	let hoveredIdx = $state<number | null>(null);
	let modalOpen = $state(false);

	// ---- modal stats ----
	const trendMin = Math.min(...TREND);
	const trendMax = Math.max(...TREND);
	const trendAvg = +(TREND.reduce((a, b) => a + b, 0) / TREND.length).toFixed(2);
	const trendPeakDay = DAYS[TREND.indexOf(trendMax)];
	const trendChanges = TREND.map((v, i) => (i === 0 ? null : +(v - TREND[i - 1]).toFixed(1)));

	function statusFor(v: number): { label: string; cls: string; dot: string } {
		if (v < 1) return { label: 'Safe', cls: 'text-green-600', dot: 'bg-green-500' };
		if (v < 4) return { label: 'Caution', cls: 'text-yellow-600', dot: 'bg-yellow-500' };
		return { label: 'Danger', cls: 'text-red-600', dot: 'bg-red-600' };
	}

	// ---- modal chart: larger viewport ----
	const MW = 800;
	const MH = 200;
	const MPAD = 24;
	const mmaxY = trendMax * 1.2;
	const mpts = TREND.map((v, i) => {
		const x = MPAD + (i / (TREND.length - 1)) * (MW - 2 * MPAD);
		const y = MH - MPAD - (v / mmaxY) * (MH - 2 * MPAD);
		return [x, y] as const;
	});
	const mLinePath = smooth(mpts);
	const mAreaPath = `${mLinePath} L ${mpts[mpts.length - 1][0]} ${MH - MPAD} L ${mpts[0][0]} ${MH - MPAD} Z`;

	// threshold y positions in modal chart
	const cautionY = MH - MPAD - (1 / mmaxY) * (MH - 2 * MPAD);
	const dangerY = MH - MPAD - (4 / mmaxY) * (MH - 2 * MPAD);

	const SENSORS_ONLINE = 96;
	const ringCirc = 2 * Math.PI * 52;
	const ringFill = (SENSORS_ONLINE / 100) * ringCirc;
</script>

<section class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div
		use:reveal
		class={clsx(CARD_INTERACTIVE, 'cursor-pointer p-6 lg:col-span-2')}
		role="button"
		tabindex="0"
		onclick={() => (modalOpen = true)}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (modalOpen = true)}
		aria-label="View salinity trend details"
	>
		<div class="mb-4 flex items-end justify-between">
			<div>
				<h2 class="text-base font-semibold tracking-tight">Salinity trend</h2>
				<p class="text-xs text-gray-400">Last 7 days · network average (g/L)</p>
			</div>
			<span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600"
				>Peak 3.2</span
			>
		</div>
		<svg viewBox="0 0 {W} {H}" class="h-56 w-full" role="img" aria-label="Salinity trend chart">
			<defs>
				<linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#f59e0b" stop-opacity="0.28" />
					<stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
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
				stroke="#f59e0b"
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
					stroke="#f59e0b"
					stroke-width="2"
					style="transition: r 0.15s ease; cursor: crosshair;"
					onmouseenter={() => (hoveredIdx = i)}
					onmouseleave={() => (hoveredIdx = null)}
					role="img"
					aria-label="{DAYS[i]}: {TREND[i]} g/L"
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
						font-weight="600">{TREND[hoveredIdx]} g/L</text
					>
					<text
						x={tp[0]}
						y={tp[1] - 16}
						text-anchor="middle"
						fill="#d4a72c"
						font-size="10"
						font-family="Inter, sans-serif">{DAYS[hoveredIdx]}</text
					>
				</g>
			{/if}
		</svg>
		<div class="mt-2 flex justify-between px-1 text-[11px] text-gray-400">
			{#each DAYS as d (d)}<span>{d}</span>{/each}
		</div>
	</div>

	<div
		use:reveal={{ delay: 80 }}
		class={clsx(CARD_INTERACTIVE, 'flex flex-col items-center justify-center p-6')}
	>
		<h2 class="self-start text-base font-semibold tracking-tight">Sensors online</h2>
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
					stroke="#f59e0b"
					stroke-width="10"
					stroke-linecap="round"
					stroke-dasharray="{ringFill} {ringCirc}"
				/>
			</svg>
			<div class="absolute text-center">
				<p class="text-3xl font-semibold tracking-tight">{SENSORS_ONLINE}%</p>
				<p class="text-[11px] text-gray-400">24 / 25 devices</p>
			</div>
		</div>
		<p class="text-center text-xs text-gray-500">One sensor at Đá Bạc offline since 03:12</p>
	</div>
</section>

{#if modalOpen}
	<!-- overlay wrapper: handles centering + backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center p-4 lg:pl-72 lg:pr-24 lg:py-8"
		role="dialog"
		aria-modal="true"
		aria-label="Salinity trend — 7-day details"
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/40 backdrop-blur-sm"
			aria-label="Close details"
			aria-hidden="true"
			tabindex="-1"
			onclick={() => (modalOpen = false)}
		></button>

		<div
			class="modal-scroll modal-enter relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-3xl bg-white p-8 shadow-[0_4px_48px_rgba(31,25,16,0.22)]"
		>
			<div class="mb-6 flex items-start justify-between">
				<div>
					<h2 class="text-lg font-semibold tracking-tight">Salinity trend</h2>
					<p class="text-sm text-gray-400">Last 7 days · network average (g/L)</p>
				</div>
				<button
					type="button"
					onclick={() => (modalOpen = false)}
					aria-label="Close"
					class="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-accent"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
					</svg>
				</button>
			</div>

			<!-- summary stats -->
			<div class="mb-6 grid grid-cols-4 gap-3">
				{#each [{ label: 'Min', value: trendMin, unit: 'g/L', cls: 'text-green-600' }, { label: 'Max', value: trendMax, unit: 'g/L', cls: 'text-red-600' }, { label: 'Average', value: trendAvg, unit: 'g/L', cls: 'text-gray-700' }, { label: 'Peak day', value: trendPeakDay, unit: '', cls: 'text-accent' }] as stat (stat.label)}
					<div class="rounded-2xl bg-gray-50 p-4">
						<p class="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
							{stat.label}
						</p>
						<p class="mt-2 text-xl font-bold tabular-nums">
							{stat.value}<span class="ml-0.5 text-sm font-medium text-gray-400">{stat.unit}</span>
						</p>
					</div>
				{/each}
			</div>

			<!-- larger chart with threshold lines -->
			<div class="mb-6 overflow-hidden rounded-2xl bg-gray-50 p-4">
				<svg
					viewBox="0 0 {MW} {MH}"
					class="h-48 w-full"
					role="img"
					aria-label="Detailed salinity chart"
				>
					<defs>
						<linearGradient id="mfill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#f59e0b" stop-opacity="0.22" />
							<stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
						</linearGradient>
					</defs>
					<!-- caution threshold line -->
					<line
						x1={MPAD}
						x2={MW - MPAD}
						y1={cautionY}
						y2={cautionY}
						stroke="#eab308"
						stroke-opacity="0.5"
						stroke-dasharray="4 4"
					/>
					<text
						x={MW - MPAD - 2}
						y={cautionY - 4}
						text-anchor="end"
						fill="#ca8a04"
						font-size="9"
						font-family="Inter, sans-serif">1 g/L caution</text
					>
					<!-- danger threshold line (only if max > 4) -->
					{#if trendMax > 4}
						<line
							x1={MPAD}
							x2={MW - MPAD}
							y1={dangerY}
							y2={dangerY}
							stroke="#ef4444"
							stroke-opacity="0.5"
							stroke-dasharray="4 4"
						/>
						<text
							x={MW - MPAD - 2}
							y={dangerY - 4}
							text-anchor="end"
							fill="#dc2626"
							font-size="9"
							font-family="Inter, sans-serif">4 g/L danger</text
						>
					{/if}
					<path d={mAreaPath} fill="url(#mfill)" />
					<path
						d={mLinePath}
						fill="none"
						stroke="#f59e0b"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					{#each mpts as p, i (i)}
						<circle cx={p[0]} cy={p[1]} r="3.5" fill="#fff" stroke="#f59e0b" stroke-width="2" />
					{/each}
				</svg>
				<div class="mt-1 flex justify-between px-1 text-[10px] text-gray-400">
					{#each DAYS as d (d)}<span>{d}</span>{/each}
				</div>
			</div>

			<!-- day-by-day table -->
			<p class="mb-3 text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
				Day-by-day breakdown
			</p>
			<ul class="flex flex-col divide-y divide-gray-100">
				{#each TREND as v, i (i)}
					{@const st = statusFor(v)}
					{@const change = trendChanges[i]}
					<li class="flex items-center gap-4 py-2.5">
						<span class="w-8 text-sm font-bold text-gray-600">{DAYS[i]}</span>
						<span
							class="inline-flex h-4 w-4 items-center justify-center rounded-full {st.dot ===
							'bg-green-500'
								? 'bg-green-100'
								: st.dot === 'bg-yellow-500'
									? 'bg-yellow-100'
									: 'bg-red-100'}"
							aria-hidden="true"
						>
							<span class="h-2 w-2 rounded-full {st.dot}"></span>
						</span>
						<span class="text-sm font-semibold tabular-nums">{v} g/L</span>
						<span class={clsx('text-xs font-medium', st.cls)}>{st.label}</span>
						{#if change !== null}
							<span
								class={clsx(
									'ml-auto text-xs tabular-nums font-medium',
									change > 0 ? 'text-red-500' : change < 0 ? 'text-green-600' : 'text-gray-400'
								)}
							>
								{change > 0 ? '+' : ''}{change}
							</span>
						{:else}
							<span class="ml-auto text-xs text-gray-300">—</span>
						{/if}
					</li>
				{/each}
			</ul>

			<!-- threshold legend -->
			<div class="mt-6 flex flex-wrap gap-4 border-t border-gray-100 pt-5">
				{#each [{ dot: 'bg-green-500', halo: 'bg-green-100', label: '< 1 g/L — Safe · normal irrigation' }, { dot: 'bg-yellow-500', halo: 'bg-yellow-100', label: '1–4 g/L — Caution · prepare gates' }, { dot: 'bg-red-600', halo: 'bg-red-100', label: '> 4 g/L — Danger · close gates now' }] as t (t.label)}
					<span class="flex items-center gap-2 text-xs text-gray-500">
						<span class="inline-flex h-4 w-4 items-center justify-center rounded-full {t.halo}">
							<span class="h-2 w-2 rounded-full {t.dot}"></span>
						</span>
						{t.label}
					</span>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.97) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	.modal-enter {
		animation: modal-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	/* inset, rounded scrollbar so it clears the panel's rounded corners */
	.modal-scroll {
		scrollbar-gutter: stable;
		scrollbar-width: thin;
		scrollbar-color: rgba(31, 25, 16, 0.18) transparent;
	}
	.modal-scroll::-webkit-scrollbar {
		width: 12px;
	}
	.modal-scroll::-webkit-scrollbar-track {
		background: transparent;
		margin: 20px 0;
	}
	.modal-scroll::-webkit-scrollbar-thumb {
		background-color: rgba(31, 25, 16, 0.18);
		border-radius: 9999px;
		border: 4px solid transparent;
		background-clip: padding-box;
	}
	.modal-scroll::-webkit-scrollbar-thumb:hover {
		background-color: rgba(31, 25, 16, 0.3);
	}
	@media (prefers-reduced-motion: reduce) {
		.modal-enter {
			animation: none;
		}
	}
</style>
