<script lang="ts">
	import type { Alert, Bulletin } from '$lib/types';
	import HazardIcon from './hazard-icon.svelte';

	let {
		alert,
		bulletin,
		bulletinLoading
	}: { alert: Alert | null; bulletin: Bulletin | null; bulletinLoading: boolean } = $props();

	const level = $derived(alert?.level ?? 'green');

	const palette = {
		green: {
			bg: 'bg-emerald-600',
			ring: 'ring-emerald-800/20',
			label: 'AN TOÀN'
		},
		yellow: {
			bg: 'bg-amber-500',
			ring: 'ring-amber-800/20',
			label: 'CẢNH BÁO'
		},
		red: {
			bg: 'bg-red-600',
			ring: 'ring-red-900/30',
			label: 'NGUY HIỂM'
		}
	} as const;

	const colors = $derived(palette[level]);
</script>

<section
	class="w-full rounded-3xl {colors.bg} px-6 py-8 text-white shadow-xl ring-4 {colors.ring} sm:px-10 sm:py-10"
	role="alert"
	aria-live="polite"
>
	<div
		class="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left"
	>
		<HazardIcon type={alert?.type ?? null} class="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />

		<div class="flex min-w-0 flex-1 flex-col gap-3">
			<div class="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
				<span class="rounded-full bg-black/15 px-3 py-1 text-sm font-bold tracking-wide uppercase">
					{colors.label}
				</span>
				{#if alert}
					<span class="text-xl font-extrabold sm:text-2xl">
						Còn {alert.hoursAhead} giờ
					</span>
				{/if}
			</div>

			{#if bulletinLoading}
				<div class="flex flex-col gap-2" aria-busy="true" aria-label="Đang tải bản tin">
					<div class="h-9 w-3/4 animate-pulse rounded-lg bg-white/30 sm:h-11"></div>
					<div class="h-7 w-full animate-pulse rounded-lg bg-white/20"></div>
				</div>
			{:else if bulletin}
				<h1 class="text-2xl leading-tight font-extrabold sm:text-3xl">
					{bulletin.headline}
				</h1>
				<!-- Câu hành động: chữ to nhất trên toàn trang, theo đúng nguyên tắc thiết kế. -->
				<p class="text-3xl leading-snug font-black sm:text-4xl">
					{bulletin.action}
				</p>
			{/if}

			{#if alert?.reason}
				<p class="text-sm font-medium text-white/80 sm:text-base">{alert.reason}</p>
			{/if}
		</div>
	</div>
</section>
