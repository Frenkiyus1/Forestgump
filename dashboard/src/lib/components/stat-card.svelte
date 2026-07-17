<script lang="ts">
	interface Props {
		title: string;
		value: string;
		caption: string;
		linkLabel: string;
	}
	let { title, value, caption, linkLabel }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="text-sm font-medium text-gray-500">{title}</h2>
	<p class="text-4xl font-bold">{value}</p>
	<p class="text-sm text-gray-500">{caption}</p>
	<a href="#report" class="mt-auto text-sm font-medium text-accent">{linkLabel} →</a>
</section>
