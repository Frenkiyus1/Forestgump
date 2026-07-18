import type { PageServerLoad } from './$types';
import {
	fallbackLocationDetails,
	fetchLocationDetails,
	summarize,
	toAlertEvents
} from '$lib/derive';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong

	let details;
	let apiError: string | null = null;
	try {
		details = await fetchLocationDetails(fetch);
	} catch (err) {
		details = fallbackLocationDetails();
		apiError = err instanceof Error ? err.message : 'Không kết nối được backend.';
	}

	return {
		details,
		summary: summarize(details),
		alerts: toAlertEvents(details),
		apiError
	};
};
