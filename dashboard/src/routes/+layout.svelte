<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/logo.png';
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from '$lib/motion';
	import { invalidateAll } from '$app/navigation';

	let { children } = $props();

	// Cross-route fade; honour reduced-motion by collapsing the duration.
	const fadeDuration = $derived(prefersReducedMotion() ? 0 : 200);

	// Tự làm mới dữ liệu định kỳ thay vì bắt người dùng bấm F5 (polling, xem
	// CLAUDE.md mục 5.5). invalidateAll() chỉ re-run load functions, không
	// reload cả trang -> không chớp/không mất vị trí cuộn. Dừng polling khi
	// tab ẩn để đỡ tốn request.
	const POLL_INTERVAL_MS = 30_000;
	$effect(() => {
		const timer = setInterval(() => {
			if (!document.hidden) void invalidateAll();
		}, POLL_INTERVAL_MS);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#key page.url.pathname}
	<div in:fade={{ duration: fadeDuration }}>
		{@render children()}
	</div>
{/key}
