// Zod schemas để validate mọi dữ liệu ĐẦU VÀO không tin cậy:
//  - payload telemetry nhận qua MQTT (từ ESP32 ngoài hiện trường)
//  - phản hồi từ AI Engine
//  - query params của REST API
// Dùng z.strictObject để từ chối field lạ (bảo vệ chặt hơn z.object).

import { z } from 'zod';

/** Payload JSON do ESP32 publish lên topic waterqa/<id>/telemetry. */
export const telemetrySchema = z.strictObject({
  temp: z.number().finite(),
  ec: z.number().finite().nonnegative(),
  level: z.number().finite(),
});
export type TelemetryPayload = z.infer<typeof telemetrySchema>;

/** Kết quả dự báo trả về từ AI Engine. */
export const forecastResponseSchema = z.strictObject({
  forecast_24h: z.number().finite(),
  forecast_48h: z.number().finite(),
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;

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

/** Query của GET /api/latest và các endpoint chỉ cần mã trạm. */
export const stationQuerySchema = z.strictObject({
  station: z.string().min(1, 'Missing required query param: station'),
});

/** Mốc thời gian phải parse được (giữ nguyên độ "rộng" như Date.parse cũ). */
const dateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date format');

/** Query của GET /api/history (kèm khoảng thời gian hợp lệ). */
export const historyQuerySchema = z.strictObject({
  station: z.string().min(1),
  from: dateString,
  to: dateString,
});

/**
 * Phản hồi dự báo 7 ngày từ Open-Meteo (endpoint /v1/forecast).
 * Dùng z.object (KHÔNG strict) vì đây là API bên thứ 3 ta không kiểm soát —
 * Open-Meteo có thể thêm field mới bất kỳ lúc nào, strictObject sẽ vỡ khi đó.
 */
export const openMeteoForecastSchema = z.object({
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

/** Một lượt hội thoại (user hỏi / model trả lời). */
export const chatTurnSchema = z.strictObject({
  role: z.enum(['user', 'model']),
  text: z.string().min(1).max(4000),
});

/** Body của POST /api/chat: cả mạch hội thoại (để chatbot nhớ ngữ cảnh). */
export const chatBodySchema = z.strictObject({
  messages: z.array(chatTurnSchema).min(1, 'Cần ít nhất 1 tin nhắn').max(40),
});

export type ChatTurn = z.infer<typeof chatTurnSchema>;

/** Phản hồi từ Satellite Engine POST /predict (segmentation ảnh vệ tinh). */
export const satellitePredictResponseSchema = z.strictObject({
  job_id: z.string(),
  mask_path: z.string(),
  target_area_pct: z.number().finite(),
});
export type SatellitePredictResponse = z.infer<typeof satellitePredictResponseSchema>;
