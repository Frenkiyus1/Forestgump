import type { AlertLevel } from './types';

// Always pair colour with a text label — never colour alone.
export const ALERT_LABEL: Record<AlertLevel, string> = {
	green: 'Safe',
	yellow: 'Caution',
	red: 'Danger'
};

// Solid strip / dot colours per claude.md (green-500, yellow-500, red-600).
export const ALERT_STRIP: Record<AlertLevel, string> = {
	green: 'bg-green-500',
	yellow: 'bg-yellow-500',
	red: 'bg-red-600'
};

// Soft badge background + text.
export const ALERT_BADGE: Record<AlertLevel, string> = {
	green: 'bg-green-50 text-green-700',
	yellow: 'bg-yellow-50 text-yellow-700',
	red: 'bg-red-50 text-red-700'
};

// Stroke colours for SVG charts (hex, not Tailwind classes).
export const ALERT_HEX: Record<AlertLevel, string> = {
	green: '#22c55e',
	yellow: '#eab308',
	red: '#dc2626'
};

// Lời khuyên hành động theo mức cảnh báo — hiện dạng quote trên trang chi tiết trạm.
export const ALERT_ADVICE: Record<AlertLevel, { quote: string; source: string }> = {
	green: {
		quote:
			'Continue irrigating, but keep monitoring salinity because conditions can change quickly during high tide.',
		source: 'Nguyễn Hữu Thiện'
	},
	yellow: {
		quote: 'Store as much freshwater as possible and check salinity before every irrigation.',
		source: 'Bộ Nông nghiệp và Môi trường về ứng phó xâm nhập mặn'
	},
	red: {
		quote:
			'Stop taking irrigation water immediately and close sluice gates until salinity returns to a safe level.',
		source: 'Đỗ Văn Duy và cộng sự'
	}
};

// Salinity thresholds: < 1 safe, 1–4 caution, > 4 danger (g/L).
export function alertFor(ec: number): AlertLevel {
	if (ec > 4) return 'red';
	if (ec >= 1) return 'yellow';
	return 'green';
}

export function relativeTime(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const min = Math.round(diffMs / 60_000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr} hr ago`;
	const day = Math.round(hr / 24);
	return `${day} day${day > 1 ? 's' : ''} ago`;
}
