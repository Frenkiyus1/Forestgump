// Sinh dữ liệu mock mượt theo thời gian cho các trạm CHƯA gắn phần cứng thật.
// Cùng một bộ hàm (ecAt/tempAt/levelAt) được dùng cho latest / history / alerts
// nên dữ liệu luôn nhất quán giữa các màn hình.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type Level = 'green' | 'yellow' | 'red';

/** Băm station_id thành số để mỗi trạm có "tính cách" riêng (nền + pha khác nhau). */
function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function levelOf(value: number): Level {
  if (value >= 4) return 'red';
  if (value >= 1) return 'yellow';
  return 'green';
}

/**
 * Pha (radian) riêng cho mỗi trạm. Nhân với 137 (xấp xỉ "góc vàng") để các id
 * liền kề (ST002, ST003...) phân tán rộng quanh vòng tròn thay vì trùng nhau.
 */
function phaseOf(stationId: string): number {
  return ((seedFromId(stationId) * 137) % 360) * (Math.PI / 180);
}

/**
 * Độ mặn (g/L) tại thời điểm t — gồm 3 thành phần:
 *  - thuỷ triều ngày (24h) + bán nhật (12h): dao động trong ngày
 *  - sóng nhiều ngày (~3.3 ngày): tạo xu hướng để dự báo 24h/48h KHÁC hiện tại
 */
export function ecAt(stationId: string, t: number): number {
  // Nền 0.2–4.0 g/L tuỳ trạm: có trạm an toàn (xanh), trạm trung bình (vàng),
  // trạm nguy hiểm (đỏ) -> phân bố cảnh báo thực tế trên toàn mạng lưới.
  const base = 0.2 + ((seedFromId(stationId) * 53) % 380) / 100;
  const phase = phaseOf(stationId);
  const tide = 0.9 * Math.sin((2 * Math.PI * t) / DAY_MS + phase);
  const semi = 0.3 * Math.sin((2 * Math.PI * t) / (DAY_MS / 2) + phase);
  const swell = 0.8 * Math.sin((2 * Math.PI * t) / (DAY_MS * 3.3) + phase);
  return Math.max(0, round1(base + tide + semi + swell));
}

/** Nhiệt độ nước (°C) tại thời điểm t. */
export function tempAt(stationId: string, t: number): number {
  return round1(28 + 2 * Math.sin((2 * Math.PI * t) / DAY_MS + phaseOf(stationId)));
}

/** Mực nước (m) tại thời điểm t. */
export function levelAt(stationId: string, t: number): number {
  return round1(1.2 + 0.4 * Math.sin((2 * Math.PI * t) / DAY_MS + phaseOf(stationId)));
}

export interface MockLatest {
  station_id: string;
  temp: number;
  ec: number;
  level: number;
  forecast_24h: number;
  updated_at: string;
}

/** Số liệu mới nhất mock; forecast_24h = độ mặn 24h tới trên cùng đường cong. */
export function mockLatest(stationId: string): MockLatest {
  const now = Date.now();
  return {
    station_id: stationId,
    temp: tempAt(stationId, now),
    ec: ecAt(stationId, now),
    level: levelAt(stationId, now),
    forecast_24h: ecAt(stationId, now + DAY_MS),
    updated_at: new Date(now).toISOString(),
  };
}

export interface MockHistoryPoint {
  ts: string;
  ec: number;
  temp: number;
  level: number;
}

/** Chuỗi lịch sử mock trong [from, to], ~1 điểm/giờ (tối đa 500 điểm). */
export function mockHistory(stationId: string, from: string, to: string): MockHistoryPoint[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];
  const step = Math.max(HOUR_MS, Math.ceil((end - start) / 500));
  const points: MockHistoryPoint[] = [];
  for (let t = start; t <= end; t += step) {
    points.push({
      ts: new Date(t).toISOString(),
      ec: ecAt(stationId, t),
      temp: tempAt(stationId, t),
      level: levelAt(stationId, t),
    });
  }
  return points;
}

export interface MockDetail {
  ec: number;
  temp: number;
  level: number;
  forecast_24h: number;
  forecast_48h: number;
  battery: number;
  signal: number;
  updated_at: string;
}

/** Toàn bộ số liệu chi tiết mock cho 1 trạm (dùng cho trang Stations/Map/Reports). */
export function mockDetail(stationId: string): MockDetail {
  const now = Date.now();
  const seed = seedFromId(stationId);
  return {
    ec: ecAt(stationId, now),
    temp: tempAt(stationId, now),
    level: levelAt(stationId, now),
    forecast_24h: ecAt(stationId, now + DAY_MS),
    forecast_48h: ecAt(stationId, now + 2 * DAY_MS),
    battery: 60 + (seed % 41), // 60–100 %
    signal: 2 + (seed % 3), // 2–4 vạch
    updated_at: new Date(now).toISOString(),
  };
}

export interface MockAlertEvent {
  id: string;
  station_id: string;
  station: string;
  region: string;
  level: 'yellow' | 'red';
  ec: number;
  message: string;
  ts: string;
}

const RANK: Record<Level, number> = { green: 0, yellow: 1, red: 2 };

/** Các sự kiện vượt ngưỡng trong 48h qua cho 1 trạm mock (chỉ tại điểm "leo thang"). */
export function mockAlerts(station: {
  station_id: string;
  name: string;
  region: string;
}): MockAlertEvent[] {
  const now = Date.now();
  const events: MockAlertEvent[] = [];
  let prev: Level = 'green';
  for (let t = now - 2 * DAY_MS; t <= now; t += HOUR_MS) {
    const ec = ecAt(station.station_id, t);
    const level = levelOf(ec);
    if (level !== 'green' && RANK[level] > RANK[prev]) {
      events.push({
        id: `${station.station_id}-${t}`,
        station_id: station.station_id,
        station: station.name,
        region: station.region,
        level,
        ec,
        message:
          level === 'red'
            ? `Nguy hiểm: độ mặn ${ec} g/L vượt ngưỡng 4 g/L - đóng cống ngay`
            : `Cảnh báo: độ mặn ${ec} g/L vượt ngưỡng 1 g/L - chuẩn bị đóng cống`,
        ts: new Date(t).toISOString(),
      });
    }
    prev = level;
  }
  return events;
}
