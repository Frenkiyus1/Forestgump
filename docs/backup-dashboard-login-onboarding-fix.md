# Backup — dashboard login/onboarding fix

Backup date: 2026-07-17, branch `feature/dienbien-weather-phase0-1`.

Bối cảnh: `dashboard/src/routes/+layout.svelte` redirect người dùng chưa
đăng nhập tới `/login`, chưa khảo sát tới `/onboarding`, nhưng 2 route đó
chưa từng được tạo → 404 mỗi lần vào dashboard. Đã sửa bằng cách tạo 2 trang
mới và cập nhật 3 file có sẵn. Nội dung đầy đủ của cả 5 file được lưu lại
dưới đây để backup trước khi `git pull`.

Danh sách file:
- Sửa: `dashboard/src/lib/auth.ts`
- Sửa: `dashboard/src/lib/i18n.svelte.ts`
- Sửa: `dashboard/src/routes/+layout.svelte`
- Mới: `dashboard/src/routes/login/+page.svelte`
- Mới: `dashboard/src/routes/onboarding/+page.svelte`

---

## `dashboard/src/lib/auth.ts` (sửa)

```ts
import { browser } from '$app/environment';

// Mock credentials — swap for a real backend call later. Kept here so the whole
// auth surface lives in one file.
interface MockAccount {
	email?: string;
	phone?: string;
	password: string;
	/** True cho tài khoản khách khảo sát: bất kể đã khảo sát trước đó hay chưa,
	 * mỗi lần đăng nhập bằng tài khoản này đều phải đi qua /onboarding lại. */
	forceOnboarding?: boolean;
}

const MOCK_ACCOUNTS: MockAccount[] = [
	{ email: 'admin@saliguard.vn', phone: '0912345678', password: 'saliguard123' },
	{ email: 'camonbantochuc@gmail.com', password: '123456789', forceOnboarding: true }
];

const SESSION_KEY = 'saliguard_session';
const NETWORK_DELAY_MS = 600;

export interface Session {
	email: string;
	ts: number;
}

export interface LoginResult {
	ok: boolean;
	error?: string;
	/** Đăng nhập thành công VÀ tài khoản này luôn phải khảo sát lại. */
	forceOnboarding?: boolean;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface LoginInput {
	email: string;
	phone: string;
	password: string;
}

/**
 * Authenticate against the mock account list. The login succeeds when EITHER
 * the email OR the phone matches an account and the password is correct.
 * Simulates ~600ms of network latency and persists the session on success.
 * Replace the body with a real API call when the backend `POST /api/login` exists.
 */
export async function login({ email, phone, password }: LoginInput): Promise<LoginResult> {
	await delay(NETWORK_DELAY_MS);
	const account = MOCK_ACCOUNTS.find(
		(a) => (email && a.email === email) || (phone && a.phone === phone)
	);
	if (!account || password !== account.password) {
		return { ok: false, error: 'Incorrect login details' };
	}
	setSession(email || phone);
	return { ok: true, forceOnboarding: account.forceOnboarding };
}

/** Continue without an account — frontend-only guest session, no backend. */
export function loginAsGuest(): void {
	setSession('Guest');
}

export function setSession(email: string): void {
	if (!browser) return;
	const session: Session = { email, ts: Date.now() };
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
	if (!browser) return null;
	const raw = localStorage.getItem(SESSION_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Session;
	} catch {
		return null;
	}
}

export function clearSession(): void {
	if (!browser) return;
	localStorage.removeItem(SESSION_KEY);
}

/** Tài khoản này có bắt buộc khảo sát lại mỗi lần đăng nhập không (xem `forceOnboarding`). */
export function accountForcesOnboarding(identity: string | null | undefined): boolean {
	if (!identity) return false;
	return MOCK_ACCOUNTS.some((a) => a.email === identity && a.forceOnboarding);
}

const ONBOARDING_KEY = 'saliguard_onboarding_done';

export function isOnboardingDone(): boolean {
	if (!browser) return false;
	return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function markOnboardingDone(): void {
	if (!browser) return;
	localStorage.setItem(ONBOARDING_KEY, '1');
}

/** Where to send a user right after they authenticate (login or guest). */
export function postLoginRoute(identity: string): '/' | '/onboarding' {
	const skipOnboarding = !accountForcesOnboarding(identity) && isOnboardingDone();
	return skipOnboarding ? '/' : '/onboarding';
}
```

---

## `dashboard/src/lib/i18n.svelte.ts` (sửa)

```ts
import { browser } from '$app/environment';

export type Lang = 'vi' | 'en';
const LANG_KEY = 'saliguard_lang';

const dict: Record<Lang, Record<string, string>> = {
	vi: {
		// nav
		'nav.overview': 'Tổng quan',
		'nav.stations': 'Trạm đo',
		'nav.map': 'Bản đồ',
		'nav.alerts': 'Cảnh báo',
		'nav.reports': 'Báo cáo',
		'nav.settings': 'Cài đặt',
		'nav.logout': 'Đăng xuất',
		search: 'Tìm kiếm',
		// settings
		'settings.title': 'Cài đặt',
		'settings.close': 'Đóng',
		'settings.tab.profile': 'Thông tin cá nhân',
		'settings.tab.language': 'Ngôn ngữ',
		'settings.save': 'Lưu thay đổi',
		'settings.saved': 'Đã lưu',
		// profile form
		'profile.province': 'Tỉnh / Thành phố',
		'profile.district': 'Quận / Huyện',
		'profile.commune': 'Xã / Phường',
		'profile.commune.hint': 'tùy chọn',
		'profile.farmType': 'Loại canh tác',
		'profile.farmArea': 'Diện tích',
		'profile.waterSource': 'Nguồn nước',
		'profile.alertThreshold': 'Ngưỡng cảnh báo',
		'profile.leadTime': 'Thời gian báo trước',
		'profile.experience': 'Kinh nghiệm với mặn',
		'profile.select': 'Chọn...',
		// language tab
		'lang.title': 'Ngôn ngữ hiển thị',
		'lang.desc': 'Áp dụng ngay — không cần tải lại trang.',
		'lang.vi': 'Tiếng Việt',
		'lang.en': 'English',
		// home
		'home.title': 'Tổng quan độ mặn',
		'home.sub':
			'{total} trạm đo trên cả nước. Dự báo trước 24–72 giờ, cảnh báo theo ngưỡng 1 & 4 g/L.',
		'kpi.safe': 'Trạm an toàn',
		'kpi.safe.sub': '{pct}% mạng lưới',
		'kpi.risk': 'Có nguy cơ',
		'kpi.risk.sub': 'Vàng hoặc đỏ',
		'kpi.peak': 'Độ mặn cao nhất',
		'kpi.peak.sub': 'Dự báo 24 giờ',
		'kpi.level': 'Mực nước TB',
		'kpi.level.sub': 'Toàn mạng lưới',
		'alert.green': 'An toàn',
		'alert.yellow': 'Thận trọng',
		'alert.red': 'Nguy hiểm',
		// login
		'login.title': 'Đăng nhập',
		'login.subtitle': 'Đăng nhập để xem cảnh báo độ mặn theo thời gian thực.',
		'login.identifier': 'Email hoặc số điện thoại',
		'login.password': 'Mật khẩu',
		'login.submit': 'Đăng nhập',
		'login.submitting': 'Đang đăng nhập...',
		'login.guest': 'Tiếp tục với vai trò khách',
		'login.error.required': 'Vui lòng nhập đầy đủ thông tin đăng nhập.',
		'login.error.invalid': 'Thông tin đăng nhập không đúng.',
		// onboarding
		'onboarding.title': 'Vài câu hỏi nhanh trước khi bắt đầu',
		'onboarding.subtitle': 'Giúp SaliGuard cá nhân hoá cảnh báo cho khu vực canh tác của bạn.',
		'onboarding.submit': 'Hoàn tất',
		'onboarding.skip': 'Bỏ qua, làm sau'
	},
	en: {
		// nav
		'nav.overview': 'Overview',
		'nav.stations': 'Stations',
		'nav.map': 'Map',
		'nav.alerts': 'Alerts',
		'nav.reports': 'Reports',
		'nav.settings': 'Settings',
		'nav.logout': 'Log out',
		search: 'Search',
		// settings
		'settings.title': 'Settings',
		'settings.close': 'Close',
		'settings.tab.profile': 'User profile',
		'settings.tab.language': 'Language',
		'settings.save': 'Save changes',
		'settings.saved': 'Saved',
		// profile form
		'profile.province': 'Province / City',
		'profile.district': 'District',
		'profile.commune': 'Commune',
		'profile.commune.hint': 'optional',
		'profile.farmType': 'Farm type',
		'profile.farmArea': 'Farm area',
		'profile.waterSource': 'Water source',
		'profile.alertThreshold': 'Alert threshold',
		'profile.leadTime': 'Lead time',
		'profile.experience': 'Salinity experience',
		'profile.select': 'Select...',
		// language tab
		'lang.title': 'Display language',
		'lang.desc': 'Takes effect immediately — no page reload needed.',
		'lang.vi': 'Tiếng Việt',
		'lang.en': 'English',
		// home
		'home.title': 'Salinity overview',
		'home.sub':
			'{total} field stations nationwide. Forecasts run 24–72 hours ahead, flagged against the 1 & 4 g/L thresholds.',
		'kpi.safe': 'Safe stations',
		'kpi.safe.sub': '{pct}% of network',
		'kpi.risk': 'At risk',
		'kpi.risk.sub': 'Yellow or red',
		'kpi.peak': 'Peak salinity',
		'kpi.peak.sub': '24h forecast',
		'kpi.level': 'Avg water level',
		'kpi.level.sub': 'Across network',
		'alert.green': 'Safe',
		'alert.yellow': 'Caution',
		'alert.red': 'Danger',
		// login
		'login.title': 'Log in',
		'login.subtitle': 'Sign in to see real-time salinity alerts.',
		'login.identifier': 'Email or phone number',
		'login.password': 'Password',
		'login.submit': 'Log in',
		'login.submitting': 'Logging in...',
		'login.guest': 'Continue as guest',
		'login.error.required': 'Please fill in your login details.',
		'login.error.invalid': 'Incorrect login details.',
		// onboarding
		'onboarding.title': 'A few quick questions to get started',
		'onboarding.subtitle': 'Help SaliGuard personalise alerts for your farm.',
		'onboarding.submit': 'Finish',
		'onboarding.skip': 'Skip for now'
	}
};

class I18nState {
	lang = $state<Lang>(browser ? ((localStorage.getItem(LANG_KEY) as Lang) ?? 'vi') : 'vi');

	setLang(l: Lang): void {
		this.lang = l;
		if (browser) localStorage.setItem(LANG_KEY, l);
	}

	t(key: string, vars?: Record<string, string | number>): string {
		const str = dict[this.lang][key] ?? dict.en[key] ?? key;
		if (!vars) return str;
		return str.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
	}
}

export const i18n = new I18nState();

export function t(key: string, vars?: Record<string, string | number>): string {
	return i18n.t(key, vars);
}
```

---

## `dashboard/src/routes/+layout.svelte` (sửa)

```svelte
<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/logo.png';
	import ChatWidget from '$lib/components/chat-widget.svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from '$lib/motion';
	import { getSession, postLoginRoute } from '$lib/auth';
	import SettingsOverlay from '$lib/components/settings-overlay.svelte';
	import { uiState } from '$lib/ui-state.svelte';

	let { children } = $props();

	// Cross-route fade; honour reduced-motion by collapsing the duration.
	const fadeDuration = $derived(prefersReducedMotion() ? 0 : 200);

	// Re-read the session on every navigation (localStorage isn't reactive, so
	// track the pathname to recompute after login/logout redirects).
	const session = $derived.by(() => {
		void page.url.pathname;
		return browser ? getSession() : null;
	});
	const onLogin = $derived(page.url.pathname === '/login');
	const onOnboarding = $derived(page.url.pathname === '/onboarding');
	const showApp = $derived(onLogin || onOnboarding || !!session);

	// Redirect side effects only — no state writes here.
	$effect(() => {
		if (!session && !onLogin && !onOnboarding) goto(resolve('/login'));
		else if (session && onLogin) goto(resolve(postLoginRoute(session.email)));
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showApp}
	{#key page.url.pathname}
		<div in:fade={{ duration: fadeDuration }}>
			{@render children()}
		</div>
	{/key}
	{#if !onLogin && !onOnboarding}<ChatWidget />{/if}
	{#if uiState.settingsOpen && !onLogin && !onOnboarding}
		<SettingsOverlay />
	{/if}
{/if}
```

---

## `dashboard/src/routes/login/+page.svelte` (mới)

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LoginHero from '$lib/components/login-hero.svelte';
	import logo from '$lib/assets/logo.png';
	import { login, loginAsGuest, postLoginRoute } from '$lib/auth';
	import { t } from '$lib/i18n.svelte';

	let identifier = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const value = identifier.trim();
		if (!value || !password) {
			error = t('login.error.required');
			return;
		}

		error = '';
		loading = true;
		const isEmail = value.includes('@');
		const result = await login({
			email: isEmail ? value : '',
			phone: isEmail ? '' : value,
			password
		});
		loading = false;

		if (!result.ok) {
			error = t('login.error.invalid');
			return;
		}
		goto(resolve(postLoginRoute(value)));
	}

	function handleGuest() {
		loginAsGuest();
		goto(resolve(postLoginRoute('Guest')));
	}

	const inputCls =
		'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent';
	const labelCls = 'mb-1.5 block text-xs font-medium text-gray-600';
</script>

<svelte:head><title>{t('login.title')} — SaliGuard</title></svelte:head>

<div class="grid min-h-screen w-full lg:grid-cols-2">
	<LoginHero />

	<section class="flex items-center justify-center bg-cream px-6 py-16">
		<div class="w-full max-w-sm">
			<div class="mb-8 flex items-center gap-3 lg:hidden">
				<img src={logo} alt="" class="h-10 w-10 rounded-full object-cover" />
				<span class="text-xl font-semibold text-gray-900">SaliGuard</span>
			</div>

			<h1 class="text-2xl font-semibold text-gray-900">{t('login.title')}</h1>
			<p class="mt-1.5 text-sm text-gray-500">{t('login.subtitle')}</p>

			<form class="mt-8 flex flex-col gap-4" onsubmit={handleSubmit}>
				<div>
					<label for="login-identifier" class={labelCls}>{t('login.identifier')}</label>
					<input
						id="login-identifier"
						type="text"
						autocomplete="username"
						bind:value={identifier}
						class={inputCls}
					/>
				</div>
				<div>
					<label for="login-password" class={labelCls}>{t('login.password')}</label>
					<input
						id="login-password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						class={inputCls}
					/>
				</div>

				{#if error}
					<p class="text-sm text-red-600" aria-live="polite">{error}</p>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="mt-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
				>
					{loading ? t('login.submitting') : t('login.submit')}
				</button>

				<button
					type="button"
					onclick={handleGuest}
					class="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent"
				>
					{t('login.guest')}
				</button>
			</form>
		</div>
	</section>
</div>
```

---

## `dashboard/src/routes/onboarding/+page.svelte` (mới)

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { t, i18n } from '$lib/i18n.svelte';
	import { markOnboardingDone } from '$lib/auth';
	import {
		getProfile,
		saveProfile,
		FARM_TYPES,
		AREAS,
		WATER_SOURCES,
		THRESHOLDS,
		LEAD_TIMES,
		EXPERIENCES
	} from '$lib/profile';

	let form = $state(getProfile());

	function optLabel(opt: { vi: string; en: string }): string {
		return i18n.lang === 'vi' ? opt.vi : opt.en;
	}

	function finish(event: SubmitEvent) {
		event.preventDefault();
		saveProfile(form);
		markOnboardingDone();
		goto(resolve('/'));
	}

	function skip() {
		markOnboardingDone();
		goto(resolve('/'));
	}

	const inputCls =
		'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-accent';
	const labelCls = 'mb-1.5 block text-xs font-medium text-gray-600';
</script>

<svelte:head><title>{t('onboarding.title')} — SaliGuard</title></svelte:head>

<div class="flex min-h-screen w-full items-center justify-center bg-cream px-6 py-16">
	<div class="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
		<h1 class="text-2xl font-semibold text-gray-900">{t('onboarding.title')}</h1>
		<p class="mt-1.5 text-sm text-gray-500">{t('onboarding.subtitle')}</p>

		<form class="mt-8 flex flex-col gap-5" onsubmit={finish}>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="ob-province" class={labelCls}>{t('profile.province')}</label>
					<input id="ob-province" type="text" bind:value={form.province} class={inputCls} />
				</div>
				<div>
					<label for="ob-district" class={labelCls}>{t('profile.district')}</label>
					<input id="ob-district" type="text" bind:value={form.district} class={inputCls} />
				</div>
				<div class="sm:col-span-2">
					<label for="ob-commune" class={labelCls}>
						{t('profile.commune')}
						<span class="font-normal text-gray-400">({t('profile.commune.hint')})</span>
					</label>
					<input id="ob-commune" type="text" bind:value={form.commune} class={inputCls} />
				</div>
			</div>

			<hr class="border-gray-100" />

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="ob-farmType" class={labelCls}>{t('profile.farmType')}</label>
					<select id="ob-farmType" bind:value={form.farmType} class={inputCls}>
						<option value="">{t('profile.select')}</option>
						{#each FARM_TYPES as opt (opt.id)}
							<option value={opt.id}>{optLabel(opt)}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="ob-farmArea" class={labelCls}>{t('profile.farmArea')}</label>
					<select id="ob-farmArea" bind:value={form.farmArea} class={inputCls}>
						<option value="">{t('profile.select')}</option>
						{#each AREAS as opt (opt.id)}
							<option value={opt.id}>{optLabel(opt)}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="ob-waterSource" class={labelCls}>{t('profile.waterSource')}</label>
					<select id="ob-waterSource" bind:value={form.waterSource} class={inputCls}>
						<option value="">{t('profile.select')}</option>
						{#each WATER_SOURCES as opt (opt.id)}
							<option value={opt.id}>{optLabel(opt)}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="ob-alertThreshold" class={labelCls}>{t('profile.alertThreshold')}</label>
					<select id="ob-alertThreshold" bind:value={form.alertThreshold} class={inputCls}>
						<option value="">{t('profile.select')}</option>
						{#each THRESHOLDS as opt (opt.id)}
							<option value={opt.id}>{optLabel(opt)}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="ob-leadTime" class={labelCls}>{t('profile.leadTime')}</label>
					<select id="ob-leadTime" bind:value={form.leadTime} class={inputCls}>
						<option value="">{t('profile.select')}</option>
						{#each LEAD_TIMES as opt (opt.id)}
							<option value={opt.id}>{optLabel(opt)}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="ob-experience" class={labelCls}>{t('profile.experience')}</label>
					<select id="ob-experience" bind:value={form.experience} class={inputCls}>
						<option value="">{t('profile.select')}</option>
						{#each EXPERIENCES as opt (opt.id)}
							<option value={opt.id}>{optLabel(opt)}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="mt-2 flex items-center justify-between">
				<button
					type="button"
					onclick={skip}
					class="text-sm font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-accent"
				>
					{t('onboarding.skip')}
				</button>
				<button
					type="submit"
					class="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent"
				>
					{t('onboarding.submit')}
				</button>
			</div>
		</form>
	</div>
</div>
```
