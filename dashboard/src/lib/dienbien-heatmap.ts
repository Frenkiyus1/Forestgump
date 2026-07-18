// Suy ra màu cảnh báo cho toàn bộ 45 xã/phường trên bản đồ Điện Biên từ dữ
// liệu THẬT của 3 địa điểm anchor (/api/dienbien-forecast) + bảng phân loại
// địa hình `dienbien-terrain-zones.ts`. 3 xã anchor lấy thẳng dữ liệu đo được
// trả về; 42 xã còn lại "mượn" dữ liệu của anchor cùng nhóm địa hình — đây
// LÀ ước tính, không phải đo tại từng xã (xem docs/dienbien-phase2-terrain.md).
import type {
	AlertLevel,
	DienBienForecastDay,
	DienBienForecastEntry,
	DienBienHazard
} from './types';
import type { DienBienHotspot } from './dienbien-hotspots';
import {
	ANCHOR_CODE_BY_TERRAIN,
	TERRAIN_ZONE_BY_NAME,
	type TerrainConfidence
} from './dienbien-terrain-zones';

export const DIENBIEN_HAZARD_LABEL: Record<DienBienHazard, string> = {
	hail: 'Mưa đá',
	landslide: 'Sạt lở đất',
	heavy_rain_flood: 'Mưa lớn/lũ quét',
	fog: 'Sương mù'
};

/** Thứ tự hiển thị chuẩn cho 4 hiểm hoạ — dùng chung ở mọi nơi liệt kê đủ 4 loại. */
export const DIENBIEN_HAZARDS: DienBienHazard[] = ['heavy_rain_flood', 'hail', 'landslide', 'fog'];

// Thứ tự nguy hiểm tăng dần — khớp DIENBIEN_ALERT_SEVERITY ở backend/src/api.ts.
export const ALERT_SEVERITY: Record<AlertLevel, number> = {
	green: 0,
	yellow: 1,
	orange: 2,
	red: 3
};

/** Thời tiết cụ thể của ngày+anchor dùng để suy ra heat — hiển thị trong tooltip hover. */
export interface RegionHeatWeather {
	date: string;
	tempMinC: number;
	tempMaxC: number;
	precipitationMm: number;
	humidityPct: number;
	windSpeedKmh: number;
}

export interface RegionHeat {
	alertLevel: AlertLevel;
	/** 'anchor' cho 3 xã có dữ liệu đo thật; ngược lại độ tin cậy của suy luận địa hình. */
	confidence: TerrainConfidence | 'anchor';
	isAnchor: boolean;
	detail: string | null;
	/** Tên anchor mà dữ liệu được mượn từ đó — null cho chính xã anchor hoặc khi không xác định được vùng. */
	sourceAnchorName: string | null;
	/** null khi không có ngày dữ liệu nào khớp (anchor chưa có dự báo). */
	weather: RegionHeatWeather | null;
}

const FALLBACK_HEAT: RegionHeat = {
	alertLevel: 'green',
	confidence: 'low',
	isAnchor: false,
	detail: null,
	sourceAnchorName: null,
	weather: null
};

function weatherOf(day: DienBienForecastDay | undefined): RegionHeatWeather | null {
	if (!day) return null;
	return {
		date: day.date,
		tempMinC: day.tempMinC,
		tempMaxC: day.tempMaxC,
		precipitationMm: day.precipitationMm,
		humidityPct: day.humidityPct,
		windSpeedKmh: day.windSpeedKmh
	};
}

/** Hazard mặc định = mức cảnh báo cao nhất đang active (ngày đầu tiên) trong 3 anchor; toàn xanh -> mưa lớn/lũ quét. */
export function pickDefaultHazard(entries: DienBienForecastEntry[]): DienBienHazard {
	let best: { hazard: DienBienHazard; severity: number } | null = null;
	for (const entry of entries) {
		const today = entry.days[0];
		if (!today) continue;
		for (const risk of today.hazards) {
			const severity = ALERT_SEVERITY[risk.alert_level];
			if (!best || severity > best.severity) {
				best = { hazard: risk.hazard, severity };
			}
		}
	}
	return best && best.severity > 0 ? best.hazard : 'heavy_rain_flood';
}

/** Danh sách ngày (YYYY-MM-DD) dùng cho tab chọn ngày — lấy từ anchor có nhiều ngày dữ liệu nhất. */
export function availableDays(entries: DienBienForecastEntry[]): string[] {
	const longest = entries.reduce<DienBienForecastEntry | null>(
		(max, e) => (e.days.length > (max?.days.length ?? 0) ? e : max),
		null
	);
	return longest?.days.map((d) => d.date) ?? [];
}

export function buildRegionHeat(
	regions: DienBienHotspot[],
	entries: DienBienForecastEntry[],
	hazard: DienBienHazard,
	dayIndex: number
): Map<number, RegionHeat> {
	const entryByCode = new Map(entries.map((e) => [e.location.code, e]));
	const entryByName = new Map(entries.map((e) => [e.location.name, e]));

	const heat = new Map<number, RegionHeat>();
	for (const region of regions) {
		const anchorEntry = entryByName.get(region.name);
		if (anchorEntry) {
			const day = anchorEntry.days[dayIndex] ?? anchorEntry.days.at(-1);
			const risk = day?.hazards.find((h) => h.hazard === hazard) ?? null;
			heat.set(region.id, {
				alertLevel: risk?.alert_level ?? 'green',
				confidence: 'anchor',
				isAnchor: true,
				detail: risk?.detail ?? null,
				sourceAnchorName: null,
				weather: weatherOf(day)
			});
			continue;
		}

		const zone = TERRAIN_ZONE_BY_NAME[region.name];
		if (!zone) {
			heat.set(region.id, FALLBACK_HEAT);
			continue;
		}

		const anchorCode = ANCHOR_CODE_BY_TERRAIN[zone.terrain];
		const sourceEntry = entryByCode.get(anchorCode);
		const day = sourceEntry?.days[dayIndex] ?? sourceEntry?.days.at(-1);
		const risk = day?.hazards.find((h) => h.hazard === hazard) ?? null;
		heat.set(region.id, {
			alertLevel: risk?.alert_level ?? 'green',
			confidence: zone.confidence,
			isAnchor: false,
			detail: risk?.detail ?? null,
			sourceAnchorName: sourceEntry?.location.name ?? null,
			weather: weatherOf(day)
		});
	}
	return heat;
}
