import type { PageServerLoad } from './$types';
import { fetchDienBienForecast } from '$lib/api';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=60' });
	const forecastEntries = await fetchDienBienForecast(fetch);
	return { forecastEntries };
};
