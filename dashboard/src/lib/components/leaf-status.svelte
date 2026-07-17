<script lang="ts">
	type Alert = 'green' | 'yellow' | 'red';
	interface Props {
		alert: Alert;
	}
	let { alert }: Props = $props();

	// Standard leaf: base at (0,0), tip at (0,-20), belly ±9px.
	// Each leaf is this path with a translate+rotate transform applied.
	// Rotating by θ tilts the tip: negative θ = left, positive = right.
	// Green  ±40° → upright-outward leaves (healthy)
	// Yellow ±78° → roughly horizontal leaves (wilting sideways)
	// Red   ±125° → drooping downward leaves (dying)
	const LEAF = 'M 0 0 C 9 -3 9 -15 0 -20 C -9 -15 -9 -3 0 0 Z';
</script>

{#if alert === 'green'}
	<!--
		Healthy plant: 4 leaves in 2 pairs, both pointing up-outward.
		Stem: y=52 → y=10 (full height). Upper pair y=20, lower pair y=37.
	-->
	<svg viewBox="0 0 48 56" class="h-11 w-10 shrink-0" aria-hidden="true" fill="none">
		<line
			x1="24"
			y1="52"
			x2="24"
			y2="10"
			stroke="#15803d"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<g transform="translate(24,20) rotate(-40)"><path d={LEAF} fill="#86efac" /></g>
		<g transform="translate(24,20) rotate(40)"><path d={LEAF} fill="#4ade80" /></g>
		<g transform="translate(24,37) rotate(-45)"><path d={LEAF} fill="#22c55e" /></g>
		<g transform="translate(24,37) rotate(45)"><path d={LEAF} fill="#16a34a" /></g>
	</svg>
{:else if alert === 'yellow'}
	<!--
		Stressed plant: leaves droop sideways (nearly horizontal).
		Stem: y=52 → y=14 (slightly shorter). Leaves at y=24, y=41.
	-->
	<svg viewBox="0 0 48 56" class="h-11 w-10 shrink-0" aria-hidden="true" fill="none">
		<line
			x1="24"
			y1="52"
			x2="24"
			y2="14"
			stroke="#a16207"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<g transform="translate(24,24) rotate(-78)"><path d={LEAF} fill="#fef08a" /></g>
		<g transform="translate(24,24) rotate(78)"><path d={LEAF} fill="#facc15" /></g>
		<g transform="translate(24,41) rotate(-82)"><path d={LEAF} fill="#facc15" /></g>
		<g transform="translate(24,41) rotate(82)"><path d={LEAF} fill="#eab308" /></g>
	</svg>
{:else}
	<!--
		Dying plant: leaves wilt downward, burnt orange-red palette.
		Stem: y=52 → y=18 (short/wilted). Leaves at y=28, y=43.
	-->
	<svg viewBox="0 0 48 56" class="h-11 w-10 shrink-0" aria-hidden="true" fill="none">
		<line
			x1="24"
			y1="52"
			x2="24"
			y2="18"
			stroke="#92400e"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<g transform="translate(24,28) rotate(-125)"><path d={LEAF} fill="#fb923c" /></g>
		<g transform="translate(24,28) rotate(125)"><path d={LEAF} fill="#f97316" /></g>
		<g transform="translate(24,43) rotate(-130)"><path d={LEAF} fill="#ea580c" /></g>
		<g transform="translate(24,43) rotate(130)"><path d={LEAF} fill="#dc2626" /></g>
	</svg>
{/if}
