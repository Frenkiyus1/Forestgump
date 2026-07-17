import { describe, it, expect } from 'vitest';
import { toStationViews, summarize } from './derive';
import type { Station, LatestReading } from './types';

const stations: Station[] = [
	{ station_id: 'ST001', name: 'Văn Úc', lat: 20.6, lon: 106.5 },
	{ station_id: 'ST002', name: 'Bạch Đằng', lat: 20.7, lon: 106.7 },
	{ station_id: 'ST003', name: 'Lạch Tray', lat: 20.8, lon: 106.6 }
];
const readings: LatestReading[] = [
	{
		station_id: 'ST001',
		temp: 26,
		ec: 0.5,
		level: 1,
		forecast_24h: 0.5,
		alert: 'green',
		updated_at: 'x'
	},
	{
		station_id: 'ST002',
		temp: 27,
		ec: 2,
		level: 1,
		forecast_24h: 2.5,
		alert: 'yellow',
		updated_at: 'x'
	},
	{ station_id: 'ST003', temp: 28, ec: 5, level: 1, forecast_24h: 5, alert: 'red', updated_at: 'x' }
];

describe('toStationViews', () => {
	it('pairs each station with its reading, null when missing', () => {
		const views = toStationViews(stations, readings.slice(0, 2));
		expect(views).toHaveLength(3);
		expect(views[0].reading?.alert).toBe('green');
		expect(views[2].reading).toBeNull();
	});
});

describe('summarize', () => {
	it('computes counts, percentages, and sorted top stations', () => {
		const s = summarize(toStationViews(stations, readings));
		expect(s.total).toBe(3);
		expect(s.greenCount).toBe(1);
		expect(s.atRiskCount).toBe(2);
		expect(s.safePct).toBe(33);
		expect(s.healthPct).toBe(33);
		expect(s.topStations[0].name).toBe('Lạch Tray');
		expect(s.topStations[0].value).toBe(5);
	});

	it('handles empty input without dividing by zero', () => {
		const s = summarize([]);
		expect(s.total).toBe(0);
		expect(s.safePct).toBe(0);
		expect(s.topStations).toEqual([]);
	});
});
