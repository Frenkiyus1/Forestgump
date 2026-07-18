export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';
export type AlertType = 'lu-quet' | 'bang-gia' | 'suong-mu' | null;

// --- Dien Bien terrain-anchored hazard forecast (GET /api/dienbien-forecast) ---
// Khớp backend/src/api.ts (DienBienForecastEntry/DienBienForecastDay) và
// backend/src/schemas.ts (hazardRiskSchema). 3 hiểm hoạ demo, dữ liệu THẬT
// chỉ có cho 3 địa điểm anchor — xem dienbien-terrain-zones.ts cho cách suy
// ra dữ liệu ước tính cho các xã còn lại.
export type DienBienHazard = 'cold_damage' | 'heavy_rain_flood' | 'fog';
export type DienBienTerrain = 'thung_lung' | 'nui_cao' | 'ven_suoi';

export type DienBienHazardRisk = {
	hazard: DienBienHazard;
	alert_level: AlertLevel;
	risk_score: number;
	detail: string;
};

export type DienBienForecastDay = {
	date: string;
	tempMinC: number;
	tempMaxC: number;
	precipitationMm: number;
	humidityPct: number;
	windSpeedKmh: number;
	hazards: DienBienHazardRisk[];
	bulletin: string;
};

export type DienBienForecastEntry = {
	location: { code: string; name: string; terrain: DienBienTerrain; elevationM: number };
	source: 'open-meteo' | 'openweathermap';
	fetchedAt: string;
	days: DienBienForecastDay[];
	aiEngineError?: string;
};

export type DayForecast = {
	date: string; // "2026-07-18"
	tempMin: number; // °C
	tempMax: number; // °C
	rainSum: number; // mm, daily total
	rainMax1h: number; // mm/h, peak intensity
	visibilityMin: number; // m
	humidityMax: number; // %
};

export type Alert = {
	level: AlertLevel;
	type: AlertType;
	reason: string; // "Mưa 120mm/24h, đất đã bão hòa sau 3 ngày mưa"
	hoursAhead: number;
};

export type Forecast = {
	locationId: string;
	locationName: string;
	daily: DayForecast[]; // 7 days
	alert: Alert | null;
};

export type Bulletin = {
	headline: string; // "Còn 12 giờ — nguy cơ lũ quét"
	action: string; // "Di dời gia súc khỏi khe suối, tránh đi qua ngầm"
	lang: 'vi' | 'thai' | 'hmong';
};
