// Tất cả lệnh gọi REST API tới backend SaliGuard tập trung ở đây (xem CLAUDE.md
// mục 5.1) — dashboard không kết nối thẳng DB, chỉ gọi HTTPS API của backend.
import { PUBLIC_API_URL } from '$env/static/public';
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
