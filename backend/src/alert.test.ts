import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAlert, trendOf } from './alert.js';

test('classifyAlert: ngưỡng đỏ (>= 4 g/L)', () => {
  assert.equal(classifyAlert(4), 'red');
  assert.equal(classifyAlert(10.5), 'red');
});

test('classifyAlert: ngưỡng vàng (1 đến < 4 g/L)', () => {
  assert.equal(classifyAlert(1), 'yellow');
  assert.equal(classifyAlert(3.9), 'yellow');
});

test('classifyAlert: an toàn xanh (< 1 g/L)', () => {
  assert.equal(classifyAlert(0), 'green');
  assert.equal(classifyAlert(0.99), 'green');
});

test('trendOf: tăng / giảm / phẳng theo biên 0.1', () => {
  assert.equal(trendOf(2, 2.2), 'up');
  assert.equal(trendOf(2, 1.8), 'down');
  assert.equal(trendOf(2, 2.05), 'flat');
});
