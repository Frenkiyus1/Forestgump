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
import {
  stationQuerySchema,
  historyQuerySchema,
  chatBodySchema,
  dienbienForecastQuerySchema,
  bulletinsQuerySchema,
  type HazardRisk,
} from './schemas.js';
import { askChat, ChatUnavailableError } from './chat.js';
import { fetchAllLocationsForecast, fetchLocationForecast } from './weather-ingest.js';
import { DIEN_BIEN_LOCATIONS, findLocationByCode, type DienBienLocation } from './config/locations.js';
import { assessRisk } from './ai-risk-client.js';
import { fetchNchmfReference, type NchmfReference } from './nchmf-reference.js';
import { checkSatelliteHealth, forwardSatellitePredict, SatelliteEngineUnavailableError } from './satellite-client.js';

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
const DEFAULT_CORS_ORIGINS = ['https://forestgump.pages.dev', 'https://forestgump.com'];
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

// GET /api/weather-raw - dữ liệu ingest thô (dự báo 7 ngày) cho 3 địa điểm
// demo Điện Biên, gọi trực tiếp Open-Meteo (tự fallback OpenWeatherMap nếu
// lỗi). Dùng để kiểm tra bằng tay pipeline ingest — CHƯA áp dụng phân loại
// cảnh báo (xem alert-dienbien.ts cho bước đó).
app.get('/api/weather-raw', async (_req: Request, res: Response) => {
  try {
    const results = await fetchAllLocationsForecast();
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/weather-raw failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface DienBienForecastDay {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  humidityPct: number;
  windSpeedKmh: number;
  hazards: HazardRisk[];
  bulletin: string;
}

interface DienBienForecastEntry {
  location: { code: string; name: string; terrain: DienBienLocation['terrain']; elevationM: number };
  source: 'open-meteo' | 'openweathermap';
  fetchedAt: string;
  days: DienBienForecastDay[];
  aiEngineError?: string;
}

/** Lọc theo `?location=`; không truyền -> cả 3 địa điểm; mã không khớp -> null (caller trả 404). */
function resolveDienBienLocations(code?: string): DienBienLocation[] | null {
  if (!code) return DIEN_BIEN_LOCATIONS;
  const found = findLocationByCode(code);
  return found ? [found] : null;
}

/**
 * Lấy dự báo thời tiết + đánh giá rủi ro (rét đậm/rét hại, mưa lớn/lũ quét,
 * sương mù) + bản tin cảnh báo cho các địa điểm được chỉ định — gộp thành
 * MỘT payload duy nhất cho dashboard (tránh phải gọi 2 API rồi tự join).
 * Dùng chung cho GET /api/dienbien-forecast và GET /api/bulletins.
 *
 * Lỗi khi gọi AI Engine cho 1 địa điểm KHÔNG làm hỏng cả response — địa điểm
 * đó trả về với days: [] và aiEngineError set, log lỗi ra console (giữ style
 * try/catch từng phần đã dùng ở /api/stations).
 */
async function buildDienBienForecast(locations: DienBienLocation[]): Promise<DienBienForecastEntry[]> {
  const allWeather = await fetchAllLocationsForecast();
  const weatherByCode = new Map(allWeather.map((w) => [w.locationCode, w]));

  return Promise.all(
    locations.map(async (location) => {
      const entry: DienBienForecastEntry = {
        location: {
          code: location.code,
          name: location.name,
          terrain: location.terrain,
          elevationM: location.elevationM,
        },
        source: 'open-meteo',
        fetchedAt: new Date().toISOString(),
        days: [],
      };

      const weather = weatherByCode.get(location.code);
      if (!weather) {
        console.error(`[API] Không có dữ liệu thời tiết cho địa điểm "${location.code}"`);
        return { ...entry, aiEngineError: 'Không có dữ liệu thời tiết cho địa điểm này' };
      }
      entry.source = weather.source;
      entry.fetchedAt = weather.fetchedAt;

      try {
        const assessed = await assessRisk(location, weather.daily);
        const dailyByDate = new Map(weather.daily.map((d) => [d.date, d] as const));
        entry.days = assessed.days.map((dayAssessment) => {
          const raw = dailyByDate.get(dayAssessment.risk.date);
          if (!raw) {
            throw new Error(
              `AI Engine trả về ngày "${dayAssessment.risk.date}" không khớp dữ liệu thời tiết đã gửi`
            );
          }
          return {
            date: dayAssessment.risk.date,
            tempMinC: raw.tempMinC,
            tempMaxC: raw.tempMaxC,
            precipitationMm: raw.precipitationMm,
            humidityPct: raw.humidityPct,
            windSpeedKmh: raw.windSpeedKmh,
            hazards: dayAssessment.risk.hazards,
            bulletin: dayAssessment.bulletin,
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[AI] /assess-risk failed for "${location.code}":`, message);
        entry.aiEngineError = message;
      }

      return entry;
    })
  );
}

// GET /api/dienbien-forecast?location=<code> - dự báo + đánh giá rủi ro (rét
// đậm/rét hại, mưa lớn/lũ quét, sương mù) + bản tin cảnh báo cho 3 địa điểm
// demo Điện Biên, gộp thời tiết thô + risk + bulletin làm MỘT payload duy
// nhất (tránh dashboard phải gọi 2 API rồi tự join). Không có `location` ->
// trả cả 3 địa điểm; có -> lọc theo mã, 404 nếu không khớp.
app.get('/api/dienbien-forecast', async (req: Request, res: Response) => {
  const parsed = dienbienForecastQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
  }

  const locations = resolveDienBienLocations(parsed.data.location);
  if (locations === null) {
    return res.status(404).json({ error: `Location "${parsed.data.location}" not found` });
  }

  try {
    const result = await buildDienBienForecast(locations);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/dienbien-forecast failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Thứ tự nguy hiểm giảm dần — dùng để sắp xếp /api/bulletins (đỏ trước tiên).
const DIENBIEN_ALERT_SEVERITY: Record<'green' | 'yellow' | 'orange' | 'red', number> = {
  red: 3,
  orange: 2,
  yellow: 1,
  green: 0,
};

// GET /api/bulletins?location=<code>&activeOnly=true - danh sách bản tin đã
// "làm phẳng" (1 dòng / hiểm hoạ / ngày), dùng cho kênh cảnh báo SMS/Zalo/loa
// sau này. Tái dùng buildDienBienForecast(). activeOnly mặc định true: chỉ
// trả các dòng KHÔNG phải 'green' ("cảnh báo đang hoạt động"); false thì trả
// hết. Sắp xếp: alertLevel nguy hiểm nhất trước, rồi theo ngày tăng dần.
app.get('/api/bulletins', async (req: Request, res: Response) => {
  const parsed = bulletinsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
  }

  const locations = resolveDienBienLocations(parsed.data.location);
  if (locations === null) {
    return res.status(404).json({ error: `Location "${parsed.data.location}" not found` });
  }
  const activeOnly = parsed.data.activeOnly !== 'false';

  try {
    const forecast = await buildDienBienForecast(locations);
    const flattened = forecast.flatMap((entry) =>
      entry.days.flatMap((day) =>
        day.hazards
          .filter((h) => !activeOnly || h.alert_level !== 'green')
          .map((h) => ({
            locationCode: entry.location.code,
            locationName: entry.location.name,
            date: day.date,
            hazard: h.hazard,
            alertLevel: h.alert_level,
            bulletin: day.bulletin,
          }))
      )
    );

    flattened.sort((a, b) => {
      const severityDiff = DIENBIEN_ALERT_SEVERITY[b.alertLevel] - DIENBIEN_ALERT_SEVERITY[a.alertLevel];
      if (severityDiff !== 0) return severityDiff;
      return Date.parse(a.date) - Date.parse(b.date);
    });

    res.json(flattened);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/bulletins failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Duy nhất địa điểm NCHMF có trang dự báo (cấp tỉnh lỵ) — xem nchmf-reference.ts. */
const NCHMF_LOCATION_CODE = 'dbp';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

interface DienBienForecastValidationDay {
  date: string;
  openMeteo: { tempMinC: number; tempMaxC: number };
  nchmf: { tempMinC: number; tempMaxC: number };
  deltaMaxC: number;
  deltaMinC: number;
}

/** Gộp dự báo NCHMF (hôm nay + 10 ngày tới) thành 1 map tra theo ngày YYYY-MM-DD. */
function nchmfByDate(nchmf: NchmfReference): Map<string, { tempMinC: number; tempMaxC: number }> {
  const map = new Map<string, { tempMinC: number; tempMaxC: number }>();
  map.set(nchmf.today.date, { tempMinC: nchmf.today.tempMinC, tempMaxC: nchmf.today.tempMaxC });
  for (const day of nchmf.tenDayForecast) {
    map.set(day.date, { tempMinC: day.tempMinC, tempMaxC: day.tempMaxC });
  }
  return map;
}

// GET /api/dienbien-forecast-validation - đối chiếu dự báo Open-Meteo với dự
// báo chính thức NCHMF (trang Mường Thanh) cho địa điểm 'dbp' — lớp VALIDATION
// (so sánh nhiệt độ min/max từng ngày), KHÔNG thay thế dữ liệu Open-Meteo dùng
// ở nơi khác. NCHMF chỉ có trang cấp tỉnh lỵ nên endpoint này CHỈ áp dụng cho
// 'dbp' (xem giới hạn trong nchmf-reference.ts). Nếu NCHMF lỗi/timeout/đổi cấu
// trúc trang: vẫn trả 200 kèm nchmfAvailable=false thay vì làm hỏng cả
// response — lớp đối chiếu là phụ, không phải nguồn dữ liệu chính.
app.get('/api/dienbien-forecast-validation', async (_req: Request, res: Response) => {
  try {
    const location = findLocationByCode(NCHMF_LOCATION_CODE);
    if (!location) {
      throw new Error(`Location "${NCHMF_LOCATION_CODE}" không có trong DIEN_BIEN_LOCATIONS`);
    }
    const openMeteo = await fetchLocationForecast(location);

    let nchmf: NchmfReference | undefined;
    try {
      nchmf = await fetchNchmfReference();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[API] /api/dienbien-forecast-validation: NCHMF không khả dụng:', message);
    }

    if (!nchmf) {
      res.json({ locationCode: NCHMF_LOCATION_CODE, nchmfAvailable: false, days: [] });
      return;
    }

    const refByDate = nchmfByDate(nchmf);
    const days: DienBienForecastValidationDay[] = openMeteo.daily.flatMap((d) => {
      const ref = refByDate.get(d.date);
      if (!ref) return [];
      return [
        {
          date: d.date,
          openMeteo: { tempMinC: d.tempMinC, tempMaxC: d.tempMaxC },
          nchmf: ref,
          deltaMaxC: round1(d.tempMaxC - ref.tempMaxC),
          deltaMinC: round1(d.tempMinC - ref.tempMinC),
        },
      ];
    });

    res.json({
      locationCode: NCHMF_LOCATION_CODE,
      nchmfAvailable: true,
      nchmfUpdatedAt: nchmf.currentUpdatedAt,
      days,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/dienbien-forecast-validation failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhook/stringee - answer_url cho Stringee Call API, trả về SCCO đọc cảnh báo.
app.get('/api/webhook/stringee', (_req: Request, res: Response) => {
  res.status(200).json([
    {
      action: 'talk',
      text: 'Cảnh báo khẩn cấp từ hệ thống ForestGump. Phát hiện độ mặn vượt mức an toàn. Đề nghị đóng cống ngăn mặn ngay lập tức.',
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

// GET /api/satellite/health - trạng thái Satellite Engine (module ảnh vệ tinh)
app.get('/api/satellite/health', async (_req: Request, res: Response) => {
  try {
    const health = await checkSatelliteHealth();
    res.json(health);
  } catch (err) {
    if (err instanceof SatelliteEngineUnavailableError) {
      return res.status(503).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/satellite/health failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/satellite/predict - nhận GeoTIFF (multipart/form-data, field "file"),
// forward nguyên trạng sang Satellite Engine POST /predict, trả job_id/mask_path.
app.post(
  '/api/satellite/predict',
  express.raw({ type: 'multipart/form-data', limit: '200mb' }),
  async (req: Request, res: Response) => {
    const contentType = req.headers['content-type'];
    if (!contentType || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'Missing multipart/form-data body (field "file")' });
    }

    try {
      const result = await forwardSatellitePredict(req.body, contentType);
      res.json(result);
    } catch (err) {
      if (err instanceof SatelliteEngineUnavailableError) {
        return res.status(503).json({ error: err.message });
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error('[API] /api/satellite/predict failed:', message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

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
