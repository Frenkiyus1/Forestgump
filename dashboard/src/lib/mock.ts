import type { Alert, Bulletin, DayForecast, Forecast } from './types';

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

// --- Mường Nhé — vùng cao dốc đứng, rủi ro chính: lũ quét. Cảnh báo VÀNG, còn ~30h. ---
const alertMuongNhe: Alert = {
	level: 'yellow',
	type: 'lu-quet',
	reason: 'Mưa dự báo 95mm/24h, đất đã bão hoà sau 2 ngày mưa liên tục ở thượng nguồn',
	hoursAhead: 30
};

const forecastMuongNhe: Forecast = {
	locationId: 'muong-nhe',
	locationName: 'Mường Nhé',
	daily: week((i) => ({
		tempMin: 21 + (i % 2),
		tempMax: 30 + (i % 3),
		rainSum: [15, 40, 95, 60, 20, 10, 5][i], // đỉnh mưa rơi vào ngày ứng với mốc cảnh báo 30h
		rainMax1h: [5, 18, 52, 30, 10, 4, 2][i],
		visibilityMin: [4000, 3000, 1200, 2000, 4000, 4000, 4000][i],
		humidityMax: 90 + (i % 5)
	})),
	alert: alertMuongNhe
};

// --- Tủa Chùa — cao nguyên đá >1000m, rủi ro chính: băng giá. Cảnh báo ĐỎ, còn ~12h. ---
const alertTuaChua: Alert = {
	level: 'red',
	type: 'bang-gia',
	reason: 'Nhiệt độ giảm sâu còn 2°C đêm nay, sương muối dày đặc trên cao nguyên đá',
	hoursAhead: 12
};

const forecastTuaChua: Forecast = {
	locationId: 'tua-chua',
	locationName: 'Tủa Chùa',
	daily: week((i) => ({
		tempMin: [8, 5, 2, 3, 6, 9, 10][i], // rét đậm rơi vào đêm ứng với mốc cảnh báo 12h
		tempMax: [16, 13, 10, 11, 14, 17, 18][i],
		rainSum: [0, 0, 0, 1, 0, 0, 0][i],
		rainMax1h: [0, 0, 0, 1, 0, 0, 0][i],
		visibilityMin: [3000, 2000, 800, 1500, 3000, 3500, 4000][i],
		humidityMax: 92 + (i % 4)
	})),
	alert: alertTuaChua
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
			headline: 'Còn 30 giờ — nguy cơ lũ quét',
			action:
				'Di dời gia súc khỏi khe suối, chuyển đồ đạc lên nơi cao, tuyệt đối không đi qua ngầm tràn khi mưa lớn.',
			lang: 'vi'
		},
		thai: {
			headline: '[Cần dịch tiếng Thái] Còn 30 giờ — nguy cơ lũ quét',
			action:
				'[Cần dịch tiếng Thái] Di dời gia súc khỏi khe suối, chuyển đồ đạc lên nơi cao, không đi qua ngầm tràn.',
			lang: 'thai'
		},
		hmong: {
			headline: '[Cần dịch tiếng Hmông] Còn 30 giờ — nguy cơ lũ quét',
			action:
				'[Cần dịch tiếng Hmông] Di dời gia súc khỏi khe suối, chuyển đồ đạc lên nơi cao, không đi qua ngầm tràn.',
			lang: 'hmong'
		}
	},
	'tua-chua': {
		vi: {
			headline: 'Còn 12 giờ — nguy cơ băng giá',
			action:
				'Đưa gia súc vào chuồng kín, đốt lửa sưởi ấm, che chắn cây trồng non, dự trữ đủ thức ăn cho gia súc qua đêm.',
			lang: 'vi'
		},
		thai: {
			headline: '[Cần dịch tiếng Thái] Còn 12 giờ — nguy cơ băng giá',
			action: '[Cần dịch tiếng Thái] Đưa gia súc vào chuồng kín, sưởi ấm, che chắn cây trồng non.',
			lang: 'thai'
		},
		hmong: {
			headline: '[Cần dịch tiếng Hmông] Còn 12 giờ — nguy cơ băng giá',
			action: '[Cần dịch tiếng Hmông] Đưa gia súc vào chuồng kín, sưởi ấm, che chắn cây trồng non.',
			lang: 'hmong'
		}
	}
};
