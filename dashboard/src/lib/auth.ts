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
