// Derives UI-friendly view models from the raw Forecast/Alert contract in
// `types.ts`. Kept separate from the seams (`weather.ts`, `bulletin.ts`) so
// swapping mock data for the real backend never touches this file.
import type { Alert, AlertLevel, DayForecast, Forecast } from './types';
import type { Location } from './locations';
import { LOCATIONS } from './locations';
import { getForecast } from './weather';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface LocationDetail {
	locationId: string;
	name: string;
	terrain: string;
	lat: number;
	lon: number;
	alertLevel: AlertLevel; // 'green' when there is no active alert
	alert: Alert | null;
	today: DayForecast;
	daily: DayForecast[];
	trend: TrendDirection; // rain trend: tomorrow vs today
	updatedAt: string;
}

export function toLocationDetail(location: Location, forecast: Forecast): LocationDetail {
	const today = forecast.daily[0];
	const tomorrow = forecast.daily[1];
	const trend: TrendDirection = !tomorrow
		? 'flat'
		: tomorrow.rainSum > today.rainSum
			? 'up'
			: tomorrow.rainSum < today.rainSum
				? 'down'
				: 'flat';

	return {
		locationId: location.id,
		name: location.name,
		terrain: location.terrain,
		lat: location.lat,
		lon: location.lon,
		alertLevel: forecast.alert?.level ?? 'green',
		alert: forecast.alert,
		today,
		daily: forecast.daily,
		trend,
		updatedAt: new Date().toISOString()
	};
}

export async function fetchLocationDetails(): Promise<LocationDetail[]> {
	const forecasts = await Promise.all(LOCATIONS.map((l) => getForecast(l.id)));
	return LOCATIONS.map((l, i) => toLocationDetail(l, forecasts[i]));
}

export async function fetchLocationDetail(locationId: string): Promise<LocationDetail | null> {
	const location = LOCATIONS.find((l) => l.id === locationId);
	if (!location) return null;
	const forecast = await getForecast(locationId);
	return toLocationDetail(location, forecast);
}

export interface DashboardSummary {
	total: number;
	greenCount: number;
	atRiskCount: number;
	safePct: number;
	nextAlertHours: number | null; // soonest hoursAhead among active alerts
	peakRainTomorrow: number; // mm, highest tomorrow rainSum across locations
}

export function summarize(details: LocationDetail[]): DashboardSummary {
	const total = details.length;
	const greenCount = details.filter((d) => d.alertLevel === 'green').length;
	const atRiskCount = total - greenCount;
	const safePct = total === 0 ? 0 : Math.round((greenCount / total) * 100);
	const activeHours = details.map((d) => d.alert?.hoursAhead).filter((h): h is number => h != null);
	const nextAlertHours = activeHours.length ? Math.min(...activeHours) : null;
	const peakRainTomorrow = details.reduce(
		(max, d) => Math.max(max, d.daily[1]?.rainSum ?? d.today.rainSum),
		0
	);
	return { total, greenCount, atRiskCount, safePct, nextAlertHours, peakRainTomorrow };
}

// Threshold-crossing event for the Alerts history page. Only fires at
// caution (yellow) or danger (red) — never green, same rule as ForestGump.
export interface WeatherAlertEvent {
	id: string;
	locationId: string;
	locationName: string;
	terrain: string;
	level: Exclude<AlertLevel, 'green'>;
	message: string;
	hoursAhead: number;
	ts: string;
}

export function toAlertEvents(details: LocationDetail[]): WeatherAlertEvent[] {
	return details
		.filter((d): d is LocationDetail & { alert: Alert } => d.alert !== null)
		.map((d) => ({
			id: `${d.locationId}-${d.alert.hoursAhead}`,
			locationId: d.locationId,
			locationName: d.name,
			terrain: d.terrain,
			level: d.alert.level as Exclude<AlertLevel, 'green'>,
			message: d.alert.reason,
			hoursAhead: d.alert.hoursAhead,
			ts: d.updatedAt
		}))
		.sort((a, b) => a.hoursAhead - b.hoursAhead);
}

export async function fetchAlertEvents(): Promise<WeatherAlertEvent[]> {
	return toAlertEvents(await fetchLocationDetails());
}

/** Location with the most urgent active alert (soonest hoursAhead); null if all green. */
export function mostUrgent(details: LocationDetail[]): LocationDetail | null {
	const withAlert = details.filter((d) => d.alert !== null);
	if (!withAlert.length) return null;
	return withAlert.reduce((a, b) => (a.alert!.hoursAhead <= b.alert!.hoursAhead ? a : b));
}
