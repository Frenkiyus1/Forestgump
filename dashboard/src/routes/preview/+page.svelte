<script lang="ts">
	// Isolated identity preview — uses arbitrary hex so the live theme tokens
	// (layout.css @theme) stay untouched until this direction is approved.
	// Direction: "estuary" — near-white surfaces, deep-teal accent, single Inter
	// grotesque, salinity-gradient signature. Status colours only for alerts.

	const INK = '#0B1F24';
	const SUB = '#5B6B6E';
	const ACCENT = '#0A6E78';

	// Salinity scale signature: position EC (g/L) on a fresh→saline gradient,
	// capped at 6 g/L. Ticks mark the 1 & 4 g/L decision thresholds.
	const SCALE_MAX = 6;
	const pct = (ec: number) => Math.min(ec / SCALE_MAX, 1) * 100;

	const kpis = [
		{ label: 'Safe stations', value: '2', suffix: '/5', sub: '40% of network', tone: '#1E9E6A' },
		{ label: 'At risk', value: '3', sub: 'Caution or danger', tone: '#E0A012' },
		{ label: 'Peak salinity', value: '5.0', unit: 'g/L', sub: '24h forecast', tone: '#D63A3A' },
		{ label: 'Avg water level', value: '1.4', unit: 'm', sub: 'Across network', tone: SUB }
	];

	const stations = [
		{ name: 'Lạch Tray', region: 'Đồ Sơn', ec: 4.6, status: 'Danger', color: '#D63A3A' },
		{ name: 'Đa Độ', region: 'Kiến Thụy', ec: 2.3, status: 'Caution', color: '#E0A012' },
		{ name: 'Văn Úc', region: 'Tiên Lãng', ec: 0.6, status: 'Safe', color: '#1E9E6A' }
	];

	const nav = ['Overview', 'Stations', 'Map', 'Alerts', 'Reports'];
</script>

<svelte:head><title>Identity preview — ForestGump</title></svelte:head>

<!-- salinity gradient: fresh teal → brackish amber → saline red -->
{#snippet scale(ec: number)}
	<div
		class="relative h-2 w-full rounded-full"
		style="background: linear-gradient(90deg,#0A6E78 0%,#3BA4A0 16%,#E0A012 50%,#D63A3A 100%);"
	>
		<span class="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/70" style="left:{pct(1)}%"
		></span>
		<span class="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-white/70" style="left:{pct(4)}%"
		></span>
		<span
			class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-sm"
			style="left:{pct(ec)}%; background:{INK}"
		></span>
	</div>
{/snippet}

<div class="min-h-screen w-full bg-[#FBFBFD] font-[Inter] text-[#0B1F24] antialiased">
	<div class="mx-auto max-w-5xl px-6 py-16">
		<p class="text-[11px] font-semibold tracking-[0.18em] text-[#5B6B6E] uppercase">
			Visual identity · estuary
		</p>

		<div class="mt-4 flex items-center gap-3">
			<span class="grid h-9 w-9 place-items-center rounded-xl" style="background:{ACCENT}">
				<span class="h-2 w-4 rounded-full" style="background: linear-gradient(90deg,#9BE7DF,#fff)"
				></span>
			</span>
			<span class="text-lg font-semibold tracking-tight">ForestGump</span>
		</div>

		<h1 class="mt-8 max-w-2xl text-5xl leading-[1.04] font-semibold tracking-[-0.03em]">
			Know the water before it reaches the gate.
		</h1>
		<p class="mt-4 max-w-xl text-[15px] leading-relaxed text-[#5B6B6E]">
			Salinity intrusion, forecast 24–72 hours ahead across Vietnam's coastal provinces — read
			against the 1 and 4 g/L irrigation thresholds.
		</p>

		<div
			class="mt-10 rounded-3xl border border-[#E6EAEB] bg-white p-7 shadow-[0_1px_2px_rgba(11,31,36,0.04),0_24px_48px_-32px_rgba(11,31,36,0.18)]"
		>
			<div class="flex items-end justify-between">
				<div>
					<p class="text-[11px] font-semibold tracking-[0.14em] text-[#5B6B6E] uppercase">
						Network salinity now
					</p>
					<p class="mt-2 text-6xl font-semibold tracking-[-0.04em] tabular-nums">
						4.6<span class="ml-1 text-2xl font-medium text-[#9AA7A9]">g/L</span>
					</p>
				</div>
				<span
					class="rounded-full px-3 py-1 text-xs font-semibold"
					style="background:#FBE9E7;color:#D63A3A"
				>
					Danger
				</span>
			</div>
			<div class="mt-7">{@render scale(4.6)}</div>
			<div class="mt-2 flex justify-between text-[11px] tabular-nums text-[#9AA7A9]">
				<span>0 · fresh</span>
				<span>1 · caution</span>
				<span>4 · danger</span>
				<span>6 g/L</span>
			</div>
		</div>

		<div class="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
			{#each kpis as k (k.label)}
				<div
					class="rounded-2xl border border-[#E6EAEB] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,36,0.03)]"
				>
					<p class="text-[13px] font-medium text-[#5B6B6E]">{k.label}</p>
					<p class="mt-3 text-3xl font-semibold tracking-[-0.02em] tabular-nums">
						{k.value}{#if k.suffix}<span class="text-[#9AA7A9]">{k.suffix}</span
							>{/if}{#if k.unit}<span class="ml-1 text-lg font-medium text-[#9AA7A9]">{k.unit}</span
							>{/if}
					</p>
					<p class="mt-1 text-xs font-medium" style="color:{k.tone}">{k.sub}</p>
				</div>
			{/each}
		</div>

		<p class="mt-14 text-[11px] font-semibold tracking-[0.18em] text-[#5B6B6E] uppercase">
			Station card
		</p>
		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
			{#each stations as s (s.name)}
				<div
					class="group rounded-2xl border border-[#E6EAEB] bg-white p-5 shadow-[0_1px_2px_rgba(11,31,36,0.03)] transition hover:shadow-[0_1px_2px_rgba(11,31,36,0.04),0_20px_40px_-28px_rgba(11,31,36,0.22)]"
				>
					<div class="flex items-start justify-between">
						<div>
							<p class="font-semibold tracking-tight">{s.name}</p>
							<p class="text-xs text-[#9AA7A9]">{s.region}</p>
						</div>
						<span class="flex items-center gap-1.5">
							<span class="h-2 w-2 rounded-full" style="background:{s.color}"></span>
							<span class="text-xs font-medium text-[#5B6B6E]">{s.status}</span>
						</span>
					</div>
					<p class="mt-4 text-3xl font-semibold tracking-[-0.02em] tabular-nums">
						{s.ec}<span class="ml-1 text-base font-medium text-[#9AA7A9]">g/L</span>
					</p>
					<div class="mt-4">{@render scale(s.ec)}</div>
				</div>
			{/each}
		</div>

		<p class="mt-14 text-[11px] font-semibold tracking-[0.18em] text-[#5B6B6E] uppercase">
			Controls & nav
		</p>
		<div class="mt-4 flex flex-wrap items-center gap-3">
			<button
				class="rounded-full px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
				style="background:{ACCENT}"
			>
				Export report
			</button>
			<button
				class="rounded-full border border-[#E6EAEB] bg-white px-4 py-2 text-sm font-medium text-[#0B1F24] transition hover:bg-[#F2F5F5]"
			>
				Secondary
			</button>
			<div class="flex gap-1 rounded-full bg-[#EEF2F2] p-1">
				<span
					class="rounded-full px-4 py-1.5 text-sm font-medium text-white"
					style="background:{ACCENT}">7 days</span
				>
				<span class="rounded-full px-4 py-1.5 text-sm font-medium text-[#5B6B6E]">30 days</span>
			</div>
		</div>

		<div
			class="mt-6 inline-flex w-60 flex-col gap-1 rounded-2xl border border-[#E6EAEB] bg-white p-3 shadow-[0_1px_2px_rgba(11,31,36,0.03)]"
		>
			{#each nav as item, i (item)}
				<span
					class="rounded-xl px-3 py-2.5 text-sm transition"
					style={i === 0 ? `background:#E6F1F2;color:${ACCENT};font-weight:600` : `color:${SUB}`}
				>
					{item}
				</span>
			{/each}
		</div>

		<p class="mt-14 max-w-xl text-xs leading-relaxed text-[#9AA7A9]">
			Isolated preview — live pages still use the current amber theme. Approve this direction and
			the tokens move into layout.css + app-shell so every page inherits it.
		</p>
	</div>
</div>
