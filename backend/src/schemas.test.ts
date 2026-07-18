import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  telemetrySchema,
  forecastResponseSchema,
  historyQuerySchema,
} from './schemas.js';

test('telemetrySchema: payload hợp lệ', () => {
  const r = telemetrySchema.safeParse({ temp: 28.5, ec: 2.1, level: 1.3 });
  assert.equal(r.success, true);
});

test('telemetrySchema: từ chối field thiếu', () => {
  const r = telemetrySchema.safeParse({ temp: 28.5, ec: 2.1 });
  assert.equal(r.success, false);
});

test('telemetrySchema: từ chối field lạ (strictObject)', () => {
  const r = telemetrySchema.safeParse({ temp: 28, ec: 2, level: 1, hacker: true });
  assert.equal(r.success, false);
});

test('telemetrySchema: từ chối ec âm và giá trị không hữu hạn', () => {
  assert.equal(telemetrySchema.safeParse({ temp: 28, ec: -1, level: 1 }).success, false);
  assert.equal(
    telemetrySchema.safeParse({ temp: 28, ec: Number.NaN, level: 1 }).success,
    false
  );
});

test('forecastResponseSchema: cần đủ cả 24h và 48h', () => {
  assert.equal(forecastResponseSchema.safeParse({ forecast_24h: 3 }).success, false);
  assert.equal(
    forecastResponseSchema.safeParse({ forecast_24h: 3, forecast_48h: 4 }).success,
    true
  );
});

test('historyQuerySchema: từ chối mốc thời gian không hợp lệ', () => {
  const ok = historyQuerySchema.safeParse({
    station: 'ST001',
    from: '2026-06-01T00:00:00Z',
    to: '2026-06-02T00:00:00Z',
  });
  assert.equal(ok.success, true);

  const bad = historyQuerySchema.safeParse({
    station: 'ST001',
    from: 'not-a-date',
    to: '2026-06-02T00:00:00Z',
  });
  assert.equal(bad.success, false);
});
