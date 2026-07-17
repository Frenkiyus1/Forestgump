import type { AlertLevel } from './types';

export interface TrendSeries {
	labels: string[];
	values: number[];
}

export interface PeakTiles {
	peakSalinity: { value: number; unit: string };
	peakDay: { label: string; sub: string };
	topRiskStation: { name: string; sub: string };
}

export interface AlertFeedItem {
	id: string;
	station: string;
	level: AlertLevel;
	message: string;
	ago: string;
}

export interface QuickAction {
	id: string;
	label: string;
}

// Mock: replace with GET /api/history when available.
export const MOCK_TREND: TrendSeries = {
	labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
	values: [0.6, 0.9, 1.4, 2.1, 3.2, 2.6, 1.8]
};

export const MOCK_PEAKS: PeakTiles = {
	peakSalinity: { value: 5.2, unit: 'g/L' },
	peakDay: { label: 'Thứ 6', sub: '26/06/2026' },
	topRiskStation: { name: 'Cửa sông Lạch Tray', sub: 'Dự báo 5.0 g/L' }
};

// Mock: replace with GET /api/alerts when available.
export const MOCK_ALERT_FEED: AlertFeedItem[] = [
	{
		id: 'a1',
		station: 'Lạch Tray',
		level: 'red',
		message: 'Vượt 4 g/L — đóng cống',
		ago: '5 phút'
	},
	{
		id: 'a2',
		station: 'Bạch Đằng',
		level: 'yellow',
		message: 'Tăng dần — chuẩn bị',
		ago: '22 phút'
	},
	{ id: 'a3', station: 'Văn Úc', level: 'green', message: 'An toàn', ago: '1 giờ' }
];

export const QUICK_ACTIONS: QuickAction[] = [
	{ id: 'q1', label: 'Bản đồ trạm' },
	{ id: 'q2', label: 'Lịch sử cảnh báo' },
	{ id: 'q3', label: 'Xuất báo cáo' },
	{ id: 'q4', label: 'Thêm trạm' }
];
