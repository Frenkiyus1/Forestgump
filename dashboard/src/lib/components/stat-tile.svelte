<script lang="ts">
	interface Props {
		label: string;
		value: string;
		sub: string;
	}
	let { label, value, sub }: Props = $props();
</script>

<section class="flex flex-col gap-1 rounded-2xl bg-card p-5 shadow-sm">
	<h3 class="text-xs font-medium text-gray-500">{label}</h3>
	<p class="text-2xl font-bold text-accent">{value}</p>
	<p class="text-sm text-gray-500">{sub}</p>
</section>
