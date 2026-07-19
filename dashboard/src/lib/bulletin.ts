import type { Bulletin, Forecast } from './types';
import { MOCK_BULLETINS } from './mock';
import { ALERT_LABEL, HAZARD_LABEL } from './alert-ui';
import { renderBulletin } from './i18n-bulletin';

const MOCK_DELAY_MS = 400;

/**
 * Turn a Forecast (+ chosen language) into a plain-language Bulletin a
 * resident can act on.
 *
 * Tiếng Việt ưu tiên bản tin THẬT do ai_engine sinh (LLM Gemini neo vào
 * RiskAssessment, fallback template cố định nếu LLM lỗi/chưa cấu hình — xem
 * CLAUDE.md mục 4), lấy từ
 * `forecast.alert.bulletin` (ngày có cảnh báo) hoặc `forecast.daily[0].bulletin`
 * (hôm nay, khi không có cảnh báo nào).
 *
 * Thái/Mông: ai_engine CHƯA có template dịch (SUPPORTED_LANGS chỉ có "vi"),
 * nên soạn NGAY TRÊN DASHBOARD bằng ngân hàng template cố định
 * (`i18n-bulletin.ts`), neo vào `forecast.alert` thật (mức + loại hiểm hoạ)
 * — cùng nguyên tắc "không bịa nội dung" như bulletin.py, chỉ khác nơi đặt
 * template. Đây là bản DRAFT (xem `REVIEWED` trong i18n-bulletin.ts), chưa
 * qua người bản ngữ rà soát. Chỉ khi thiếu dữ liệu có cấu trúc để neo (vd.
 * `alert.type` rỗng, hoặc backend down/mock) mới rơi về fixture đặt chỗ
 * trong `mock.ts`.
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
	} else {
		const rendered = renderBulletin(forecast, lang);
		if (rendered) return rendered;
	}

	const byLocation = MOCK_BULLETINS[forecast.locationId];
	if (!byLocation) throw new Error(`No bulletin fixture for location "${forecast.locationId}"`);
	return byLocation[lang];
}
