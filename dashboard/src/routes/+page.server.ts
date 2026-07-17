import type { PageServerLoad } from './$types';
import { fetchDashboardViews, ApiError } from '$lib/api';
import { summarize } from '$lib/derive';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	// TẠM: cache ngắn cho demo (nhúng cảm biến vào nước mặn cần thấy cập nhật gần
	// như ngay lập tức) - tăng lại (vd max-age=60) khi không cần độ trễ thấp nữa.
	setHeaders({ 'cache-control': 'max-age=3' });
	try {
		const views = await fetchDashboardViews(fetch);
		return { views, summary: summarize(views), error: null };
	} catch (err) {
		const message = err instanceof ApiError ? err.message : 'Unknown error loading dashboard';
		return { views: [], summary: summarize([]), error: message };
	}
};
