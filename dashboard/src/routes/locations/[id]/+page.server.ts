import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchLocationDetail } from '$lib/derive';

export const prerender = false;

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong
	const detail = await fetchLocationDetail(params.id);
	if (!detail) throw error(404, `Không tìm thấy khu vực "${params.id}"`);
	return { detail };
};
