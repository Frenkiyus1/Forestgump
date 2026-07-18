import type { PageServerLoad } from './$types';
import { fallbackLocationDetails, fetchAlertEvents, toAlertEvents } from '$lib/derive';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong

	try {
		const alerts = await fetchAlertEvents(fetch);
		return { alerts, apiError: null };
	} catch (err) {
		return {
			alerts: toAlertEvents(fallbackLocationDetails()),
			apiError: err instanceof Error ? err.message : 'Không kết nối được backend.'
		};
	}
};
