// Tất cả lệnh gọi REST API tới backend SaliGuard tập trung ở đây (xem CLAUDE.md
// mục 5.1) — dashboard không kết nối thẳng DB, chỉ gọi HTTPS API của backend.
import { env } from '$env/dynamic/public';
const PUBLIC_API_URL = env.PUBLIC_API_URL ?? '';
import type { DienBienForecastEntry } from './types';

/**
 * GET /api/dienbien-forecast — dự báo + đánh giá rủi ro 3 hiểm hoạ cho 3 địa
 * điểm anchor Điện Biên. Không truyền `location` -> backend trả cả 3.
 */
export async function fetchDienBienForecast(
	fetchFn: typeof fetch = fetch
): Promise<DienBienForecastEntry[]> {
	const res = await fetchFn(`${PUBLIC_API_URL}/api/dienbien-forecast`);
	if (!res.ok) {
		throw new Error(`GET /api/dienbien-forecast failed: ${res.status} ${res.statusText}`);
	}
	return res.json();
}

/**
 * POST /api/chat — hỏi-đáp tự do cho chat widget (Gemini phía backend, neo
 * vào dữ liệu forecast/risk thật). Ném lỗi nếu backend chưa cấu hình
 * GEMINI_API_KEY hoặc không kết nối được — caller (chat-assistant.ts) fallback
 * về câu trả lời rule-based cục bộ.
 */
export async function fetchChatAnswer(
	question: string,
	fetchFn: typeof fetch = fetch
): Promise<string> {
	const res = await fetchFn(`${PUBLIC_API_URL}/api/chat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ question })
	});
	if (!res.ok) {
		throw new Error(`POST /api/chat failed: ${res.status} ${res.statusText}`);
	}
	const data = (await res.json()) as { answer: string };
	return data.answer;
}

export async function loadDienBienForecast(
	fetchFn: typeof fetch = fetch
): Promise<{ forecastEntries: DienBienForecastEntry[]; apiError: string | null }> {
	try {
		return { forecastEntries: await fetchDienBienForecast(fetchFn), apiError: null };
	} catch (err) {
		return {
			forecastEntries: [],
			apiError: err instanceof Error ? err.message : 'Không kết nối được backend.'
		};
	}
}
