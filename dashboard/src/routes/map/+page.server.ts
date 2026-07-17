import type { PageServerLoad } from './$types';
import { fetchStationDetails } from '$lib/api';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong
	const stations = await fetchStationDetails(fetch);
	return { stations };
};
