// Chuyển DienBienForecastEntry (dữ liệu THẬT từ GET /api/dienbien-forecast)
// sang Forecast (view model cũ mà derive.ts + các trang Tổng quan/Khu
// vực/Cảnh báo đang dùng) — giữ nguyên hợp đồng UI trong lúc thay nguồn dữ
// liệu từ mock (mock.ts) sang backend thật. Không tính lại rủi ro ở đây:
// alert_level đến thẳng từ ai_engine (rule engine), tránh lệch ngưỡng với
// server (xem CLAUDE.md mục 4 — "2 service riêng biệt, không tự đồng bộ
// hằng số").
import type {
	Alert,
	AlertLevel,
	AlertType,
	DayForecast,
	DienBienForecastDay,
	DienBienForecastEntry,
	DienBienHazard,
	Forecast
} from './types';
import type { Location } from './locations';

// id ở dashboard (lịch sử UI cũ) khác mã ở backend cho 1/3 địa điểm — xem
// ghi chú trong locations.ts. lat/lon đã khớp, chỉ cần map code.
const LOCATION_ID_TO_CODE: Record<string, string> = {
	'tp-dien-bien-phu': 'dbp',
	'muong-nhe': 'muong-nhe',
	'tua-chua': 'tua-chua'
};

const ALERT_SEVERITY: Record<AlertLevel, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

const HAZARD_TO_ALERT_TYPE: Record<DienBienHazard, AlertType> = {
	heavy_rain_flood: 'lu-quet',
	hail: 'mua-da',
	landslide: 'sat-lo',
	fog: 'suong-mu'
};

// Open-Meteo daily API không trả visibility trực tiếp — suy ra tầm nhìn xấp
// xỉ từ alert_level sương mù mà ai_engine đã tính (đáng tin hơn suy luận lại
// từ độ ẩm ở phía client).
const FOG_ALERT_TO_VISIBILITY_M: Record<AlertLevel, number> = {
	green: 5000,
	yellow: 2000,
	orange: 1000,
	red: 500
};

const EMPTY_DAY: DayForecast = {
	date: new Date().toISOString().slice(0, 10),
	tempMin: 0,
	tempMax: 0,
	rainSum: 0,
	rainMax1h: 0,
	visibilityMin: 5000,
	humidityMax: 0
};

function toDayForecast(day: DienBienForecastDay): DayForecast {
	const fogRisk = day.hazards.find((h) => h.hazard === 'fog');
	return {
		date: day.date,
		tempMin: day.tempMinC,
		tempMax: day.tempMaxC,
		rainSum: day.precipitationMm,
		// Open-Meteo daily không có cường độ mưa đỉnh theo giờ — dùng tổng mưa
		// ngày làm giá trị xấp xỉ (sẽ overestimate với mưa rải rác nhiều giờ).
		rainMax1h: day.precipitationMm,
		visibilityMin: FOG_ALERT_TO_VISIBILITY_M[fogRisk?.alert_level ?? 'green'],
		humidityMax: day.humidityPct,
		bulletin: day.bulletin
	};
}

/** Cảnh báo sớm nhất còn hoạt động — mỗi ngày lấy hiểm hoạ NẶNG NHẤT trong 3 loại (không giới hạn ở primaryRisk của địa điểm), ngày đầu tiên vượt ngưỡng green thắng. */
function findActiveAlert(days: DienBienForecastDay[]): Alert | null {
	for (let i = 0; i < days.length; i++) {
		const worst = days[i].hazards.reduce<DienBienForecastDay['hazards'][number] | null>(
			(max, h) =>
				!max || ALERT_SEVERITY[h.alert_level] > ALERT_SEVERITY[max.alert_level] ? h : max,
			null
		);
		if (worst && ALERT_SEVERITY[worst.alert_level] > 0) {
			return {
				level: worst.alert_level,
				type: HAZARD_TO_ALERT_TYPE[worst.hazard],
				reason: worst.detail,
				hoursAhead: i * 24, // dự báo theo ngày — quy ước: ngày i ~ i*24h tới
				bulletin: days[i].bulletin
			};
		}
	}
	return null;
}

export function codeForLocation(location: Location): string {
	return LOCATION_ID_TO_CODE[location.id] ?? location.id;
}

export function entryForLocation(
	entries: DienBienForecastEntry[],
	location: Location
): DienBienForecastEntry | undefined {
	const code = codeForLocation(location);
	return entries.find((e) => e.location.code === code);
}

/** `entry` undefined khi backend không kết nối được hoặc thiếu địa điểm này trong response — trả forecast rỗng (green, không cảnh báo) thay vì throw, để UI luôn render được. */
export function toForecast(location: Location, entry: DienBienForecastEntry | undefined): Forecast {
	return {
		locationId: location.id,
		locationName: location.name,
		daily: entry ? entry.days.map(toDayForecast) : [],
		alert: entry ? findActiveAlert(entry.days) : null
	};
}

export { EMPTY_DAY };
