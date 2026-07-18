import type { Bulletin, Forecast } from './types';
import { MOCK_BULLETINS } from './mock';
import { ALERT_LABEL, HAZARD_LABEL } from './alert-ui';

const MOCK_DELAY_MS = 400;

/**
 * Turn a Forecast (+ chosen language) into a plain-language Bulletin a
 * resident can act on.
 *
 * Tiếng Việt ưu tiên bản tin THẬT do ai_engine sinh (template cố định, xem
 * CLAUDE.md mục 4 — không dùng LLM tự do cho nội dung này), lấy từ
 * `forecast.alert.bulletin` (ngày có cảnh báo) hoặc `forecast.daily[0].bulletin`
 * (hôm nay, khi không có cảnh báo nào). Thái/Mông CHƯA có template dịch ở
 * ai_engine (SUPPORTED_LANGS chỉ có "vi") nên vẫn dùng fixture placeholder —
 * cũng là fallback khi dữ liệu thật chưa có (backend down, mock data...).
 */
export async function generateBulletin(
	forecast: Forecast,
	lang: Bulletin['lang']
): Promise<Bulletin> {
	await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

	if (lang === 'vi') {
		const realBulletin = forecast.alert?.bulletin ?? forecast.daily[0]?.bulletin;
		if (realBulletin) {
			return {
				headline: forecast.alert
					? `${ALERT_LABEL[forecast.alert.level]} — ${HAZARD_LABEL[forecast.alert.type!]}`
					: 'An toàn — không có cảnh báo',
				action: realBulletin,
				lang: 'vi'
			};
		}
	}

	const byLocation = MOCK_BULLETINS[forecast.locationId];
	if (!byLocation) throw new Error(`No bulletin fixture for location "${forecast.locationId}"`);
	return byLocation[lang];
}
