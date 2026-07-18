import type { PageServerLoad } from './$types';
import { fallbackLocationDetails, fetchLocationDetails } from '$lib/derive';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong

	try {
		const details = await fetchLocationDetails(fetch);
		return { details, apiError: null };
	} catch (err) {
		return {
			details: fallbackLocationDetails(),
			apiError: err instanceof Error ? err.message : 'Không kết nối được backend.'
		};
	}
};
