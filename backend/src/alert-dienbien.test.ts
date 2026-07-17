import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyColdDamage, classifyHeavyRainFloodRisk, classifyFog } from './alert-dienbien.js';

test('classifyColdDamage: rét hại (<= 13°C)', () => {
  assert.equal(classifyColdDamage(13), 'red');
  assert.equal(classifyColdDamage(-2), 'red');
});

test('classifyColdDamage: rét đậm (13°C đến 15°C)', () => {
  assert.equal(classifyColdDamage(13.1), 'yellow');
  assert.equal(classifyColdDamage(15), 'yellow');
});

test('classifyColdDamage: bình thường (> 15°C)', () => {
  assert.equal(classifyColdDamage(15.1), 'green');
  assert.equal(classifyColdDamage(28), 'green');
});

test('classifyHeavyRainFloodRisk: đỏ (> 400mm/24h)', () => {
  assert.equal(classifyHeavyRainFloodRisk(400.1), 'red');
  assert.equal(classifyHeavyRainFloodRisk(600), 'red');
});

test('classifyHeavyRainFloodRisk: cam (trên 200 đến 400mm/24h)', () => {
  assert.equal(classifyHeavyRainFloodRisk(200.1), 'orange');
  assert.equal(classifyHeavyRainFloodRisk(400), 'orange');
});

test('classifyHeavyRainFloodRisk: vàng (100-200mm/24h)', () => {
  assert.equal(classifyHeavyRainFloodRisk(100), 'yellow');
  assert.equal(classifyHeavyRainFloodRisk(200), 'yellow');
});

test('classifyHeavyRainFloodRisk: vàng theo mm/12h dù mm/24h thấp', () => {
  assert.equal(classifyHeavyRainFloodRisk(80, 50), 'yellow');
  assert.equal(classifyHeavyRainFloodRisk(80, 49.9), 'green');
});

test('classifyHeavyRainFloodRisk: xanh (bình thường)', () => {
  assert.equal(classifyHeavyRainFloodRisk(0), 'green');
  assert.equal(classifyHeavyRainFloodRisk(99.9), 'green');
});

test('classifyFog: đỏ - sương mù dày (< 50m)', () => {
  assert.equal(classifyFog(49.9), 'red');
  assert.equal(classifyFog(0), 'red');
});

test('classifyFog: vàng - sương mù (50m đến dưới 1000m)', () => {
  assert.equal(classifyFog(50), 'yellow');
  assert.equal(classifyFog(999.9), 'yellow');
});

test('classifyFog: xanh - tầm nhìn tốt (>= 1000m)', () => {
  assert.equal(classifyFog(1000), 'green');
  assert.equal(classifyFog(10000), 'green');
});
