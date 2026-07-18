import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHail,
  classifyLandslide,
  classifyHeavyRainFloodRisk,
  classifyFog,
} from './alert-dienbien.js';

test('classifyHail: xanh khi chưa có mưa đối lưu (showers < gate) dù CAPE cao', () => {
  assert.equal(classifyHail(3000, 3000, 0.5), 'green');
  assert.equal(classifyHail(3000, 3000, 0), 'green');
});

test('classifyHail: đỏ khi CAPE mạnh + mực đóng băng thấp', () => {
  assert.equal(classifyHail(2500, 3500, 5), 'red');
  assert.equal(classifyHail(3000, 2000, 10), 'red');
});

test('classifyHail: cam khi CAPE vừa + mực đóng băng <= 4500m', () => {
  assert.equal(classifyHail(1500, 4500, 5), 'orange');
  assert.equal(classifyHail(2499, 3501, 5), 'orange');
});

test('classifyHail: vàng khi CAPE vừa nhưng mực đóng băng cao, hoặc CAPE yếu', () => {
  assert.equal(classifyHail(1500, 4500.1, 5), 'yellow');
  assert.equal(classifyHail(500, 5000, 5), 'yellow');
  assert.equal(classifyHail(1499, 5000, 5), 'yellow');
});

test('classifyHail: xanh khi CAPE dưới ngưỡng yếu', () => {
  assert.equal(classifyHail(499, 3000, 5), 'green');
});

test('classifyLandslide: đỏ khi mưa tích luỹ 3 ngày > 350mm và đất bão hoà', () => {
  assert.equal(classifyLandslide(350.1, 0.35), 'red');
  assert.equal(classifyLandslide(500, 0.5), 'red');
});

test('classifyLandslide: cam khi mưa > 200mm và đất ẩm vừa trở lên', () => {
  assert.equal(classifyLandslide(200.1, 0.25), 'orange');
  assert.equal(classifyLandslide(350, 0.34), 'orange'); // không đỏ vì đất chưa bão hoà
});

test('classifyLandslide: vàng khi mưa > 200mm nhưng đất chưa đủ ẩm', () => {
  assert.equal(classifyLandslide(400, 0.2), 'yellow');
});

test('classifyLandslide: vàng khi mưa tích luỹ >= 100mm hoặc đất đã bão hoà', () => {
  assert.equal(classifyLandslide(100, 0.1), 'yellow');
  assert.equal(classifyLandslide(200, 0.1), 'yellow');
  assert.equal(classifyLandslide(0, 0.35), 'yellow');
});

test('classifyLandslide: xanh (bình thường)', () => {
  assert.equal(classifyLandslide(99.9, 0.24), 'green');
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
