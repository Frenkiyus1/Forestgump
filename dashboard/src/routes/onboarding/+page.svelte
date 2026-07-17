<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import { markOnboardingDone } from '$lib/auth';

	function finish() {
		markOnboardingDone();
		goto(resolve('/'));
	}
</script>

<svelte:head><title>Bắt đầu — SaliGuard</title></svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 text-center"
>
	<img src={logo} alt="" class="h-16 w-16 rounded-full object-cover" />
	<h1 class="text-2xl font-semibold text-slate-900">Chào mừng đến với SaliGuard</h1>
	<p class="max-w-md text-sm text-slate-500">
		Khảo sát thông tin nông hộ đang được hoàn thiện. Bạn có thể vào thẳng dashboard ngay bây giờ.
	</p>
	<button
		type="button"
		onclick={finish}
		class="rounded-lg bg-[#1e3a5f] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16304c]"
	>
		Vào Dashboard
	</button>
</div>
