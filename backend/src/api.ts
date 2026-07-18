import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import {
  dienbienForecastQuerySchema,
  bulletinsQuerySchema,
  mockNotifyQuerySchema,
  chatRequestSchema,
  type HazardRisk,
} from './schemas.js';
import { fetchAllLocationsForecast, fetchLocationForecast } from './weather-ingest.js';
import { DIEN_BIEN_LOCATIONS, findLocationByCode, type DienBienLocation } from './config/locations.js';
import { assessRisk } from './ai-risk-client.js';
import { fetchNchmfReference, type NchmfReference } from './nchmf-reference.js';
import { askGemini, GeminiNotConfiguredError } from './gemini-client.js';

const app = express();

// CORS: chỉ cho phép domain Dashboard đã được duyệt (KHÔNG mở cho mọi origin).
// Domain mặc định của Dashboard luôn được phép; thêm domain khác (vd. staging,
// custom domain) qua biến môi trường CORS_ORIGIN, phân tách bằng dấu phẩy.
const DEFAULT_CORS_ORIGINS = ['https://forestgump.pages.dev'];
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
 * Lấy dự báo thời tiết + đánh giá rủi ro (mưa đá, sạt lở đất, mưa lớn/lũ quét,
 * sương mù) + bản tin cảnh báo cho các địa điểm được chỉ định — gộp thành
 * MỘT payload duy nhất cho dashboard (tránh phải gọi 2 API rồi tự join).
 * Dùng chung cho GET /api/dienbien-forecast, GET /api/bulletins và
 * GET /api/mock-notify.
 *
 * Lỗi khi gọi AI Engine cho 1 địa điểm KHÔNG làm hỏng cả response — địa điểm
 * đó trả về với days: [] và aiEngineError set, log lỗi ra console.
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
        const assessed = await assessRisk(location, weather.daily, weather.elevationGridM);
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

// GET /api/dienbien-forecast?location=<code> - dự báo + đánh giá rủi ro (mưa
// đá, sạt lở đất, mưa lớn/lũ quét, sương mù) + bản tin cảnh báo cho 3 địa điểm
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
// "làm phẳng" (1 dòng / hiểm hoạ / ngày), dùng cho kênh cảnh báo SMS/Zalo/loa.
// Tái dùng buildDienBienForecast(). activeOnly mặc định true: chỉ trả các
// dòng KHÔNG phải 'green' ("cảnh báo đang hoạt động"); false thì trả hết.
// Sắp xếp: alertLevel nguy hiểm nhất trước, rồi theo ngày tăng dần.
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

type NotifyChannel = 'zalo' | 'sms' | 'loa';
const NOTIFY_CHANNELS: NotifyChannel[] = ['zalo', 'sms', 'loa'];

/**
 * Dựng payload MÔ PHỎNG cho 1 kênh cảnh báo — KHÔNG gọi dịch vụ ngoài thật
 * (chưa tích hợp Zalo OA/SMS gateway/loa công cộng thật, xem docs/architecture.md).
 * SMS giới hạn 160 ký tự (chuẩn 1 đoạn SMS); Zalo/loa dùng nguyên văn bản tin.
 */
function buildMockNotifyPayload(
  channel: NotifyChannel,
  location: DienBienForecastEntry['location'],
  day: DienBienForecastDay,
  hazard: HazardRisk
) {
  const base = {
    channel,
    locationCode: location.code,
    locationName: location.name,
    date: day.date,
    hazard: hazard.hazard,
    alertLevel: hazard.alert_level,
  };
  switch (channel) {
    case 'zalo':
      return { ...base, to: `zalo-oa-follower:${location.code}`, message: day.bulletin };
    case 'sms':
      return { ...base, to: `mock-sms:${location.code}`, message: day.bulletin.slice(0, 160) };
    case 'loa':
      return { ...base, to: `loa-cong-cong:${location.code}`, message: day.bulletin, audioMock: true };
  }
}

// GET /api/mock-notify?location=<code>&channel=zalo|sms|loa - mô phỏng payload
// gửi cảnh báo (Zalo OA / SMS / loa công cộng) cho các cảnh báo đang hoạt
// động (khác 'green'). KHÔNG gọi dịch vụ bên ngoài thật — chỉ trả JSON mẫu để
// demo luồng "cảnh báo sinh ra -> kênh nào nhận -> nội dung gì". Không truyền
// `channel` -> trả cả 3 kênh cho mỗi cảnh báo.
app.get('/api/mock-notify', async (req: Request, res: Response) => {
  const parsed = mockNotifyQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' });
  }

  const locations = resolveDienBienLocations(parsed.data.location);
  if (locations === null) {
    return res.status(404).json({ error: `Location "${parsed.data.location}" not found` });
  }
  const channels = parsed.data.channel ? [parsed.data.channel] : NOTIFY_CHANNELS;

  try {
    const forecast = await buildDienBienForecast(locations);
    const payloads = forecast.flatMap((entry) =>
      entry.days.flatMap((day) =>
        day.hazards
          .filter((h) => h.alert_level !== 'green')
          .flatMap((h) => channels.map((channel) => buildMockNotifyPayload(channel, entry.location, day, h)))
      )
    );
    res.json(payloads);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/mock-notify failed:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/chat - hỏi-đáp tự do cho chat widget (Gemini), neo vào dự báo +
// risk THẬT của cả 3 địa điểm demo (tái dùng buildDienBienForecast()) — model
// không được bịa số liệu ngoài dữ liệu truyền vào (xem gemini-client.ts).
// KHÔNG dùng cho bulletin cảnh báo chính thức (xem CLAUDE.md mục 4).
app.post('/api/chat', async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
  }

  try {
    const forecast = await buildDienBienForecast(DIEN_BIEN_LOCATIONS);
    const contextJson = JSON.stringify(
      forecast.map((entry) => ({
        location: entry.location.name,
        code: entry.location.code,
        days: entry.days.map((d) => ({
          date: d.date,
          tempMinC: d.tempMinC,
          tempMaxC: d.tempMaxC,
          precipitationMm: d.precipitationMm,
          hazards: d.hazards,
        })),
        aiEngineError: entry.aiEngineError,
      }))
    );
    const answer = await askGemini(parsed.data.question, contextJson);
    res.json({ answer });
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      res.status(503).json({ error: 'Chat chưa được cấu hình (thiếu GEMINI_API_KEY trên backend)' });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] /api/chat failed:', message);
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

export default app;
