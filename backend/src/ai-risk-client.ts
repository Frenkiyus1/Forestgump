// Client gọi AI Engine POST /assess-risk (đánh giá rủi ro Điện Biên: rét
// đậm/rét hại, mưa lớn/lũ quét, sương mù dày). KHÔNG dùng chung biến
// AI_ENGINE_URL trong index.ts — biến đó trỏ .../predict cho luồng độ mặn
// cũ. Khác với /predict, /assess-risk là rule-based và KHÔNG có mock mode ở
// phía ai_engine (xem app.py) — lỗi ở đây nghĩa là ai_engine thật sự
// down/lỗi mạng, nên hàm dưới đây ném lỗi rõ ràng thay vì âm thầm fallback.

import 'dotenv/config';
import type { DienBienLocation } from './config/locations.js';
import type { DailyForecast } from './weather-types.js';
import { assessRiskResponseSchema, type AssessRiskResponse } from './schemas.js';

const AI_ENGINE_BASE_URL = process.env.AI_ENGINE_BASE_URL ?? 'http://localhost:8000';
const AI_ENGINE_TIMEOUT_MS = Number(process.env.AI_ENGINE_TIMEOUT_MS ?? 8000);

export type AssessRiskResult = AssessRiskResponse;

/**
 * Đánh giá rủi ro + bản tin cảnh báo cho 1 địa điểm qua toàn bộ dự báo nhiều
 * ngày đã cho. Ném lỗi nếu timeout/HTTP lỗi/sai định dạng phản hồi — không
 * mock ngầm (khác luồng độ mặn /predict).
 */
export async function assessRisk(
  location: DienBienLocation,
  daily: DailyForecast[]
): Promise<AssessRiskResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_ENGINE_TIMEOUT_MS);

  try {
    const res = await fetch(`${AI_ENGINE_BASE_URL}/assess-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        location: {
          code: location.code,
          name: location.name,
          elevation_m: location.elevationM,
          terrain: location.terrain,
        },
        forecast: daily.map((d) => ({
          date: d.date,
          temp_min_c: d.tempMinC,
          temp_max_c: d.tempMaxC,
          precipitation_mm: d.precipitationMm,
          humidity_pct: d.humidityPct,
          dew_point_c: d.dewPointC,
          wind_speed_kmh: d.windSpeedKmh,
        })),
      }),
    });

    if (!res.ok) {
      throw new Error(`AI Engine /assess-risk trả về status ${res.status} cho "${location.code}"`);
    }

    const parsed = assessRiskResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(
        `Sai định dạng phản hồi /assess-risk cho "${location.code}": ${parsed.error.issues[0]?.message}`
      );
    }
    return parsed.data;
  } finally {
    clearTimeout(timeoutId);
  }
}
