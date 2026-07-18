import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fallbackLocationDetails, fetchLocationDetail } from '$lib/derive';
import { getLocation } from '$lib/locations';

export const prerender = false;

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=3' }); // TẠM: demo, tăng lại 60 khi xong

	if (!getLocation(params.id)) throw error(404, `Không tìm thấy khu vực "${params.id}"`);

	try {
		// getLocation() ở trên đã xác nhận params.id hợp lệ (cùng LOCATIONS list
		// mà fetchLocationDetail dùng để tìm) — chỉ backend lỗi mới khiến hàm
		// này throw, không bao giờ trả null ở nhánh này.
		const detail = (await fetchLocationDetail(params.id, fetch))!;
		return { detail, apiError: null };
	} catch (err) {
		const detail = fallbackLocationDetails().find((d) => d.locationId === params.id)!;
		return { detail, apiError: err instanceof Error ? err.message : 'Không kết nối được backend.' };
	}
};
