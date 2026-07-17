// Trigger demo: đưa 1 giá trị độ mặn (g/L) → chạy đúng logic phân loại cảnh báo
// → nếu ĐỎ thì bắn push tới điện thoại qua ntfy. Độc lập với MQTT/AI/DB.
//
// Chạy:  npx tsx src/alert-test.ts 4.5
//        npx tsx src/alert-test.ts 2      (vàng — không gọi)
//
// Đọc NTFY_TOPIC từ .env thủ công (không cần cài dotenv).

import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const value = Number(process.argv[2] ?? 4.5);
const stationName = 'Cửa sông Lạch Tray (demo)';

const { classifyAlert } = await import('./alert.js');
const { sendAlertPush } = await import('./caller.js');

const level = classifyAlert(value);
console.log(`[TEST] độ mặn ${value} g/L → mức ${level.toUpperCase()}`);

if (level === 'red') {
  await sendAlertPush(stationName, value);
  console.log('🔴 Đã bắn cảnh báo — kiểm tra điện thoại (ntfy reo).');
} else {
  console.log('Chưa tới ngưỡng đỏ (≥ 4 g/L) nên không gọi. Thử: npx tsx src/alert-test.ts 4.5');
}
