<script lang="ts">
	import { clsx } from '$lib/clsx';

	interface Props {
		regions: string[];
		onFilter: (region: string | null, query: string) => void;
	}
	let { regions, onFilter }: Props = $props();

	let query = $state('');
	let region = $state('all');
	let open = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let wrapEl = $state<HTMLDivElement | null>(null);

	const options = $derived(['all', ...regions]);
	const activeLabel = $derived(region === 'all' ? 'All regions' : region);

	function emit() {
		onFilter(region === 'all' ? null : region, query.trim());
	}

	function onQueryInput() {
		clearTimeout(timer);
		timer = setTimeout(emit, 300);
	}

	function select(r: string) {
		region = r;
		open = false;
		emit();
	}

	$effect(() => () => clearTimeout(timer));

	// close the dropdown on outside click / Escape while it is open
	$effect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (wrapEl && !wrapEl.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		window.addEventListener('mousedown', onDown);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('mousedown', onDown);
			window.removeEventListener('keydown', onKey);
		};
	});

	const pill = clsx(
		'rounded-full border bg-white/80 px-4 py-2 text-sm backdrop-blur transition',
		'focus-visible:outline-2 focus-visible:outline-accent'
	);
</script>

<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
	<div class="relative flex-1">
		<svg
			viewBox="0 0 24 24"
			class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" stroke-linecap="round" />
		</svg>
		<label class="sr-only" for="station-search">Search stations</label>
		<input
			id="station-search"
			type="search"
			bind:value={query}
			oninput={onQueryInput}
			placeholder="Search stations…"
			class={clsx(pill, 'w-full border-gray-200 pr-4 pl-10')}
		/>
	</div>

	<div class="relative" bind:this={wrapEl}>
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-haspopup="listbox"
			aria-expanded={open}
			aria-label="Filter by region"
			class={clsx(
				pill,
				'flex w-full items-center justify-between gap-2 sm:w-44',
				region === 'all' ? 'border-gray-200 text-gray-700' : 'border-accent text-accent'
			)}
		>
			<span class="truncate">{activeLabel}</span>
			<svg
				viewBox="0 0 24 24"
				class={clsx(
					'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
					open && 'rotate-180'
				)}
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>

		{#if open}
			<div
				role="listbox"
				aria-label="Region"
				tabindex="-1"
				class="dropdown-enter absolute right-0 z-20 mt-2 max-h-72 w-52 overflow-y-auto rounded-2xl border border-black/[0.06] bg-white p-1.5 shadow-[0_12px_40px_rgba(31,25,16,0.14)]"
			>
				{#each options as r (r)}
					{@const selected = region === r}
					<button
						type="button"
						role="option"
						aria-selected={selected}
						onclick={() => select(r)}
						class={clsx(
							'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
							'focus-visible:outline-2 focus-visible:outline-accent',
							selected
								? 'bg-accent/10 font-medium text-accent'
								: 'text-gray-600 hover:bg-cream/70 hover:text-gray-900'
						)}
					>
						<span class="truncate">{r === 'all' ? 'All regions' : r}</span>
						{#if selected}
							<svg
								viewBox="0 0 24 24"
								class="h-4 w-4 shrink-0"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								aria-hidden="true"
							>
								<path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	@keyframes dropdown-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.dropdown-enter {
		transform-origin: top right;
		animation: dropdown-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	@media (prefers-reduced-motion: reduce) {
		.dropdown-enter {
			animation: none;
		}
	}
</style>
