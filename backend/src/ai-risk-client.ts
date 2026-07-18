// Client gọi AI Engine POST /assess-risk (đánh giá rủi ro Điện Biên: rét
// đậm/rét hại, mưa lớn/lũ quét, sương mù dày). /assess-risk là rule-based
// và KHÔNG có mock mode ở phía ai_engine (xem app.py) — lỗi ở đây nghĩa là
// ai_engine thật sự down/lỗi mạng, nên hàm dưới đây ném lỗi rõ ràng thay vì
// âm thầm fallback.

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
 * mock ngầm.
 *
 * `elevationGridM` (độ cao ô lưới Open-Meteo, từ LocationWeather) cho phép AI
 * Engine hiệu chỉnh nhiệt độ về độ cao thực tế của địa điểm (downscale.py);
 * bỏ trống (nguồn OpenWeatherMap) thì AI Engine bỏ qua hiệu chỉnh.
 */
export async function assessRisk(
  location: DienBienLocation,
  daily: DailyForecast[],
  elevationGridM?: number
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
          // Các trường tổng hợp từ hourly Open-Meteo (undefined -> JSON bỏ
          // field -> AI Engine nhận None và tự bỏ qua tín hiệu tương ứng).
          elevation_grid_m: elevationGridM,
          rain_12h_mm: d.rain12hMaxMm,
          rain_1h_mm: d.rain1hMaxMm,
          visibility_min_m: d.visibilityMinM,
          dew_spread_min_c: d.dewSpreadMinC,
          humidity_max_pct: d.humidityMaxPct,
          wind_gusts_kmh: d.windGustsMaxKmh,
          soil_moisture_0_1: d.soilMoisture01,
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
