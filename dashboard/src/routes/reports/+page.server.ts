import type { PageServerLoad } from './$types';
import { fetchStationDetails, fetchHistory, fetchAlertHistory } from '$lib/api';
import type { ReportData, StationReport } from '$lib/types';

export const prerender = false;

const PERIODS = new Set([7, 30]);

export const load: PageServerLoad = async ({ url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong

	const requested = Number(url.searchParams.get('period'));
	const periodDays = PERIODS.has(requested) ? requested : 7;

	const to = new Date();
	const from = new Date(to.getTime() - periodDays * 86_400_000);
	const fromIso = from.toISOString();
	const toIso = to.toISOString();

	const [stations, alerts] = await Promise.all([
		fetchStationDetails(fetch),
		fetchAlertHistory(fetch)
	]);

	// Per-station aggregates from each station's history over the period.
	const stationReports: StationReport[] = await Promise.all(
		stations.map(async (s) => {
			const history = await fetchHistory(fetch, s.station_id, fromIso, toIso);
			const ecs = history.map((h) => h.ec);
			const avgEc = ecs.length ? ecs.reduce((a, b) => a + b, 0) / ecs.length : s.ec;
			const peakEc = ecs.length ? Math.max(...ecs) : s.ec;
			const alertCount = alerts.filter(
				(a) => a.station_id === s.station_id && new Date(a.ts) >= from
			).length;
			return {
				station_id: s.station_id,
				name: s.name,
				region: s.region,
				avgEc: Number(avgEc.toFixed(2)),
				peakEc: Number(peakEc.toFixed(2)),
				alertCount,
				level: s.alert
			};
		})
	);

	const periodAlerts = alerts.filter((a) => new Date(a.ts) >= from);
	const report: ReportData = {
		periodDays,
		generatedAt: toIso,
		network: {
			avgEc: Number(
				(stationReports.reduce((a, s) => a + s.avgEc, 0) / (stationReports.length || 1)).toFixed(2)
			),
			peakEc: stationReports.length ? Math.max(...stationReports.map((s) => s.peakEc)) : 0,
			yellowAlerts: periodAlerts.filter((a) => a.level === 'yellow').length,
			redAlerts: periodAlerts.filter((a) => a.level === 'red').length,
			stationsReporting: stations.filter((s) => s.signal > 0).length,
			totalStations: stations.length
		},
		stations: stationReports
	};

	return { report };
};
