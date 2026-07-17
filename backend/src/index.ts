import 'dotenv/config';
import { readFileSync } from 'node:fs';
import mqtt from 'mqtt';
import type { IClientOptions } from 'mqtt';
import app from './api.js';
import {
  insertTelemetry,
  getRecentReadings,
  ensureUsersTable,
  getUserEmailsByProvince,
} from './db.js';
import { telemetrySchema, forecastResponseSchema } from './schemas.js';
import { sendAlertEmail } from './mailer.js';
import { sendAlertCall, sendAlertSMS } from './stringee.js';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? 'http://localhost:8000/predict';
const API_PORT = Number(process.env.API_PORT ?? 3000);
const TELEMETRY_TOPIC = 'waterqa/+/telemetry';
const RED_THRESHOLD = 4; // g/L -> mức cảnh báo đỏ
const YELLOW_THRESHOLD = 1; // g/L -> mức cảnh báo vàng
// Chống spam gọi điện/email khi telemetry dồn dập (demo 3s) hoặc cảm biến nhiễu
// dao động quanh ngưỡng: mỗi trạm chỉ cảnh báo lại sau khoảng thời gian này.
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS ?? 5 * 60 * 1000);
const lastAlertAt = new Map<string, number>(); // station_id -> lần cảnh báo gần nhất

// Province của từng trạm — mở rộng khi thêm trạm mới (dùng để gửi email cảnh báo).
const STATION_PROVINCE: Record<string, string> = {
  ST001: 'Hải Phòng',
  ST002: 'Hải Phòng',
  ST003: 'Hải Phòng',
};

const STATION_NAME: Record<string, string> = {
  ST001: 'Cửa sông Văn Úc',
  ST002: 'Cửa sông Bạch Đằng',
  ST003: 'Cửa sông Lạch Tray',
};

/**
 * Tùy chọn kết nối MQTT. Khi dùng `mqtts://` (TLS) thì gắn kèm chứng chỉ CA
 * (nếu có) và thông tin đăng nhập. Mọi cấu hình đọc từ .env, không hardcode.
 */
function buildMqttOptions(): IClientOptions {
  const options: IClientOptions = {};

  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

  if (MQTT_URL.startsWith('mqtts://')) {
    if (process.env.MQTT_CA_CERT) {
      options.ca = readFileSync(process.env.MQTT_CA_CERT);
    }
    options.rejectUnauthorized = process.env.MQTT_TLS_INSECURE !== 'true';
  }

  return options;
}

// --- 1. Khởi động REST API server + đảm bảo DB schema ---
app.listen(API_PORT, () => {
  console.log(`[API] REST server listening on http://localhost:${API_PORT}`);
});
ensureUsersTable();

// --- 2. Kết nối MQTT Broker (hỗ trợ TLS qua mqtts://) ---
const client = mqtt.connect(MQTT_URL, buildMqttOptions());

client.on('connect', () => {
  console.log(`[MQTT] Connected to broker ${MQTT_URL}`);
  client.subscribe(TELEMETRY_TOPIC, (err) => {
    if (err) {
      console.error('[MQTT] Subscribe failed:', err.message);
      return;
    }
    console.log(`[MQTT] Subscribed to topic "${TELEMETRY_TOPIC}"`);
  });
});

client.on('error', (err: Error) => {
  console.error('[MQTT] Connection error:', err.message);
});

// --- 3. Xử lý message telemetry ---
client.on('message', async (topic: string, message: Buffer) => {
  // topic dạng: waterqa/<station_id>/telemetry
  const station_id = topic.split('/')[1] ?? 'unknown';

  let raw: unknown;
  try {
    raw = JSON.parse(message.toString());
  } catch {
    console.error(`[MQTT] Invalid JSON on topic "${topic}":`, message.toString());
    return;
  }

  // Validate payload: từ chối dữ liệu thiếu field / sai kiểu / có field lạ.
  const parsed = telemetrySchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[MQTT] Invalid telemetry on "${topic}":`, parsed.error.issues);
    return;
  }

  const { temp, ec, level } = parsed.data;
  console.log(`[MQTT] ${station_id} =>`, parsed.data);

  // 3a. Gọi AI Engine để lấy dự báo (trước, để lưu kèm vào DB, hiển thị dashboard).
  // Dựng chuỗi lịch sử 48h gần nhất + bản đo hiện tại (chưa lưu DB) để AI Engine
  // tính đặc trưng time-series (lag, thống kê trượt, pha thuỷ triều).
  let forecast24: number | null = null;
  let forecast48: number | null = null;
  try {
    const recent = await getRecentReadings(station_id, 48);
    const history = [
      ...recent.map((r) => ({
        ts: new Date(r.ts).toISOString(),
        temp: r.temp,
        ec: r.ec,
        level: r.level,
      })),
      { ts: new Date().toISOString(), temp, ec, level },
    ];

    const response = await fetch(AI_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
    });

    if (!response.ok) {
      console.error(`[AI] Engine responded with status ${response.status}`);
    } else {
      const result = forecastResponseSchema.safeParse(await response.json());
      if (!result.success) {
        console.error(`[AI] Invalid response shape from engine:`, result.error.issues);
      } else {
        forecast24 = result.data.forecast_24h;
        forecast48 = result.data.forecast_48h;
        console.log(
          `[AI] ${station_id} forecast_24h = ${forecast24} g/L, forecast_48h = ${forecast48} g/L`
        );
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI] Failed to reach AI Engine at ${AI_ENGINE_URL}:`, msg);
  }

  // 3a-bis. Cảnh báo: dựa trên `ec` ĐO TRỰC TIẾP ngay lúc này (không phải dự báo AI)
  // để demo chính xác - nhúng cảm biến vào nước mặn vượt ngưỡng là cảnh báo/gọi ngay,
  // không phụ thuộc/chờ AI Engine (vẫn chạy song song để lưu forecast cho dashboard).
  const alertLevel: 'yellow' | 'red' | null =
    ec > RED_THRESHOLD ? 'red' : ec > YELLOW_THRESHOLD ? 'yellow' : null;

  const lastAlert = lastAlertAt.get(station_id) ?? 0;
  const withinCooldown = Date.now() - lastAlert < ALERT_COOLDOWN_MS;

  if (alertLevel && withinCooldown) {
    console.log(
      `[ALERT] Bỏ qua (cooldown) cho "${station_id}": vừa cảnh báo cách đây < ${ALERT_COOLDOWN_MS / 60000} phút`
    );
  } else if (alertLevel) {
    lastAlertAt.set(station_id, Date.now());
    const province = STATION_PROVINCE[station_id] ?? 'Unknown';
    const stationName = STATION_NAME[station_id] ?? station_id;
    console.warn(
      `[ALERT] ${alertLevel === 'red' ? '🔴' : '🟡'} ${alertLevel.toUpperCase()} for "${station_id}": ec=${ec} g/L (đo trực tiếp)`
    );

    const emails = await getUserEmailsByProvince(province);
    for (const email of emails) {
      sendAlertEmail({
        to: email,
        stationName,
        province,
        currentEc: ec,
        alertLevel,
      }).catch((err: unknown) => console.error('[MAIL] Failed to send to', email, err));
    }

    // Mức đỏ (> 4 g/L): gọi điện thoại khẩn cấp; nếu thất bại thì gửi SMS dự phòng.
    if (alertLevel === 'red') {
      try {
        await sendAlertCall({ stationId: station_id, level: alertLevel, ec });
      } catch (callErr) {
        console.error('[STRINGEE] sendAlertCall failed, falling back to SMS:', callErr);
        try {
          await sendAlertSMS(
            `[SaliGuard] NGUY HIỂM: Độ mặn tại trạm ${stationName} đạt ${ec.toFixed(2)} g/L, vượt ngưỡng 4 g/L. Đóng cống ngay lập tức.`
          );
        } catch (smsErr) {
          console.error('[STRINGEE] sendAlertSMS fallback also failed:', smsErr);
        }
      }
    }
  }

  // 3b. Lưu telemetry + forecast vào PostgreSQL (forecast có thể null nếu AI lỗi).
  await insertTelemetry(station_id, temp, ec, level, forecast24, forecast48);
});
