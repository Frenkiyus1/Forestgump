// Hàm thuần gộp dữ liệu theo giờ (Open-Meteo `hourly=`) thành giá trị theo ngày,
// và tính tổng trượt (rolling sum) nhiều ngày — dùng cho mưa đá (CAPE/mực đóng
// băng) và sạt lở đất (mưa tích luỹ 3 ngày). Không gọi fetch, dễ unit-test riêng.

function bucketByDate(times: string[], values: number[]): Map<string, number[]> {
  const byDate = new Map<string, number[]>();
  times.forEach((time, i) => {
    const date = time.slice(0, 10);
    const bucket = byDate.get(date) ?? [];
    bucket.push(values[i] as number);
    byDate.set(date, bucket);
  });
  return byDate;
}

export function maxPerDay(times: string[], values: number[]): Map<string, number> {
  const byDate = bucketByDate(times, values);
  return new Map([...byDate.entries()].map(([date, vals]) => [date, Math.max(...vals)]));
}

export function minPerDay(times: string[], values: number[]): Map<string, number> {
  const byDate = bucketByDate(times, values);
  return new Map([...byDate.entries()].map(([date, vals]) => [date, Math.min(...vals)]));
}

export function meanPerDay(times: string[], values: number[]): Map<string, number> {
  const byDate = bucketByDate(times, values);
  return new Map(
    [...byDate.entries()].map(([date, vals]) => [date, vals.reduce((a, b) => a + b, 0) / vals.length])
  );
}

/** Tổng `windowDays` ngày tính đến (và bao gồm) `endIndex` trong mảng theo ngày đã cho. */
export function rollingSum(dailyValues: number[], endIndex: number, windowDays: number): number {
  const startIndex = Math.max(0, endIndex - windowDays + 1);
  let sum = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    sum += dailyValues[i] ?? 0;
  }
  return sum;
}
