import type { Station, LatestReading, StationView, DashboardSummary, TopStation } from './types';

export function toStationViews(stations: Station[], readings: LatestReading[]): StationView[] {
	const byId = new Map(readings.map((r) => [r.station_id, r]));
	return stations.map((station) => ({ station, reading: byId.get(station.station_id) ?? null }));
}

export function summarize(views: StationView[]): DashboardSummary {
	const total = views.length;
	const greenCount = views.filter((v) => v.reading?.alert === 'green').length;
	const atRiskCount = views.filter(
		(v) => v.reading?.alert === 'yellow' || v.reading?.alert === 'red'
	).length;
	const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

	const topStations: TopStation[] = views
		.filter((v) => v.reading !== null)
		.map((v) => ({
			name: v.station.name,
			value: v.reading!.forecast_24h,
			alert: v.reading!.alert
		}))
		.sort((a, b) => b.value - a.value)
		.slice(0, 4);

	return {
		total,
		greenCount,
		atRiskCount,
		safePct: pct(greenCount),
		healthPct: pct(greenCount),
		topStations
	};
}
