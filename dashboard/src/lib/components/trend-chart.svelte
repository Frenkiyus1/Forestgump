<script lang="ts">
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	interface Props {
		series: { labels: string[]; values: number[] };
	}
	let { series }: Props = $props();

	let container: HTMLDivElement;
	let chart: uPlot | undefined;

	$effect(() => {
		const xs = series.labels.map((_, i) => i);
		const data: uPlot.AlignedData = [xs, series.values];
		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 220,
			scales: { x: { time: false } },
			axes: [{ values: (_u, splits) => splits.map((i) => series.labels[i] ?? '') }, {}],
			series: [
				{},
				{
					stroke: '#f59e0b',
					fill: 'rgba(245,158,11,0.15)',
					width: 2,
					points: { show: false }
				}
			],
			legend: { show: false }
		};
		chart = new uPlot(opts, data, container);

		const ro = new ResizeObserver(() =>
			chart?.setSize({ width: container.clientWidth, height: 220 })
		);
		ro.observe(container);

		return () => {
			ro.disconnect();
			chart?.destroy();
			chart = undefined;
		};
	});
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<header class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Xu hướng độ mặn</h2>
		<span class="text-sm text-gray-500">7 ngày</span>
	</header>
	<div bind:this={container} class="w-full"></div>
</section>
