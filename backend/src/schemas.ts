// Zod schemas để validate mọi dữ liệu ĐẦU VÀO không tin cậy:
//  - phản hồi từ AI Engine
//  - query params của REST API
//  - phản hồi từ nguồn thời tiết bên thứ 3 (Open-Meteo, OpenWeatherMap)
// Dùng z.strictObject để từ chối field lạ (bảo vệ chặt hơn z.object).

import { z } from 'zod';

/** 1 hiểm hoạ trong đánh giá rủi ro Điện Biên — khớp risk_engine.HazardRisk. */
export const hazardRiskSchema = z.strictObject({
  hazard: z.enum(['cold_damage', 'heavy_rain_flood', 'fog']),
  alert_level: z.enum(['green', 'yellow', 'orange', 'red']),
  risk_score: z.number().finite(),
  detail: z.string(),
});
export type HazardRisk = z.infer<typeof hazardRiskSchema>;

/** Đánh giá rủi ro 1 ngày (3 hiểm hoạ) — khớp risk_engine.RiskAssessment. */
export const riskAssessmentSchema = z.strictObject({
  location_code: z.string(),
  date: z.string(),
  hazards: z.array(hazardRiskSchema),
});

/** Risk + bản tin cảnh báo 1 ngày — khớp app.DayAssessment. */
export const dayAssessmentSchema = z.strictObject({
  risk: riskAssessmentSchema,
  bulletin: z.string(),
});

/** Phản hồi đầy đủ từ POST /assess-risk (ai_engine) — khớp app.AssessRiskResponse. */
export const assessRiskResponseSchema = z.strictObject({
  location_code: z.string(),
  days: z.array(dayAssessmentSchema),
});
export type AssessRiskResponse = z.infer<typeof assessRiskResponseSchema>;

/** Query của GET /api/dienbien-forecast — thiếu `location` -> trả cả 3 địa điểm. */
export const dienbienForecastQuerySchema = z.strictObject({
  location: z.string().min(1).optional(),
});

/**
 * Query của GET /api/bulletins. `activeOnly` là chuỗi vì query param luôn là
 * string — route handler tự diễn giải (mặc định true khi thiếu/không gửi).
 */
export const bulletinsQuerySchema = z.strictObject({
  location: z.string().min(1).optional(),
  activeOnly: z.enum(['true', 'false']).optional(),
});

/** Query của GET /api/mock-notify — thiếu `channel` -> trả cả 3 kênh mô phỏng. */
export const mockNotifyQuerySchema = z.strictObject({
  location: z.string().min(1).optional(),
  channel: z.enum(['zalo', 'sms', 'loa']).optional(),
});

/** Body của POST /api/chat — câu hỏi tự do người dùng gõ trong chat widget. */
export const chatRequestSchema = z.strictObject({
  question: z.string().min(1).max(500),
});

/**
 * Phản hồi dự báo 7 ngày từ Open-Meteo (endpoint /v1/forecast).
 * Dùng z.object (KHÔNG strict) vì đây là API bên thứ 3 ta không kiểm soát —
 * Open-Meteo có thể thêm field mới bất kỳ lúc nào, strictObject sẽ vỡ khi đó.
 */
export const openMeteoForecastSchema = z.object({
  /** Độ cao ô lưới (m) Open-Meteo dùng để nội suy dự báo — cho downscaling nhiệt độ. */
  elevation: z.number().optional(),
  current: z.object({
    temperature_2m: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    relative_humidity_2m_mean: z.array(z.number()),
    dew_point_2m_mean: z.array(z.number()),
    wind_speed_10m_mean: z.array(z.number()),
  }),
  // Chuỗi hourly có thể chứa null (giờ ngoài phạm vi model) — nullable từng phần tử.
  hourly: z.object({
    time: z.array(z.string()),
    precipitation: z.array(z.number().nullable()),
    visibility: z.array(z.number().nullable()),
    temperature_2m: z.array(z.number().nullable()),
    dew_point_2m: z.array(z.number().nullable()),
    relative_humidity_2m: z.array(z.number().nullable()),
    wind_gusts_10m: z.array(z.number().nullable()),
    soil_moisture_0_to_1cm: z.array(z.number().nullable()),
  }),
});

/**
 * Phản hồi dự báo 5 ngày/3 giờ từ OpenWeatherMap (endpoint /data/2.5/forecast),
 * dùng làm nguồn đối chiếu/dự phòng. Cũng dùng z.object không strict vì là API
 * bên thứ 3. Chỉ khai báo các field thực sự dùng tới.
 */
export const openWeatherMapForecastSchema = z.object({
  list: z.array(
    z.object({
      dt_txt: z.string(),
      main: z.object({
        temp: z.number(),
        humidity: z.number(),
      }),
      wind: z.object({
        speed: z.number(),
      }),
      rain: z.object({ '3h': z.number() }).partial().optional(),
    })
  ),
});
