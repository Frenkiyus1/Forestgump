import type { PageServerLoad } from './$types';
import { loadDienBienForecast } from '$lib/api';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders, params }) => {
	setHeaders({ 'cache-control': 'max-age=60' });
	const regionId = parseInt(params.id, 10);
	const { forecastEntries, apiError } = await loadDienBienForecast(fetch);
	return { forecastEntries, apiError, regionId };
};