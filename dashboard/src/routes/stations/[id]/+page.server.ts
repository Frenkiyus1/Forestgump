import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchStationDetails, fetchHistory } from '$lib/api';

export const prerender = false;

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong

	const stations = await fetchStationDetails(fetch);
	const station = stations.find((s) => s.station_id === params.id);
	if (!station) throw error(404, `Station ${params.id} not found`);

	// Default to the 7-day window so the chart renders on first paint.
	const to = new Date().toISOString();
	const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
	const history = await fetchHistory(fetch, station.station_id, from, to);

	return { station, history };
};
