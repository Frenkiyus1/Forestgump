import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import {
  getStations,
  getLatestReading,
  stationExists,
  getHistory,
  getAlerts,
  saveUser,
  type UserProfile,
} from './db.js';
import { mockLatest, mockHistory, mockAlerts, mockDetail } from './mock.js';
import { classifyAlert, trendOf, type AlertLevel } from './alert.js';
import { stationQuerySchema, historyQuerySchema, chatBodySchema } from './schemas.js';
import { askChat, ChatUnavailableError } from './chat.js';

/**
 * Mã trạm DUY NHẤT gắn phần cứng thật (ESP32). Trạm này lấy dữ liệu từ DB;
 * mọi trạm còn lại trả dữ liệu mock để Dashboard luôn đầy đủ.
 */
const REAL_STATION_ID = process.env.REAL_STATION_ID ?? 'ST001';

interface LatestReading {
  station_id: string;
  temp: number;
  ec: number;
  level: number;
  forecast_24h: number;
  alert: AlertLevel;
  updated_at: string;
}

const app = express();

// CORS: chỉ cho phép domain Dashboard đã được duyệt (KHÔNG mở cho mọi origin).
// Domain mặc định của Dashboard luôn được phép; thêm domain khác (vd. staging,
// custom domain) qua biến môi trường CORS_ORIGIN, phân tách bằng dấu phẩy.
const DEFAULT_CORS_ORIGINS = ['https://saliguard.pages.dev', 'https://saliguard.com'];
const extraCorsOrigins = process.env.CORS_ORIGIN?.split(',')
  .map((o) => o.trim())
  .filter(Boolean) ?? [];
const corsOrigins = [...new Set([...DEFAULT_CORS_ORIGINS, ...extraCorsOrigins])];

app.use(
  cors({
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  })
);
app.use(express.json());

// GET /health - kiểm tra trạng thái service (dùng cho monitor/uptime check).
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// GET /api/stations - danh sách trạm kèm số liệu chi tiết (StationDetail).
// Trạm thật lấy từ DB; các trạm còn lại trả mock để mọi trang đều có dữ liệu.
app.get('/api/stations', async (_req: Request, res: Response) => {
  try {
    const stations = await getStations();
    const details = await Promise.all(
      stations.map(async (s) => {
        // Số liệu mock làm nền (battery/signal dùng cho cả trạm thật vì
        // telemetry phần cứng chưa gửi 2 chỉ số này).
        const m = mockDetail(s.station_id);
        let ec = m.ec;
        let temp = m.temp;
        let level = m.level;
        let forecast24 = m.forecast_24h;
        let forecast48 = m.forecast_48h;
        let updatedAt = m.updated_at;

        // Trạm thật: ghi đè bằng số đo mới nhất từ DB (nếu có).
        if (s.station_id === REAL_STATION_ID) {
          const row = await getLatestReading(s.station_id);
          if (row) {
            ec = row.ec;
            temp = row.temp;
            level = row.level;
            forecast24 = row.forecast_24h ?? row.ec;
            // Dự báo 48h thật từ AI Engine; nếu chưa có thì lùi về 24h.
            forecast48 = row.forecast_48h ?? forecast24;
            updatedAt = new Date(row.updated_at).toISOString();
          }
        }

        return {
          station_id: s.station_id,
          name: s.name,
          region: s.region,
          lat: s.lat,
          lon: s.lon,
          river: s.river ?? undefined,
          isAggregate: s.is_aggregate,
          ec,
          temp,
          level,
          forecast_24h: forecast24,
          forecast_48h: forecast48,
          alert: classifyAlert(forecast24),
          battery: m.battery,
          signal: m.signal,
          trend: trendOf(ec, forecast24),
          updated_at: updatedAt,
        };
      })
    );
    res.json(details);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/stations failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/latest?station=ID - số liệu mới nhất của một trạm (đọc từ DB)
app.get('/api/latest', async (req: Request, res: Response) => {
  const parsed = stationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
  }
  const { station } = parsed.data;

  try {
    if (!(await stationExists(station))) {
      return res.status(404).json({ error: `Station "${station}" not found` });
    }

    // Trạm mock: trả dữ liệu sinh theo thời gian, không đụng DB.
    if (station !== REAL_STATION_ID) {
      const m = mockLatest(station);
      const reading: LatestReading = {
        ...m,
        alert: classifyAlert(m.forecast_24h),
      };
      return res.json(reading);
    }

    const row = await getLatestReading(station);
    if (!row) {
      // Trạm thật có tồn tại nhưng chưa nhận được số đo nào.
      return res.status(404).json({ error: `No telemetry yet for station "${station}"` });
    }

    // forecast_24h phải LUÔN là số (frontend không chấp nhận null); nếu AI chưa
    // trả forecast thì tạm dùng ec hiện tại. alert cũng dựa trên giá trị này.
    const forecast24 = row.forecast_24h ?? row.ec;
    const reading: LatestReading = {
      station_id: row.station_id,
      temp: row.temp,
      ec: row.ec,
      level: row.level,
      forecast_24h: forecast24,
      alert: classifyAlert(forecast24),
      updated_at: new Date(row.updated_at).toISOString(),
    };

    res.json(reading);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/latest failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/history?station=ID&from=ISO&to=ISO - chuỗi dữ liệu cho biểu đồ
app.get('/api/history', async (req: Request, res: Response) => {
  const parsed = historyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
  }
  const { station, from, to } = parsed.data;

  try {
    if (!(await stationExists(station))) {
      return res.status(404).json({ error: `Station "${station}" not found` });
    }

    // Trạm mock: sinh chuỗi lịch sử theo thời gian.
    if (station !== REAL_STATION_ID) {
      return res.json(mockHistory(station, from, to));
    }

    const rows = await getHistory(station, from, to);
    const points = rows.map((r) => ({
      ts: new Date(r.ts).toISOString(),
      ec: r.ec,
      temp: r.temp,
      level: r.level,
    }));
    res.json(points);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/history failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/alerts - lịch sử các lần vượt ngưỡng cảnh báo (chỉ yellow/red)
app.get('/api/alerts', async (_req: Request, res: Response) => {
  try {
    // Cảnh báo thật từ DB (chỉ trạm phần cứng).
    const rows = await getAlerts();
    const realEvents = rows
      .filter((r) => r.station_id === REAL_STATION_ID)
      .map((r) => {
        const basis = r.forecast_24h ?? r.ec;
        const level: 'yellow' | 'red' = basis >= 4 ? 'red' : 'yellow';
        const message =
          level === 'red'
            ? `Nguy hiểm: độ mặn ${r.ec} g/L vượt ngưỡng 4 g/L - đóng cống ngay`
            : `Cảnh báo: độ mặn ${r.ec} g/L vượt ngưỡng 1 g/L - chuẩn bị đóng cống`;
        return {
          id: `${r.station_id}-${new Date(r.ts).getTime()}`,
          station_id: r.station_id,
          station: r.station,
          region: r.region,
          level,
          ec: r.ec,
          message,
          ts: new Date(r.ts).toISOString(),
        };
      });

    // Cảnh báo mock cho các trạm chưa gắn phần cứng.
    const stations = await getStations();
    const mockEvents = stations
      .filter((s) => s.station_id !== REAL_STATION_ID)
      .flatMap((s) => mockAlerts({ station_id: s.station_id, name: s.name, region: s.region }));

    // Gộp, sắp xếp mới nhất trước.
    const events = [...realEvents, ...mockEvents].sort(
      (a, b) => Date.parse(b.ts) - Date.parse(a.ts)
    );
    res.json(events);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/alerts failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhook/stringee - answer_url cho Stringee Call API, trả về SCCO đọc cảnh báo.
app.get('/api/webhook/stringee', (_req: Request, res: Response) => {
  res.status(200).json([
    {
      action: 'talk',
      text: 'Cảnh báo khẩn cấp từ hệ thống SaliGuard. Phát hiện độ mặn vượt mức an toàn. Đề nghị đóng cống ngăn mặn ngay lập tức.',
      voice: 'female',
      speed: 0,
    },
  ]);
});

// POST /api/chat { messages } -> { reply } — chatbot Gemini
app.post('/api/chat', async (req: Request, res: Response) => {
  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }

  try {
    const reply = await askChat(parsed.data.messages);
    res.json({ reply });
  } catch (err) {
    if (err instanceof ChatUnavailableError) {
      return res.status(503).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/chat failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users — lưu profile người dùng từ onboarding
app.post('/api/users', async (req: Request, res: Response) => {
  const { email, province, district, commune, farm_type, farm_area, water_source, alert_threshold, lead_time, experience } = req.body as Partial<UserProfile>;

  if (!email || !province || !district) {
    return res.status(400).json({ error: 'Missing required fields: email, province, district' });
  }

  try {
    await saveUser({
      email,
      province,
      district,
      ...(commune !== undefined && { commune }),
      ...(farm_type !== undefined && { farm_type }),
      ...(farm_area !== undefined && { farm_area }),
      ...(water_source !== undefined && { water_source }),
      ...(alert_threshold !== undefined && { alert_threshold }),
      ...(lead_time !== undefined && { lead_time }),
      ...(experience !== undefined && { experience }),
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to save user profile' });
  }
});

export default app;
