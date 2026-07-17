import type { PageServerLoad } from './$types';
import { fetchAlertHistory } from '$lib/api';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong
	const alerts = await fetchAlertHistory(fetch);
	return { alerts };
};
