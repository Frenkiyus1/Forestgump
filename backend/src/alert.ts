// Logic phân loại mức cảnh báo độ mặn — tách riêng để tái dùng và unit-test.
// Ngưỡng thống nhất toàn hệ thống: 1 g/L (vàng) và 4 g/L (đỏ).

/** Trạng thái cảnh báo dựa trên độ mặn dự báo. */
export type AlertLevel = 'green' | 'yellow' | 'red';

/** Quy đổi giá trị độ mặn (g/L) sang mức cảnh báo theo ngưỡng 1 & 4 g/L. */
export function classifyAlert(value: number): AlertLevel {
  if (value >= 4) return 'red';
  if (value >= 1) return 'yellow';
  return 'green';
}

/** Xu hướng EC dựa trên forecast so với giá trị hiện tại. */
export function trendOf(current: number, forecast: number): 'up' | 'down' | 'flat' {
  if (forecast > current + 0.1) return 'up';
  if (forecast < current - 0.1) return 'down';
  return 'flat';
}
