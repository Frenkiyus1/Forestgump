import type { Forecast } from './types';
import { fetchDienBienForecast } from './api';
import { getLocation } from './locations';
import { entryForLocation, toForecast } from './dienbien-adapter';

/**
 * Fetch the 7-day forecast + current alert for a location — gọi backend
 * thật qua GET /api/dienbien-forecast (xem dienbien-adapter.ts cho cách
 * chuyển DienBienForecastEntry -> Forecast).
 */
export async function getForecast(
	locationId: string,
	fetchFn: typeof fetch = fetch
): Promise<Forecast> {
	const location = getLocation(locationId);
	if (!location) throw new Error(`Unknown location "${locationId}"`);

	const entries = await fetchDienBienForecast(fetchFn);
	return toForecast(location, entryForLocation(entries, location));
}
