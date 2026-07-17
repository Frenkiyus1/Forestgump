<script lang="ts">
	import { clsx } from '$lib/clsx';

	// Lets judges/teammates flip between this rebuild (ForestGump) and the
	// original SaliGuard UI for side-by-side comparison. The legacy app runs
	// from a separate git worktree (see SETUP.md) on port 5174 so both can be
	// open at once — this never touches ForestGump's own data/build.
	const LEGACY_URL = 'http://localhost:5174';

	let open = $state(false);

	const triggerClass = clsx(
		'flex items-center gap-1.5 rounded-lg border border-black/[0.06]',
		'bg-white/70 px-3 py-1.5 text-xs font-medium text-gray-600 transition',
		'hover:bg-cream/70 focus-visible:outline-2 focus-visible:outline-accent'
	);
	const menuClass = clsx(
		'absolute right-0 z-50 mt-2 w-60 rounded-xl border border-black/[0.06] bg-white p-1.5',
		'shadow-[0_1px_2px_rgba(31,25,16,0.04),0_18px_40px_-24px_rgba(31,25,16,0.22)]'
	);
	const currentClass = clsx(
		'flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2',
		'text-sm font-medium text-accent'
	);
	const legacyLinkClass = clsx(
		'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600',
		'transition hover:bg-cream/70'
	);
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="menu"
		aria-expanded={open}
		class={triggerClass}
	>
		<svg
			viewBox="0 0 24 24"
			class="h-3.5 w-3.5"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="m17 2 4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
		</svg>
		Phiên bản
	</button>

	{#if open}
		<button
			type="button"
			aria-label="Đóng"
			class="fixed inset-0 z-40 cursor-default"
			onclick={() => (open = false)}
		></button>
		<div role="menu" class={menuClass}>
			<div class={currentClass}>
				ForestGump
				<span class="ml-auto text-[10px] font-normal text-gray-400">đang dùng</span>
			</div>
			<a
				href={LEGACY_URL}
				target="_blank"
				rel="noopener"
				role="menuitem"
				onclick={() => (open = false)}
				class={legacyLinkClass}
			>
				SaliGuard (cũ)
				<span class="ml-auto text-[10px] font-normal text-gray-400">:5174</span>
			</a>
			<p class="px-3 pt-1.5 pb-1 text-[11px] leading-snug text-gray-400">
				Cần chạy dashboard cũ ở cổng 5174 trước — xem SETUP.md.
			</p>
		</div>
	{/if}
</div>
