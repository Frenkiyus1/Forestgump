<script lang="ts">
	let { message, onRetry }: { message: string; onRetry: () => void } = $props();
</script>

<div
	class="flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-red-300 bg-red-50 px-6 py-10 text-center"
	role="alert"
>
	<svg viewBox="0 0 24 24" fill="none" class="h-14 w-14 text-red-500" aria-hidden="true">
		<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" />
		<path
			d="M12 7.5v6M12 16.5h.01"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
		/>
	</svg>
	<p class="max-w-md text-lg font-semibold text-red-800">Không tải được dữ liệu</p>
	<p class="max-w-md text-sm text-red-700">{message}</p>
	<button
		type="button"
		onclick={onRetry}
		class="rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
	>
		Thử lại
	</button>
</div>
