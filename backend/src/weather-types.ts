// Kiểu dữ liệu dùng chung giữa weather-ingest.ts, weather-openweathermap.ts và
// api.ts — tách riêng để tránh import vòng.

/** Một ngày dự báo đã chuẩn hoá (nguồn Open-Meteo hoặc OpenWeatherMap). */
export interface DailyForecast {
  /** Ngày dự báo, định dạng YYYY-MM-DD theo giờ địa phương (Asia/Bangkok). */
  date: string;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  humidityPct: number;
  dewPointC: number;
  windSpeedKmh: number;
}

/** Dự báo 7 ngày cho 1 địa điểm, kèm nhiệt độ hiện tại và nguồn dữ liệu. */
export interface LocationWeather {
  locationCode: string;
  currentTempC: number;
  /** Thời điểm gọi API, ISO 8601. */
  fetchedAt: string;
  daily: DailyForecast[];
  source: 'open-meteo' | 'openweathermap';
}
