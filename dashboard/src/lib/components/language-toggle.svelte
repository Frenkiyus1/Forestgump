<script lang="ts">
	import type { Bulletin } from '$lib/types';

	let { lang, onChange }: { lang: Bulletin['lang']; onChange: (l: Bulletin['lang']) => void } =
		$props();

	const options: { id: Bulletin['lang']; label: string }[] = [
		{ id: 'vi', label: 'Tiếng Việt' },
		{ id: 'thai', label: 'ไทย' },
		{ id: 'hmong', label: 'Hmoob' }
	];
</script>

<div
	class="inline-flex gap-1 rounded-full border border-slate-200 bg-white p-1"
	role="radiogroup"
	aria-label="Chọn ngôn ngữ"
>
	{#each options as opt (opt.id)}
		<button
			type="button"
			role="radio"
			aria-checked={lang === opt.id}
			onclick={() => onChange(opt.id)}
			class="rounded-full px-4 py-1.5 text-sm font-semibold transition {lang === opt.id
				? 'bg-slate-900 text-white'
				: 'text-slate-600 hover:bg-slate-100'}"
		>
			{opt.label}
		</button>
	{/each}
</div>
