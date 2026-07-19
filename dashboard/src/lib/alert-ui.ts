import type { AlertLevel, AlertType } from './types';

// Always pair colour with a text label — never colour alone.
export const ALERT_LABEL: Record<AlertLevel, string> = {
	green: 'An toàn',
	yellow: 'Cảnh báo',
	orange: 'Nguy cơ cao',
	red: 'Nguy hiểm'
};

// Solid strip / dot colours.
export const ALERT_STRIP: Record<AlertLevel, string> = {
	green: 'bg-green-500',
	yellow: 'bg-yellow-500',
	orange: 'bg-orange-500',
	red: 'bg-red-600'
};

// Soft badge background + text.
export const ALERT_BADGE: Record<AlertLevel, string> = {
	green: 'bg-green-50 text-green-700',
	yellow: 'bg-yellow-50 text-yellow-700',
	orange: 'bg-orange-50 text-orange-700',
	red: 'bg-red-50 text-red-700'
};

// Stroke colours for SVG charts (hex, not Tailwind classes).
export const ALERT_HEX: Record<AlertLevel, string> = {
	green: '#22c55e',
	yellow: '#eab308',
	orange: '#f97316',
	red: '#dc2626'
};

export const HAZARD_LABEL: Record<Exclude<AlertType, null>, string> = {
	'lu-quet': 'Lũ quét',
	'bang-gia': 'Băng giá',
	'suong-mu': 'Sương mù dày',
	'mua-da': 'Mưa đá',
	'sat-lo': 'Sạt lở đất'
};

// TODO(teammate): nguồn ngưỡng thật cho từng loại hình thái nguy hiểm cần lấy từ
// Ban chỉ huy PCTT tỉnh Điện Biên / QCVN khí tượng thủy văn hiện hành — số liệu
// mock trong `mock.ts` là placeholder tạm thời, PHẢI thay trước khi trình bày
// với Domain Expert judge.

export function relativeTime(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const min = Math.round(diffMs / 60_000);
	if (min < 1) return 'vừa xong';
	if (min < 60) return `${min} phút trước`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr} giờ trước`;
	const day = Math.round(hr / 24);
	return `${day} ngày trước`;
}
