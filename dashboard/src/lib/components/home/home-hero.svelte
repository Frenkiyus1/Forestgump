<script lang="ts">
	import { reveal } from '$lib/actions/reveal';

	interface Props {
		total: number;
	}
	let { total }: Props = $props();

	const dateLabel = new Date().toLocaleDateString('vi-VN', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
</script>

<div use:reveal class="mb-10">
	<p class="text-sm font-medium tracking-wide text-gray-400">{dateLabel} · Điện Biên</p>
	<h1
		class="mt-1 text-5xl leading-[1.05] font-semibold tracking-tight"
		style="font-family: 'Lora', serif;"
	>
		Cảnh báo thời tiết sớm
	</h1>
	<p class="mt-3 max-w-xl text-[15px] leading-relaxed text-gray-500">
		Theo dõi {total} khu vực trong tỉnh. Dự báo 7 ngày, cảnh báo kèm hành động cụ thể khi phát hiện nguy
		cơ lũ quét, băng giá hoặc sương mù dày.
	</p>
</div>
