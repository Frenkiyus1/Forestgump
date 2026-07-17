import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ecAt, mockHistory, mockAlerts } from './mock.js';

test('ecAt: tất định (cùng id + thời điểm => cùng giá trị) và không âm', () => {
  const t = Date.UTC(2026, 5, 1, 12, 0, 0);
  assert.equal(ecAt('ST002', t), ecAt('ST002', t));
  assert.ok(ecAt('ST002', t) >= 0);
});

test('mockHistory: rỗng khi khoảng thời gian sai', () => {
  assert.deepEqual(mockHistory('ST002', 'bad', 'bad'), []);
  assert.deepEqual(
    mockHistory('ST002', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z'),
    []
  );
});

test('mockHistory: tăng dần theo thời gian, tối đa ~500 điểm', () => {
  const pts = mockHistory('ST002', '2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z');
  assert.ok(pts.length > 0 && pts.length <= 501);
  for (let i = 1; i < pts.length; i += 1) {
    assert.ok(Date.parse(pts[i]!.ts) > Date.parse(pts[i - 1]!.ts));
  }
});

test('mockAlerts: chỉ là sự kiện leo thang (yellow/red, mức tăng dần)', () => {
  const events = mockAlerts({ station_id: 'ST006', name: 'Test', region: 'R' });
  for (const e of events) {
    assert.ok(e.level === 'yellow' || e.level === 'red');
    assert.ok(e.ec >= 1);
  }
});
