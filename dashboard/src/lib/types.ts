export type AlertLevel = 'green' | 'yellow' | 'red';
export type AlertType = 'lu-quet' | 'bang-gia' | 'suong-mu' | null;

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
