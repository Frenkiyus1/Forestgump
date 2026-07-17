export type AlertLevel = 'green' | 'yellow' | 'red';

export interface Station {
	station_id: string;
	name: string;
	lat: number;
	lon: number;
}

export interface LatestReading {
	station_id: string;
	temp: number;
	ec: number;
	level: number;
	forecast_24h: number;
	alert: AlertLevel;
	updated_at: string;
}

export interface StationView {
	station: Station;
	reading: LatestReading | null;
}

export type TrendDirection = 'up' | 'down' | 'flat';

// 3 nhánh sông chính đổ ra biển ở Hải Phòng — dùng để rải trạm dọc đúng
// nhánh sông trên bản đồ (xem station-map.svelte).
export type RiverKey = 'cam' | 'lachtray' | 'vanuc';

export interface StationDetail {
	station_id: string;
	name: string;
	region: string;
	lat: number;
	lon: number;
	ec: number; // g/L
	temp: number; // °C
	level: number; // m
	forecast_24h: number; // g/L
	forecast_48h: number; // g/L
	alert: AlertLevel;
	battery: number; // %
	signal: number; // signal bars 0–4
	trend: TrendDirection; // EC change vs previous reading
	updated_at: string; // ISO timestamp
	/** Nhánh sông (Hải Phòng) trạm này thuộc về — dùng để đặt vị trí trên map. */
	river?: RiverKey;
	/** True nếu đây là trạm tổng hợp đại diện cho cả nhánh (giá trị trung bình
	 * của các trạm quan trắc trên nhánh đó), không phải cảm biến vật lý riêng lẻ. */
	isAggregate?: boolean;
}

export interface HistoryPoint {
	ts: string; // ISO timestamp
	ec: number;
	temp: number;
	level: number;
}

// A single threshold-crossing event for the Alerts history page.
// Alerts only fire at caution (yellow) or danger (red) — never green.
export interface AlertEvent {
	id: string;
	station_id: string;
	station: string; // station name
	region: string;
	level: Exclude<AlertLevel, 'green'>;
	ec: number; // g/L at the time of the alert
	message: string;
	ts: string; // ISO timestamp
}

export interface TopStation {
	name: string;
	value: number;
	alert: AlertLevel;
}

// Aggregated report for a station over the selected period.
export interface StationReport {
	station_id: string;
	name: string;
	region: string;
	avgEc: number; // mean EC over the period (g/L)
	peakEc: number; // max EC over the period (g/L)
	alertCount: number; // threshold-crossings in the period
	level: AlertLevel; // current status
}

export interface ReportData {
	periodDays: number;
	generatedAt: string; // ISO
	network: {
		avgEc: number;
		peakEc: number;
		yellowAlerts: number;
		redAlerts: number;
		stationsReporting: number;
		totalStations: number;
	};
	stations: StationReport[];
}

export interface DashboardSummary {
	total: number;
	greenCount: number;
	atRiskCount: number;
	safePct: number;
	healthPct: number;
	topStations: TopStation[];
}
