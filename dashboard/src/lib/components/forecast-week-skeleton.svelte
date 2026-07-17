<script lang="ts">
	const skeletonKeys = [0, 1, 2, 3, 4, 5, 6];
</script>

<div
	class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
	aria-busy="true"
	aria-label="Đang tải dự báo 7 ngày"
>
	{#each skeletonKeys as key (key)}
		<div
			class="flex animate-pulse flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
		>
			<div class="h-4 w-8 rounded bg-slate-200"></div>
			<div class="h-3 w-10 rounded bg-slate-200"></div>
			<div class="h-10 w-10 rounded-full bg-slate-200"></div>
			<div class="h-5 w-14 rounded bg-slate-200"></div>
			<div class="h-3 w-12 rounded bg-slate-200"></div>
		</div>
	{/each}
</div>
