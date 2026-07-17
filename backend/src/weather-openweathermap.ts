// Nguồn dự phòng/đối chiếu khi Open-Meteo lỗi hoặc timeout. Dùng endpoint
// miễn phí "5 day / 3 hour forecast" của OpenWeatherMap (chỉ phủ ~5 ngày,
// không đủ 7 ngày như Open-Meteo — chấp nhận được vì đây là NGUỒN DỰ PHÒNG,
// không phải nguồn chính).
//
// Free tier không trả sẵn điểm sương (dew point) như Open-Meteo, nên tính
// xấp xỉ bằng công thức Magnus (August-Roche-Magnus) — công thức vật lý phổ
// biến, sai số ~0.4°C trong dải nhiệt độ/độ ẩm thường gặp, KHÔNG phải số
// liệu bịa đặt.

import 'dotenv/config';
import { openWeatherMapForecastSchema } from './schemas.js';
import type { DienBienLocation } from './config/locations.js';
import type { DailyForecast, LocationWeather } from './weather-types.js';

const OPENWEATHERMAP_URL = 'https://api.openweathermap.org/data/2.5/forecast';

export class OpenWeatherMapUnavailableError extends Error {}

/** Xấp xỉ điểm sương (°C) từ nhiệt độ (°C) và độ ẩm tương đối (%) — công thức Magnus. */
function approximateDewPoint(tempC: number, humidityPct: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidityPct / 100);
  return (b * alpha) / (a - alpha);
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Gọi OpenWeatherMap, gộp các mốc 3 giờ thành dự báo theo ngày (giờ địa phương UTC+7). */
export async function fetchOpenWeatherMapForecast(
  location: DienBienLocation
): Promise<LocationWeather> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    throw new OpenWeatherMapUnavailableError(
      'Thiếu OPENWEATHERMAP_API_KEY trong .env — không thể gọi nguồn dự phòng'
    );
  }

  const url = new URL(OPENWEATHERMAP_URL);
  url.searchParams.set('lat', String(location.lat));
  url.searchParams.set('lon', String(location.lon));
  url.searchParams.set('appid', apiKey);
  url.searchParams.set('units', 'metric');

  const res = await fetch(url);
  if (!res.ok) {
    throw new OpenWeatherMapUnavailableError(
      `OpenWeatherMap trả về status ${res.status} cho "${location.code}"`
    );
  }

  const parsed = openWeatherMapForecastSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new OpenWeatherMapUnavailableError(
      `Sai định dạng phản hồi OpenWeatherMap cho "${location.code}": ${parsed.error.issues[0]?.message}`
    );
  }

  interface DayBucket {
    temps: number[];
    humidities: number[];
    precipitationMm: number;
    windSpeedsMs: number[];
  }
  const byDate = new Map<string, DayBucket>();

  for (const entry of parsed.data.list) {
    const date = entry.dt_txt.slice(0, 10);
    const bucket = byDate.get(date) ?? {
      temps: [],
      humidities: [],
      precipitationMm: 0,
      windSpeedsMs: [],
    };
    bucket.temps.push(entry.main.temp);
    bucket.humidities.push(entry.main.humidity);
    bucket.precipitationMm += entry.rain?.['3h'] ?? 0;
    bucket.windSpeedsMs.push(entry.wind.speed);
    byDate.set(date, bucket);
  }

  const daily: DailyForecast[] = [...byDate.entries()].map(([date, bucket]) => {
    const humidityPct = average(bucket.humidities);
    const meanTempC = average(bucket.temps);
    return {
      date,
      tempMinC: round1(Math.min(...bucket.temps)),
      tempMaxC: round1(Math.max(...bucket.temps)),
      precipitationMm: round1(bucket.precipitationMm),
      humidityPct: round1(humidityPct),
      dewPointC: round1(approximateDewPoint(meanTempC, humidityPct)),
      windSpeedKmh: round1(average(bucket.windSpeedsMs) * 3.6),
    };
  });

  const firstDay = daily[0];
  return {
    locationCode: location.code,
    currentTempC: parsed.data.list[0]?.main.temp ?? firstDay?.tempMaxC ?? 0,
    fetchedAt: new Date().toISOString(),
    daily,
    source: 'openweathermap',
  };
}
