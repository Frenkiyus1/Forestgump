<script lang="ts">
	import type { AlertType } from '$lib/types';

	let { type, class: className = '' }: { type: AlertType; class?: string } = $props();
</script>

{#if type === 'lu-quet'}
	<!-- Flash flood: waves rising -->
	<svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
		<path
			d="M2 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M2 12c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.6"
		/>
		<path
			d="M12 2v8m0 0-3.5-3.5M12 10l3.5-3.5"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{:else if type === 'bang-gia'}
	<!-- Frost: snowflake -->
	<svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
		<path
			d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path
			d="M9 4l3 2 3-2M9 20l3-2 3 2M4 9l1 3-1 3M20 9l-1 3 1 3M4.5 6.5l3 1 .5 3M19.5 6.5l-3 1-.5 3M4.5 17.5l3-1 .5-3M19.5 17.5l-3-1-.5-3"
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{:else if type === 'suong-mu'}
	<!-- Fog: cloud with horizontal lines -->
	<svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
		<path
			d="M6 11a4 4 0 0 1 7.6-1.8A3.5 3.5 0 0 1 18 13"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M3 14h18M4.5 17.5h15M6 21h12"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
	</svg>
{:else}
	<!-- Safe: shield check -->
	<svg viewBox="0 0 24 24" fill="none" class={className} aria-hidden="true">
		<path
			d="M12 2.5 19.5 5.5V11.5C19.5 16.5 16.5 20 12 21.5C7.5 20 4.5 16.5 4.5 11.5V5.5L12 2.5Z"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<path
			d="M8.5 12L11 14.5L15.5 9.5"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/if}
