import type { Alert, AlertLevel, AlertType, Bulletin, Forecast } from './types';

/**
 * Bản tin cảnh báo tiếng THÁI (Tai Dam) và HMÔNG (Hmong Daw / RPA) —
 * soạn từ NGÂN HÀNG TEMPLATE cố định, NEO vào dữ liệu rủi ro thật của
 * `forecast.alert` (mức cảnh báo + loại hiểm hoạ + tên địa điểm), KHÔNG
 * bịa số liệu. Đây là bản song ngữ cho toggle ngôn ngữ trên dashboard:
 * cùng cấu trúc (hazard × alert_level) với `ai_engine/bulletin.py` (tiếng
 * Việt) nên hành động khuyến nghị luôn nhất quán giữa 3 ngôn ngữ.
 *
 * ⚠️ DRAFT — các chuỗi Thái/Mông dưới đây là bản dịch nháp, PHẢI được
 * người bản ngữ Thái/Mông ở Điện Biên rà soát trước khi phát cảnh báo
 * thật (nội dung an toàn tính mạng). `REVIEWED = false` đánh dấu trạng
 * thái này; UI có thể đọc cờ để hiện nhãn "bản nháp" nếu cần.
 */

export const REVIEWED: Record<Exclude<Bulletin['lang'], 'vi'>, boolean> = {
	thai: false,
	hmong: false
};

type ToggleLang = Exclude<Bulletin['lang'], 'vi'>;
type Hazard = Exclude<AlertType, null>;
type ActiveLevel = Exclude<AlertLevel, 'green'>;

type LangPack = {
	// Nhãn mức cảnh báo (đối chiếu ALERT_LABEL tiếng Việt trong alert-ui.ts).
	level: Record<ActiveLevel, string>;
	// Nhãn loại hiểm hoạ (đối chiếu HAZARD_LABEL tiếng Việt).
	hazard: Record<Hazard, string>;
	// Tiền tố "đối tượng nhận" — mọi bản tin đều mở đầu bằng cụm này.
	audience: string;
	// Hành động khuyến nghị theo (hiểm hoạ, mức) — 1 câu ngắn, cụ thể.
	action: Record<Hazard, Record<ActiveLevel, string>>;
	// Khi không có cảnh báo (green / alert === null).
	safeHeadline: string;
	safeAction: string;
	// Nối "{địa điểm}" vào headline: "{hazard} — {location}".
	joinHeadline: (level: string, hazard: string, location: string) => string;
};

// --- Tiếng Thái (Tai Dam, chữ Latinh dùng ở Tây Bắc VN) — DRAFT ---
const THAI: LangPack = {
	level: {
		yellow: 'Khửn chík',
		orange: 'Anh tăn',
		red: 'Anh tăn lai'
	},
	hazard: {
		'lu-quet': 'Nặm p’a',
		'bang-gia': 'Nắc kít',
		'suong-mu': 'Mók tứn'
	},
	audience: '[Cốn bản/cán bộ xã]',
	action: {
		'lu-quet': {
			yellow: 'Nhòm nặm huổi, tứm khoẩng khửn tế cao.',
			orange: 'Nhá khảm huổi/tho nặm. Nhại khoẩng, tô liệng khửn tế cao.',
			red: 'Bấu khảm huổi/tho nặm khửn kh’ưn. Nhại khoẩng, tô liệng cón 18 mông, chăm dệt tứm p’ái xã.'
		},
		'bang-gia': {
			yellow: 'Hụ tô liệng, chằm khảu tô p’ắc chók khửn.',
			orange: 'Ảu tô liệng khảu hườn, hụm hụ chók khửn tô nắc kít.',
			red: 'Bấu hẹt vịệc kảng nà mứ nắc kít, hụm hụ cốn thảu/lếc khảu hườn ún.'
		},
		'suong-mu': {
			yellow: 'Chọt fai xe mứ khảp, dệt xa xe tang đông.',
			orange: 'Chăm pay tang đông mứ mók tứn, chọt fai mók.',
			red: 'Nhá pay tang đông mứ mók tứn lai; bấu đảy pay tọng chọt fai, khảp xa.'
		}
	},
	safeHeadline: 'Bấu mi anh tăn — pha kát p’ốc đi',
	safeAction: 'Nhòm khảu pha kát băng vằn, nhăng bấu tọng hẹt xăng.',
	joinHeadline: (level, hazard, location) => `${level}: ${hazard} — ${location}`
};

// --- Tiếng Hmông (Hmong Daw / RPA) — DRAFT ---
const HMONG: LangPack = {
	level: {
		yellow: 'Ceeb toom',
		orange: 'Txaus ntshai',
		red: 'Txaus ntshai heev'
	},
	hazard: {
		'lu-quet': 'Dej nyab ceev',
		'bang-gia': 'No txias daus',
		'suong-mu': 'Huab tuab'
	},
	audience: '[Cov pej xeem/nom tswv xeev]',
	action: {
		'lu-quet': {
			yellow: 'Saib qhov dej hauv kwj ha, npaj thauj khoom mus rau qhov siab.',
			orange: 'Tsis txhob hla kwj dej/tus choj dej. Thauj khoom, tsiaj mus rau qhov siab.',
			red: 'Tsis txhob hla kwj dej hmo no. Thauj khoom thiab tsiaj mus rau qhov siab ua ntej 18 teev, npaj khiav raws nom tswv.'
		},
		'bang-gia': {
			yellow: 'Saib cov tsiaj, coj tsiaj los rau hauv nkuaj.',
			orange: 'Coj tsiaj los rau hauv nkuaj, npog tej qoob loo kom tsis txhob no.',
			red: 'Tsis txhob ua num nrog qhov no txias heev, coj cov laus/menyuam mus rau hauv tsev sov.'
		},
		'suong-mu': {
			yellow: 'Taws teeb thaum tsav tsheb, tsav qeeb rau txoj kev toj roob.',
			orange: 'Txwv tsis txhob mus kev toj roob thaum huab tuab, taws teeb huab.',
			red: 'Tsis txhob mus kev toj roob thaum huab tuab heev; yog yuav tsum mus, taws teeb thiab tsav qeeb.'
		}
	},
	safeHeadline: 'Tsis muaj ceeb toom — huab cua zoo',
	safeAction: 'Saib xyuas huab cua txhua hnub, tsis tas ua dab tsi tam sim no.',
	joinHeadline: (level, hazard, location) => `${level}: ${hazard} — ${location}`
};

const PACKS: Record<ToggleLang, LangPack> = { thai: THAI, hmong: HMONG };

/**
 * Soạn Bulletin cho `lang` (thai/hmong) NEO vào `forecast.alert` thật.
 * Trả `null` khi không có dữ liệu cảnh báo có cấu trúc để neo (caller tự
 * fallback về fixture) — không bao giờ bịa nội dung khi thiếu dữ liệu.
 */
export function renderBulletin(forecast: Forecast, lang: ToggleLang): Bulletin | null {
	const pack = PACKS[lang];
	const alert: Alert | null = forecast.alert;

	// Không có cảnh báo (hoặc green) -> bản tin an toàn.
	if (!alert || alert.level === 'green') {
		return { headline: pack.safeHeadline, action: pack.safeAction, lang };
	}

	// Thiếu loại hiểm hoạ có cấu trúc -> để caller fallback, không đoán bừa.
	if (!alert.type) return null;

	const level = alert.level as ActiveLevel;
	const levelLabel = pack.level[level];
	const hazardLabel = pack.hazard[alert.type];
	const action = pack.action[alert.type][level];

	return {
		headline: pack.joinHeadline(levelLabel, hazardLabel, forecast.locationName),
		action: `${pack.audience} ${action}`,
		lang
	};
}
