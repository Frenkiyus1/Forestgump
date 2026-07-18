// Ingest dữ liệu dự báo thời tiết 7 ngày cho 3 địa điểm demo Điện Biên từ
// Open-Meteo (nguồn chính, không cần API key). Nếu Open-Meteo lỗi/timeout,
// tự động chuyển sang OpenWeatherMap dự phòng (weather-openweathermap.ts).

import 'dotenv/config';
import { DIEN_BIEN_LOCATIONS, type DienBienLocation } from './config/locations.js';
import { openMeteoForecastSchema } from './schemas.js';
import { fetchOpenWeatherMapForecast } from './weather-openweathermap.js';
import type { DailyForecast, LocationWeather } from './weather-types.js';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 7;
const TIMEZONE = 'Asia/Bangkok'; // UTC+7, khớp giờ Việt Nam
const FETCH_TIMEOUT_MS = Number(process.env.WEATHER_FETCH_TIMEOUT_MS ?? 8000);

const DAILY_PARAMS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_sum',
  'relative_humidity_2m_mean',
  'dew_point_2m_mean',
  'wind_speed_10m_mean',
].join(',');

/** Đọc phần tử mảng an toàn (noUncheckedIndexedAccess) — ném lỗi rõ ràng nếu thiếu. */
function at(arr: number[], index: number, field: string): number {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`Thiếu dữ liệu "${field}" tại index ${index} trong phản hồi Open-Meteo`);
  }
  return value;
}

/** Gọi trực tiếp Open-Meteo cho 1 địa điểm. Ném lỗi nếu timeout/HTTP lỗi/sai định dạng. */
export async function fetchOpenMeteoForecast(location: DienBienLocation): Promise<LocationWeather> {
  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(location.lat));
  url.searchParams.set('longitude', String(location.lon));
  url.searchParams.set('current', 'temperature_2m');
  url.searchParams.set('daily', DAILY_PARAMS);
  url.searchParams.set('timezone', TIMEZONE);
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));

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
    const { current, daily } = parsed.data;

    const days: DailyForecast[] = daily.time.map((date, i) => ({
      date,
      tempMinC: at(daily.temperature_2m_min, i, 'temperature_2m_min'),
      tempMaxC: at(daily.temperature_2m_max, i, 'temperature_2m_max'),
      precipitationMm: at(daily.precipitation_sum, i, 'precipitation_sum'),
      humidityPct: at(daily.relative_humidity_2m_mean, i, 'relative_humidity_2m_mean'),
      dewPointC: at(daily.dew_point_2m_mean, i, 'dew_point_2m_mean'),
      windSpeedKmh: at(daily.wind_speed_10m_mean, i, 'wind_speed_10m_mean'),
    }));

    return {
      locationCode: location.code,
      currentTempC: current.temperature_2m,
      fetchedAt: new Date().toISOString(),
      daily: days,
      source: 'open-meteo',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Lấy dự báo cho 1 địa điểm: ưu tiên Open-Meteo; nếu lỗi hoặc timeout (>
 * WEATHER_FETCH_TIMEOUT_MS) thì tự động chuyển sang OpenWeatherMap dự phòng.
 * Log rõ mỗi lần fallback được kích hoạt để dễ theo dõi nguồn dữ liệu thực tế.
 */
export async function fetchLocationForecast(location: DienBienLocation): Promise<LocationWeather> {
  try {
    return await fetchOpenMeteoForecast(location);
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
 */
export async function fetchAllLocationsForecast(): Promise<LocationWeather[]> {
  return Promise.all(DIEN_BIEN_LOCATIONS.map((location) => fetchLocationForecast(location)));
}
