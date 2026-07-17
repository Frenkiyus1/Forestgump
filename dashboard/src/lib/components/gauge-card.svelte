<script lang="ts">
	interface Props {
		title: string;
		percent: number;
		linkLabel: string;
	}
	let { title, percent, linkLabel }: Props = $props();

	const HALF_CIRC = Math.PI * 60; // ≈ 188.5
	const dash = $derived((Math.max(0, Math.min(100, percent)) / 100) * HALF_CIRC);
</script>

<section class="flex flex-col items-center gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="self-start text-sm font-medium text-gray-500">{title}</h2>
	<svg viewBox="0 0 140 80" class="w-40" role="img" aria-label="{title}: {percent}%">
		<path
			d="M10 70 A60 60 0 0 1 130 70"
			fill="none"
			stroke="#fde9c8"
			stroke-width="12"
			stroke-linecap="round"
		/>
		<path
			d="M10 70 A60 60 0 0 1 130 70"
			fill="none"
			stroke="#f59e0b"
			stroke-width="12"
			stroke-linecap="round"
			stroke-dasharray="{dash} {HALF_CIRC}"
		/>
		<text x="70" y="68" text-anchor="middle" class="fill-gray-900 text-2xl font-bold"
			>{percent}%</text
		>
	</svg>
	<a href="#goal" class="text-sm font-medium text-accent">{linkLabel} →</a>
</section>
