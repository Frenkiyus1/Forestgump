import type { PageServerLoad } from './$types';
import { loadDienBienForecast } from '$lib/api';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=60' });
	const { forecastEntries, apiError } = await loadDienBienForecast(fetch, 'muong-nhe');
	return { forecastEntries, apiError };
};