import type { Bulletin, Forecast } from './types';
import { MOCK_BULLETINS } from './mock';

const MOCK_DELAY_MS = 400;

/**
 * Turn a Forecast (+ chosen language) into a plain-language Bulletin a
 * resident can act on.
 *
 * TODO(teammate): real implementation — this is where the LLM/rules call
 * goes (forecast + alert → headline + concrete action, translated). Keep the
 * signature and the `Bulletin` shape unchanged so the UI doesn't need to
 * change when this is swapped in.
 */
export async function generateBulletin(
	forecast: Forecast,
	lang: Bulletin['lang']
): Promise<Bulletin> {
	await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

	const byLocation = MOCK_BULLETINS[forecast.locationId];
	if (!byLocation) throw new Error(`No bulletin fixture for location "${forecast.locationId}"`);
	return byLocation[lang];
}
