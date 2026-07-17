import type { Forecast } from './types';
import { MOCK_FORECASTS } from './mock';

const MOCK_DELAY_MS = 500;

/**
 * Fetch the 7-day forecast + current alert for a location.
 *
 * TODO(teammate): real implementation — call the weather/forecast backend
 * (station data → model → threshold pipeline) instead of reading the fixture
 * below. Keep the signature and the `Forecast` shape unchanged so the UI
 * doesn't need to change when this is swapped in.
 */
export async function getForecast(locationId: string): Promise<Forecast> {
	await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

	const forecast = MOCK_FORECASTS[locationId];
	if (!forecast) throw new Error(`No forecast fixture for location "${locationId}"`);
	return forecast;
}
