<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD } from '$lib/ui';

	interface Props {
		province: string;
	}
	let { province }: Props = $props();
</script>

<div
	class={clsx(
		CARD,
		'flex h-[70vh] min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center'
	)}
>
	<span class="grid h-12 w-12 place-items-center rounded-2xl bg-cream text-accent">
		<svg
			viewBox="0 0 24 24"
			class="h-6 w-6"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			aria-hidden="true"
		>
			<path
				d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 12 2.5a7 7 0 0 1 7 7C19 14.9 12 21 12 21z"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<circle cx="12" cy="9.5" r="2.3" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</span>
	<p class="text-lg font-semibold tracking-tight text-gray-900">{province}</p>
	<p class="max-w-xs text-sm text-gray-500">
		Chưa có trạm phần cứng tại đây. Đây là khu vực nằm trong kế hoạch mở rộng — bản đồ trạm đo sẽ
		hiển thị khi thiết bị được lắp đặt.
	</p>
</div>
