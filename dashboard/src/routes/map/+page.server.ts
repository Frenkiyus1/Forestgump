import type { PageServerLoad } from './$types';
import { fetchDienBienForecast } from '$lib/api';
import type { DienBienForecastEntry } from '$lib/types';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=60' });

	let forecastEntries: DienBienForecastEntry[] = [];
	let apiError: string | null = null;
	try {
		forecastEntries = await fetchDienBienForecast(fetch);
	} catch (err) {
		// Backend chưa sẵn sàng/không kết nối được — vẫn render trang với heatmap
		// fallback (xanh lá toàn bộ) thay vì crash cả trang (500).
		apiError = err instanceof Error ? err.message : 'Không kết nối được backend.';
	}

	return { forecastEntries, apiError };
};
