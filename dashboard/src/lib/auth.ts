import { browser } from '$app/environment';

// Mock credentials — swap for a real backend call later. Kept here so the whole
// auth surface lives in one file.
interface MockAccount {
	email?: string;
	phone?: string;
	password: string;
}

const MOCK_ACCOUNTS: MockAccount[] = [
	{ email: 'admin@forestgump.vn', phone: '0912345678', password: 'forestgump123' }
];

const SESSION_KEY = 'forestgump_session';
const NETWORK_DELAY_MS = 600;

export interface Session {
	email: string;
	ts: number;
}

export interface LoginResult {
	ok: boolean;
	error?: string;
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
		return { ok: false, error: 'Sai thông tin đăng nhập' };
	}
	setSession(email || phone);
	return { ok: true };
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

const ONBOARDING_KEY = 'forestgump_onboarding_done';
const PROFILE_KEY = 'forestgump_user_profile';

export interface UserProfile {
	/** id trong `LOCATIONS` (lib/locations.ts) */
	locationId: string;
	/** các loại hình nguy hiểm người dùng muốn nhận cảnh báo, vd. 'lu-quet' | 'bang-gia' | 'suong-mu' */
	hazards: string[];
	channel: 'sms' | 'zalo' | 'push';
}

export function isOnboardingDone(): boolean {
	if (!browser) return false;
	return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export function markOnboardingDone(): void {
	if (!browser) return;
	localStorage.setItem(ONBOARDING_KEY, '1');
}

export function saveUserProfile(profile: UserProfile): void {
	if (!browser) return;
	localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getUserProfile(): UserProfile | null {
	if (!browser) return null;
	const raw = localStorage.getItem(PROFILE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as UserProfile;
	} catch {
		return null;
	}
}
