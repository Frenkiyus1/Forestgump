import type { Bulletin, DayForecast, Forecast } from './types';

/** "2026-07-18" style date, offset from today by `days`. Keeps fixtures always "current". */
function dateOffset(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

function week(build: (dayIndex: number) => Omit<DayForecast, 'date'>): DayForecast[] {
	return Array.from({ length: 7 }, (_, i) => ({ date: dateOffset(i), ...build(i) }));
}

// --- TP. Điện Biên Phủ — lòng chảo, rủi ro chính: sương mù. Hiện KHÔNG có cảnh báo. ---
const forecastDienBienPhu: Forecast = {
	locationId: 'tp-dien-bien-phu',
	locationName: 'TP. Điện Biên Phủ',
	daily: week((i) => ({
		tempMin: 19 + (i % 3),
		tempMax: 29 + (i % 2),
		rainSum: [2, 0, 5, 8, 0, 0, 3][i],
		rainMax1h: [1, 0, 3, 4, 0, 0, 2][i],
		visibilityMin: [800, 1500, 600, 2000, 3000, 2500, 1000][i], // sương mù buổi sáng, chưa tới ngưỡng cảnh báo
		humidityMax: 88 + (i % 6)
	})),
	alert: null
};

// --- Mường Nhé — vùng cao dốc đứng, rủi ro chính: lũ quét. Hiện KHÔNG có cảnh báo. ---
const forecastMuongNhe: Forecast = {
	locationId: 'muong-nhe',
	locationName: 'Mường Nhé',
	daily: week((i) => ({
		tempMin: 21 + (i % 2),
		tempMax: 30 + (i % 3),
		rainSum: [15, 40, 95, 60, 20, 10, 5][i],
		rainMax1h: [5, 18, 52, 30, 10, 4, 2][i],
		visibilityMin: [4000, 3000, 1200, 2000, 4000, 4000, 4000][i],
		humidityMax: 90 + (i % 5)
	})),
	alert: null
};

// --- Tủa Chùa — cao nguyên đá >1000m, rủi ro chính: băng giá. Hiện KHÔNG có cảnh báo. ---
const forecastTuaChua: Forecast = {
	locationId: 'tua-chua',
	locationName: 'Tủa Chùa',
	daily: week((i) => ({
		tempMin: [8, 5, 2, 3, 6, 9, 10][i],
		tempMax: [16, 13, 10, 11, 14, 17, 18][i],
		rainSum: [0, 0, 0, 1, 0, 0, 0][i],
		rainMax1h: [0, 0, 0, 1, 0, 0, 0][i],
		visibilityMin: [3000, 2000, 800, 1500, 3000, 3500, 4000][i],
		humidityMax: 92 + (i % 4)
	})),
	alert: null
};

export const MOCK_FORECASTS: Record<string, Forecast> = {
	'tp-dien-bien-phu': forecastDienBienPhu,
	'muong-nhe': forecastMuongNhe,
	'tua-chua': forecastTuaChua
};

// --- Bulletin fixtures. Tiếng Việt là bản thật; thái/hmong là placeholder rõ ràng, chờ đội
// dịch thuật/ đối tác cộng đồng cung cấp bản dịch chuẩn trước khi lên production. ---
export const MOCK_BULLETINS: Record<string, Record<Bulletin['lang'], Bulletin>> = {
	'tp-dien-bien-phu': {
		vi: {
			headline: 'Không có cảnh báo — thời tiết ổn định',
			action: 'Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'vi'
		},
		thai: {
			headline: '[Cần dịch tiếng Thái] Không có cảnh báo — thời tiết ổn định',
			action: '[Cần dịch tiếng Thái] Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'thai'
		},
		hmong: {
			headline: '[Cần dịch tiếng Hmông] Không có cảnh báo — thời tiết ổn định',
			action: '[Cần dịch tiếng Hmông] Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'hmong'
		}
	},
	'muong-nhe': {
		vi: {
			headline: 'Không có cảnh báo — thời tiết ổn định',
			action: 'Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'vi'
		},
		thai: {
			headline: '[Cần dịch tiếng Thái] Không có cảnh báo — thời tiết ổn định',
			action: '[Cần dịch tiếng Thái] Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'thai'
		},
		hmong: {
			headline: '[Cần dịch tiếng Hmông] Không có cảnh báo — thời tiết ổn định',
			action: '[Cần dịch tiếng Hmông] Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'hmong'
		}
	},
	'tua-chua': {
		vi: {
			headline: 'Không có cảnh báo — thời tiết ổn định',
			action: 'Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'vi'
		},
		thai: {
			headline: '[Cần dịch tiếng Thái] Không có cảnh báo — thời tiết ổn định',
			action: '[Cần dịch tiếng Thái] Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'thai'
		},
		hmong: {
			headline: '[Cần dịch tiếng Hmông] Không có cảnh báo — thời tiết ổn định',
			action: '[Cần dịch tiếng Hmông] Theo dõi dự báo hằng ngày, chưa cần hành động đặc biệt.',
			lang: 'hmong'
		}
	}
};
