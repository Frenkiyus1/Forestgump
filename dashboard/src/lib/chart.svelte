<script lang="ts">
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	interface Point {
		ts: string; // ISO date/time
		value: number;
	}

	let {
		points,
		label = 'Giá trị',
		unit = '',
		color = '#1e6f5c'
	}: { points: Point[]; label?: string; unit?: string; color?: string } = $props();

	let wrap = $state<HTMLDivElement>();
	const HEIGHT = 240;

	$effect(() => {
		const el = wrap;
		if (!el) return;

		const xs = points.map((p) => new Date(p.ts).getTime() / 1000);
		const ys = points.map((p) => p.value);

		// Tooltip tự vẽ tay: gắn thẳng vào lớp overlay của uPlot (u.over) nên
		// cursor.left/top dùng được luôn, không phải cộng bù offset trục.
		const tip = document.createElement('div');
		tip.className =
			'pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-black/[0.06] bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-[0_8px_20px_-8px_rgba(31,25,16,0.35)]';

		const opts: uPlot.Options = {
			width: el.clientWidth || 600,
			height: HEIGHT,
			scales: { x: { time: true } },
			legend: { show: false },
			cursor: { points: { size: 6 } },
			hooks: {
				setCursor: [
					(u) => {
						const i = u.cursor.idx;
						const x = i == null ? null : xs[i];
						const y = i == null ? null : ys[i];
						if (x == null || y == null || u.cursor.left == null || u.cursor.left < 0) {
							tip.style.display = 'none';
							return;
						}
						const time = new Date(x * 1000).toLocaleDateString('vi-VN', {
							day: '2-digit',
							month: '2-digit'
						});
						tip.innerHTML = `<p class="font-semibold text-gray-900">${y.toFixed(1)}${unit}</p><p class="text-gray-400">${time}</p>`;
						tip.style.left = `${u.cursor.left}px`;
						tip.style.top = `${u.cursor.top ?? 0}px`;
						tip.style.display = 'block';
					}
				]
			},
			series: [
				{},
				{
					label: `${label}${unit ? ` (${unit})` : ''}`,
					stroke: color,
					width: 2.5,
					fill: `${color}24`,
					points: { show: false }
				}
			],
			axes: [
				{
					stroke: '#9ca3af',
					grid: { stroke: 'rgba(31,25,16,0.05)', width: 1 },
					ticks: { stroke: 'rgba(31,25,16,0.1)', width: 1 }
				},
				{
					stroke: '#9ca3af',
					size: 44,
					grid: { stroke: 'rgba(31,25,16,0.05)', width: 1 },
					ticks: { stroke: 'rgba(31,25,16,0.1)', width: 1 }
				}
			]
		};

		const chart = new uPlot(opts, [xs, ys], el);
		chart.over.appendChild(tip);
		const ro = new ResizeObserver(() => chart.setSize({ width: el.clientWidth, height: HEIGHT }));
		ro.observe(el);

		return () => {
			ro.disconnect();
			chart.destroy();
		};
	});
</script>

<div bind:this={wrap} class="w-full"></div>
