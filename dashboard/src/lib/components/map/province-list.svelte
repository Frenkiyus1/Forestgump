<script lang="ts">
	import { clsx } from '$lib/clsx';
	import { CARD, CARD_INTERACTIVE } from '$lib/ui';
	import type { VietnamRegion } from '$lib/vietnam-regions';

	interface Props {
		region: VietnamRegion;
		onSelect: (province: string) => void;
	}
	let { region, onSelect }: Props = $props();
</script>

<div class={clsx(CARD, 'p-5')}>
	<p class="text-sm text-gray-500">{region.blurb}</p>

	<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each region.provinces as province (province.name)}
			<button
				type="button"
				onclick={() => onSelect(province.name)}
				class={clsx(CARD_INTERACTIVE, 'flex flex-col items-start gap-2 px-4 py-4 text-left')}
			>
				<span
					class={clsx(
						'rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
						province.hasData ? 'bg-accent-soft text-accent' : 'bg-gray-100 text-gray-400'
					)}
				>
					{province.hasData ? 'Đang giám sát' : 'Sắp triển khai'}
				</span>
				<span class="text-base font-semibold tracking-tight text-gray-900">{province.name}</span>
				<span class="text-xs text-gray-400">
					{province.hasData ? 'Xem bản đồ trạm đo →' : 'Vị trí lắp đặt dự kiến'}
				</span>
			</button>
		{/each}
	</div>
</div>
