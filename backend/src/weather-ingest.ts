// Ingest dữ liệu dự báo thời tiết 7 ngày cho 3 địa điểm demo Điện Biên từ
// Open-Meteo (nguồn chính, không cần API key). Nếu Open-Meteo lỗi/timeout,
// tự động chuyển sang OpenWeatherMap dự phòng (weather-openweathermap.ts).

import 'dotenv/config';
import { DIEN_BIEN_LOCATIONS, type DienBienLocation } from './config/locations.js';
import { openMeteoForecastSchema } from './schemas.js';
import { fetchOpenWeatherMapForecast } from './weather-openweathermap.js';
import { maxPerDay, meanPerDay, minPerDay, rollingSum } from './weather-aggregate.js';
import type { DailyForecast, LocationWeather } from './weather-types.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 7;
// Số ngày quá khứ lấy thêm để tính mưa tích luỹ 3 ngày cho sạt lở đất — KHÔNG
// dùng để trả về cho dashboard (bị cắt bỏ khi build `days`, xem `fetchOpenMeteoForecast`).
const PAST_DAYS = 3;
const RAIN_ROLLING_WINDOW_DAYS = 3;
const TIMEZONE = 'Asia/Bangkok'; // UTC+7, khớp giờ Việt Nam
const FETCH_TIMEOUT_MS = Number(process.env.WEATHER_FETCH_TIMEOUT_MS ?? 8000);
// Open-Meteo cập nhật model theo giờ -> cache 1h là đủ tươi, tránh gọi API
// lặp lại mỗi request dashboard (pipeline pull-based, không có DB).
const WEATHER_CACHE_TTL_MS = Number(process.env.WEATHER_CACHE_TTL_MS ?? 3_600_000);

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'relative_humidity_2m_mean',
  'dew_point_2m_mean',
  'wind_speed_10m_mean',
  'rain_sum',
  'showers_sum',
].join(',');

// Dữ liệu HOURLY — nguồn tín hiệu chính cho các hiểm hoạ mà daily không có:
//  - precipitation: tính mưa 12h trượt (ngưỡng 50mm/12h) + mưa 1h cực đại
//  - visibility: phân loại sương mù theo tầm nhìn thật (WMO, classify_fog)
//  - temperature/dew_point/humidity: chênh nhiệt-điểm sương nhỏ nhất ban đêm
//  - wind_gusts_10m, soil_moisture_0_to_1cm: đặc trưng bổ sung cho model ML
//  - cape, freezing_level_height, soil_moisture_9_to_27cm: mưa đá + sạt lở đất
//    (không có daily aggregate hợp lệ cho 3 field này trên Open-Meteo — phải
//    gộp về theo ngày ở `fetchOpenMeteoForecast` bên dưới, xem weather-aggregate.ts).
const HOURLY_PARAMS = [
  'precipitation',
  'visibility',
  'temperature_2m',
  'dew_point_2m',
  'relative_humidity_2m',
  'wind_gusts_10m',
  'soil_moisture_0_to_1cm',
  'cape',
  'freezing_level_height',
  'soil_moisture_9_to_27cm',
].join(',');

/** Đọc phần tử mảng an toàn (noUncheckedIndexedAccess) — ném lỗi rõ ràng nếu thiếu. */
function at(arr: number[], index: number, field: string): number {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Thiếu dữ liệu "${field}" tại index ${index} trong phản hồi Open-Meteo`);
  }
  return value;
}

/** Trường tổng hợp theo ngày từ chuỗi hourly (khớp các field optional của DailyForecast). */
type HourlyDayAggregates = Pick<
  DailyForecast,
  | 'rain12hMaxMm'
  | 'rain1hMaxMm'
  | 'visibilityMinM'
  | 'dewSpreadMinC'
  | 'humidityMaxPct'
  | 'windGustsMaxKmh'
  | 'soilMoisture01'
>;

type OpenMeteoHourly = {
  time: string[];
  precipitation: (number | null)[];
  visibility: (number | null)[];
  temperature_2m: (number | null)[];
  dew_point_2m: (number | null)[];
  relative_humidity_2m: (number | null)[];
  wind_gusts_10m: (number | null)[];
  soil_moisture_0_to_1cm: (number | null)[];
};

/**
 * Tổng hợp chuỗi hourly thành các chỉ số theo ngày (key = YYYY-MM-DD giờ địa
 * phương). Mưa 12h dùng CỬA SỔ TRƯỢT qua cả ranh giới ngày (mưa 21h hôm trước
 * → 9h hôm nay vẫn phải bắt được ngưỡng 50mm/12h); giá trị gán cho ngày chứa
 * GIỜ KẾT THÚC của cửa sổ. Giờ null (ngoài phạm vi model) bị bỏ qua.
 */
function aggregateHourlyByDay(hourly: OpenMeteoHourly): Map<string, HourlyDayAggregates> {
  interface DayAccumulator {
    rain12hMax: number;
    rain1hMax: number;
    visibilityMin: number;
    dewSpreadMin: number;
    humidityMax: number;
    gustsMax: number;
    soilSum: number;
    soilCount: number;
  }
  const byDay = new Map<string, DayAccumulator>();
  // Tổng mưa 12 giờ gần nhất tính đến giờ i (null coi như 0mm).
  let rolling12h = 0;
  const window: number[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i]?.slice(0, 10);
    if (!day) continue;
    let acc = byDay.get(day);
    if (!acc) {
      acc = {
        rain12hMax: 0,
        rain1hMax: 0,
        visibilityMin: Infinity,
        dewSpreadMin: Infinity,
        humidityMax: -Infinity,
        gustsMax: -Infinity,
        soilSum: 0,
        soilCount: 0,
      };
      byDay.set(day, acc);
    }

    const rain = hourly.precipitation[i] ?? 0;
    window.push(rain);
    rolling12h += rain;
    if (window.length > 12) rolling12h -= window.shift() ?? 0;
    acc.rain12hMax = Math.max(acc.rain12hMax, rolling12h);
    acc.rain1hMax = Math.max(acc.rain1hMax, rain);

    const visibility = hourly.visibility[i];
    if (visibility != null) acc.visibilityMin = Math.min(acc.visibilityMin, visibility);

    const temp = hourly.temperature_2m[i];
    const dewPoint = hourly.dew_point_2m[i];
    if (temp != null && dewPoint != null) {
      acc.dewSpreadMin = Math.min(acc.dewSpreadMin, temp - dewPoint);
    }

    const humidity = hourly.relative_humidity_2m[i];
    if (humidity != null) acc.humidityMax = Math.max(acc.humidityMax, humidity);

    const gusts = hourly.wind_gusts_10m[i];
    if (gusts != null) acc.gustsMax = Math.max(acc.gustsMax, gusts);

    const soil = hourly.soil_moisture_0_to_1cm[i];
    if (soil != null) {
      acc.soilSum += soil;
      acc.soilCount += 1;
    }
  }

  const round1 = (v: number): number => Math.round(v * 10) / 10;
  const result = new Map<string, HourlyDayAggregates>();
  for (const [day, acc] of byDay) {
    // Spread có điều kiện: bỏ hẳn field khi cả ngày không có giờ nào hợp lệ
    // (project bật exactOptionalPropertyTypes — không gán undefined tường minh).
    result.set(day, {
      rain12hMaxMm: round1(acc.rain12hMax),
      rain1hMaxMm: round1(acc.rain1hMax),
      ...(Number.isFinite(acc.visibilityMin) && { visibilityMinM: round1(acc.visibilityMin) }),
      ...(Number.isFinite(acc.dewSpreadMin) && {
        dewSpreadMinC: round1(Math.max(0, acc.dewSpreadMin)),
      }),
      ...(Number.isFinite(acc.humidityMax) && { humidityMaxPct: round1(acc.humidityMax) }),
      ...(Number.isFinite(acc.gustsMax) && { windGustsMaxKmh: round1(acc.gustsMax) }),
      ...(acc.soilCount > 0 && {
        soilMoisture01: Math.round((acc.soilSum / acc.soilCount) * 1000) / 1000,
      }),
    });
  }
  return result;
}

/** Gọi trực tiếp Open-Meteo cho 1 địa điểm. Ném lỗi nếu timeout/HTTP lỗi/sai định dạng. */
export async function fetchOpenMeteoForecast(location: DienBienLocation): Promise<LocationWeather> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(location.lat));
  url.searchParams.set('longitude', String(location.lon));
  url.searchParams.set('current', 'temperature_2m');
  url.searchParams.set('daily', DAILY_PARAMS);
  url.searchParams.set('hourly', HOURLY_PARAMS);
  url.searchParams.set('timezone', TIMEZONE);
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));
  url.searchParams.set('past_days', String(PAST_DAYS));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo trả về status ${res.status} cho "${location.code}"`);
    }

    const parsed = openMeteoForecastSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(
        `Sai định dạng phản hồi Open-Meteo cho "${location.code}": ${parsed.error.issues[0]?.message}`
      );
    }
    const { current, daily, hourly, elevation } = parsed.data;
    const hourlyByDay = aggregateHourlyByDay(hourly);

    // `daily`/`hourly` chứa thêm PAST_DAYS ngày quá khứ đứng TRƯỚC phần dự báo (đã
    // verify offset bằng gọi API thật) — dùng để tính mưa tích luỹ 3 ngày cho sạt
    // lở đất, nhưng KHÔNG trả các ngày quá khứ đó ra ngoài cho dashboard.
    const capeMaxByDate = maxPerDay(hourly.time, hourly.cape);
    const freezingLevelMinByDate = minPerDay(hourly.time, hourly.freezing_level_height);
    const soilMoistureMeanByDate = meanPerDay(hourly.time, hourly.soil_moisture_9_to_27cm);

    const days: DailyForecast[] = daily.time.slice(PAST_DAYS).map((date, sliceIndex) => {
      const i = sliceIndex + PAST_DAYS;
      return {
        date,
        tempMinC: at(daily.temperature_2m_min, i, 'temperature_2m_min'),
        tempMaxC: at(daily.temperature_2m_max, i, 'temperature_2m_max'),
        precipitationMm: at(daily.precipitation_sum, i, 'precipitation_sum'),
        humidityPct: at(daily.relative_humidity_2m_mean, i, 'relative_humidity_2m_mean'),
        dewPointC: at(daily.dew_point_2m_mean, i, 'dew_point_2m_mean'),
        windSpeedKmh: at(daily.wind_speed_10m_mean, i, 'wind_speed_10m_mean'),
        ...hourlyByDay.get(date),
        capeMaxJkg: capeMaxByDate.get(date),
        freezingLevelMinM: freezingLevelMinByDate.get(date),
        soilMoisture9to27cm: soilMoistureMeanByDate.get(date),
        showersSumMm: at(daily.showers_sum, i, 'showers_sum'),
        rain3dSumMm: rollingSum(daily.rain_sum, i, RAIN_ROLLING_WINDOW_DAYS),
      };
    });

    return {
      locationCode: location.code,
      currentTempC: current.temperature_2m,
      fetchedAt: new Date().toISOString(),
      daily: days,
      source: 'open-meteo',
      ...(elevation !== undefined && { elevationGridM: elevation }),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Cache in-memory theo địa điểm — Open-Meteo cập nhật theo giờ nên giữ 1h
// (WEATHER_CACHE_TTL_MS) là vừa đủ tươi; đặt TTL=0 để tắt khi debug.
const weatherCache = new Map<string, { expiresAt: number; data: LocationWeather }>();

/**
 * Lấy dự báo cho 1 địa điểm: ưu tiên Open-Meteo; nếu lỗi hoặc timeout (>
 * WEATHER_FETCH_TIMEOUT_MS) thì tự động chuyển sang OpenWeatherMap dự phòng.
 * Log rõ mỗi lần fallback được kích hoạt để dễ theo dõi nguồn dữ liệu thực tế.
 */
export async function fetchLocationForecast(location: DienBienLocation): Promise<LocationWeather> {
  const cached = weatherCache.get(location.code);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  try {
    const fresh = await fetchOpenMeteoForecast(location);
    if (WEATHER_CACHE_TTL_MS > 0) {
      weatherCache.set(location.code, { expiresAt: Date.now() + WEATHER_CACHE_TTL_MS, data: fresh });
    }
    return fresh;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[WEATHER] Open-Meteo lỗi/timeout cho "${location.code}": ${message} — chuyển sang OpenWeatherMap dự phòng`
    );
    try {
      const fallback = await fetchOpenWeatherMapForecast(location);
      console.log(`[WEATHER] Đã lấy dữ liệu dự phòng OpenWeatherMap cho "${location.code}"`);
      return fallback;
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.error(
        `[WEATHER] OpenWeatherMap dự phòng cũng lỗi cho "${location.code}":`,
        fallbackMessage
      );
      throw fallbackErr;
    }
  }
}

/**
 * Lấy dự báo cho cả 3 địa điểm demo (song song) — dùng cho
 * GET /api/weather-raw và làm đầu vào cho buildDienBienForecast(). Pipeline
 * MVP không có bước lưu DB (tính on-the-fly mỗi request, xem docs/architecture.md).
 *
 * Lỗi (Open-Meteo + fallback OpenWeatherMap đều lỗi) cho 1 địa điểm KHÔNG làm
 * hỏng cả response — địa điểm đó bị bỏ qua (đã log lỗi trong
 * fetchLocationForecast), các địa điểm còn lại vẫn trả về bình thường. Khớp
 * nguyên tắc cách ly lỗi đã áp dụng cho tầng AI Engine (xem buildDienBienForecast).
 */
export async function fetchAllLocationsForecast(): Promise<LocationWeather[]> {
  const results = await Promise.allSettled(
    DIEN_BIEN_LOCATIONS.map((location) => fetchLocationForecast(location))
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}
