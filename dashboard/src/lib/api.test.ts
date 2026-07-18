import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_API_URL: '' } }));

import { loadDienBienForecast } from './api';

describe('loadDienBienForecast', () => {
	it('returns an empty fallback payload when the backend request fails', async () => {
		const result = await loadDienBienForecast(async () => {
			throw new Error('backend unreachable');
		});

		expect(result.forecastEntries).toEqual([]);
		expect(result.apiError).toBe('backend unreachable');
	});
});
