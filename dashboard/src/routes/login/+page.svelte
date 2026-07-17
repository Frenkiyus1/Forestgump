<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LoginHero from '$lib/components/login-hero.svelte';
	import { login, loginAsGuest, accountForcesOnboarding, isOnboardingDone } from '$lib/auth';

	let email = $state('');
	let phone = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	function afterLogin(identity: string) {
		const skipOnboarding = !accountForcesOnboarding(identity) && isOnboardingDone();
		goto(resolve(skipOnboarding ? '/' : '/onboarding'));
	}

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		loading = true;
		try {
			const result = await login({ email, phone, password });
			if (!result.ok) {
				error = result.error ?? 'Đăng nhập thất bại';
				return;
			}
			afterLogin(email || phone);
		} finally {
			loading = false;
		}
	}

	function continueAsGuest() {
		loginAsGuest();
		afterLogin('Guest');
	}
</script>

<svelte:head><title>Đăng nhập — SaliGuard</title></svelte:head>

<div class="grid min-h-screen grid-cols-1 lg:grid-cols-2">
	<LoginHero />

	<section class="flex flex-col justify-center px-8 py-12 sm:px-16">
		<div class="mx-auto w-full max-w-sm">
			<h1 class="text-2xl font-semibold text-slate-900">Đăng nhập SaliGuard</h1>
			<p class="mt-1 text-sm text-slate-500">Theo dõi cảnh báo xâm nhập mặn theo thời gian thực.</p>

			<form class="mt-8 flex flex-col gap-4" onsubmit={onSubmit}>
				<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
					Email
					<input
						type="email"
						bind:value={email}
						placeholder="admin@saliguard.vn"
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2a9d8f] focus:outline-none"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
					Số điện thoại
					<input
						type="tel"
						bind:value={phone}
						placeholder="0912345678"
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2a9d8f] focus:outline-none"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
					Mật khẩu
					<input
						type="password"
						bind:value={password}
						placeholder="••••••••"
						class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#2a9d8f] focus:outline-none"
					/>
				</label>

				{#if error}
					<p class="text-sm text-red-600" role="alert">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="mt-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16304c] disabled:opacity-60"
				>
					{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
				</button>
			</form>

			<div class="mt-4 flex items-center gap-3 text-xs text-slate-400">
				<span class="h-px flex-1 bg-slate-200"></span>
				hoặc
				<span class="h-px flex-1 bg-slate-200"></span>
			</div>

			<button
				type="button"
				onclick={continueAsGuest}
				class="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
			>
				Tiếp tục với tư cách khách
			</button>

			<p class="mt-6 text-xs text-slate-400">Demo: admin@saliguard.vn / saliguard123</p>
		</div>
	</section>
</div>
