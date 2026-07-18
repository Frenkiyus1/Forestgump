<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import { markOnboardingDone, saveUserProfile } from '$lib/auth';
	import { LOCATIONS } from '$lib/locations';
	import { HAZARD_LABEL } from '$lib/alert-ui';
	import HazardIcon from '$lib/components/hazard-icon.svelte';
	import type { AlertType } from '$lib/types';
	import { clsx } from '$lib/clsx';
	import { SvelteSet } from 'svelte/reactivity';

	const HAZARDS = ['lu-quet', 'bang-gia', 'suong-mu'] as const satisfies readonly Exclude<
		AlertType,
		null
	>[];

	const CHANNELS = [
		{ id: 'sms', label: 'Tin nhắn SMS' },
		{ id: 'zalo', label: 'Zalo' },
		{ id: 'push', label: 'Thông báo đẩy (app)' }
	] as const;

	let locationId = $state(LOCATIONS[0].id);
	const hazards = new SvelteSet<(typeof HAZARDS)[number]>(HAZARDS);
	let channel = $state<(typeof CHANNELS)[number]['id']>('push');

	function toggleHazard(h: (typeof HAZARDS)[number]) {
		if (hazards.has(h)) hazards.delete(h);
		else hazards.add(h);
	}

	function submit() {
		saveUserProfile({ locationId, hazards: [...hazards], channel });
		markOnboardingDone();
		goto(resolve('/'));
	}

	function skip() {
		markOnboardingDone();
		goto(resolve('/'));
	}

	const cardBase = 'rounded-lg border px-4 py-3 text-left text-sm transition';
	const cardIdle = 'border-slate-200 text-slate-700 hover:bg-slate-50';
	const cardActive = 'border-[#2a9d8f] bg-[#2a9d8f]/5 text-slate-900';
</script>

<svelte:head><title>Khảo sát nhu cầu — ForestGump</title></svelte:head>

<div class="flex min-h-screen justify-center bg-slate-50 px-6 py-12">
	<div class="w-full max-w-xl">
		<div class="mb-8 flex flex-col items-center gap-3 text-center">
			<img src={logo} alt="" class="h-14 w-14 rounded-full object-cover" />
			<h1 class="text-2xl font-semibold text-slate-900">Chào mừng đến với ForestGump</h1>
			<p class="max-w-md text-sm text-slate-500">
				Cho chúng tôi biết bạn ở đâu và cần theo dõi nguy cơ gì, để cảnh báo gửi đến đúng người,
				đúng lúc.
			</p>
		</div>

		<form
			class="flex flex-col gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
			onsubmit={(e) => {
				e.preventDefault();
				submit();
			}}
		>
			<fieldset>
				<legend class="text-sm font-semibold text-slate-900">Vị trí bạn quan tâm nhất</legend>
				<div class="mt-3 flex flex-col gap-2">
					{#each LOCATIONS as loc (loc.id)}
						<label
							class={clsx(cardBase, 'flex cursor-pointer items-center gap-3', locationId === loc.id ? cardActive : cardIdle)}
						>
							<input
								type="radio"
								name="location"
								value={loc.id}
								bind:group={locationId}
								class="sr-only"
							/>
							<HazardIcon type={loc.primaryRisk} class="h-5 w-5 shrink-0 text-[#2a9d8f]" />
							<span class="flex-1">
								<span class="block font-medium">{loc.name}</span>
								<span class="block text-xs text-slate-400">{loc.terrain}</span>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend class="text-sm font-semibold text-slate-900">Loại cảnh báo bạn muốn nhận</legend>
				<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
					{#each HAZARDS as h (h)}
						<label
							class={clsx(cardBase, 'flex cursor-pointer flex-col items-center gap-1.5 text-center', hazards.has(h) ? cardActive : cardIdle)}
						>
							<input
								type="checkbox"
								checked={hazards.has(h)}
								onchange={() => toggleHazard(h)}
								class="sr-only"
							/>
							<HazardIcon type={h} class="h-6 w-6 text-[#2a9d8f]" />
							{HAZARD_LABEL[h]}
						</label>
					{/each}
				</div>
			</fieldset>

			<fieldset>
				<legend class="text-sm font-semibold text-slate-900">Kênh nhận cảnh báo</legend>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each CHANNELS as c (c.id)}
						<label
							class={clsx('cursor-pointer rounded-full border px-4 py-1.5 text-sm transition', channel === c.id ? 'border-[#2a9d8f] bg-[#2a9d8f]/10 text-[#1e6f5c] font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
						>
							<input type="radio" name="channel" value={c.id} bind:group={channel} class="sr-only" />
							{c.label}
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
				<button
					type="button"
					onclick={skip}
					class="text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
				>
					Bỏ qua, vào thẳng dashboard
				</button>
				<button
					type="submit"
					disabled={hazards.size === 0}
					class="rounded-lg bg-[#1e3a5f] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16304c] disabled:cursor-not-allowed disabled:opacity-60"
				>
					Bắt đầu theo dõi
				</button>
			</div>
		</form>
	</div>
</div>
