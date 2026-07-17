import type { PageServerLoad } from './$types';
import { fetchLocationDetails } from '$lib/derive';

export const prerender = false;

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong
	const details = await fetchLocationDetails();
	return { details };
};
