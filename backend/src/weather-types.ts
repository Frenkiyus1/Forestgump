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
  // Các trường dưới đây tổng hợp từ dữ liệu HOURLY của Open-Meteo — optional
  // vì nguồn dự phòng OpenWeatherMap không cung cấp (AI Engine coi thiếu = None).
  /** Lượng mưa 12h liên tiếp lớn nhất kết thúc trong ngày (cửa sổ trượt qua đêm). */
  rain12hMaxMm?: number;
  /** Lượng mưa 1 giờ lớn nhất trong ngày. */
  rain1hMaxMm?: number;
  /** Tầm nhìn xa thấp nhất trong ngày (m) — tín hiệu trực tiếp cho sương mù. */
  visibilityMinM?: number;
  /** Chênh nhiệt độ - điểm sương nhỏ nhất trong ngày (°C) — sát 0 = gần bão hoà. */
  dewSpreadMinC?: number;
  /** Độ ẩm tương đối cao nhất trong ngày (%). */
  humidityMaxPct?: number;
  /** Gió giật 10m mạnh nhất trong ngày (km/h). */
  windGustsMaxKmh?: number;
  /** Độ ẩm đất lớp 0-1cm trung bình ngày (m³/m³) — độ no nước trước mưa. */
  soilMoisture01?: number;
  // 5 field dưới đây dùng cho hiểm hoạ mưa đá/sạt lở đất — CHỈ có khi nguồn là
  // Open-Meteo. OpenWeatherMap (dự phòng) không có CAPE/mực đóng băng/độ ẩm đất
  // nên các field này sẽ là `undefined`, khiến ai_engine coi 2 hiểm hoạ đó là
  // "chưa đánh giá được" thay vì bịa số liệu.
  /** CAPE lớn nhất trong ngày (J/kg) — dùng cho mưa đá. */
  capeMaxJkg?: number | undefined;
  /** Mực đóng băng (0°C) thấp nhất trong ngày (m) — dùng cho mưa đá. */
  freezingLevelMinM?: number | undefined;
  /** Độ ẩm đất tầng 9-27cm, trung bình ngày (m³/m³) — dùng cho sạt lở đất. */
  soilMoisture9to27cm?: number | undefined;
  /** Mưa đối lưu (showers) trong ngày (mm) — cổng xác nhận có đối lưu cho mưa đá. */
  showersSumMm?: number | undefined;
  /** Tổng mưa 3 ngày gần nhất tính đến ngày này (mm) — dùng cho sạt lở đất. */
  rain3dSumMm?: number | undefined;
}

/** Dự báo 7 ngày cho 1 địa điểm, kèm nhiệt độ hiện tại và nguồn dữ liệu. */
export interface LocationWeather {
  locationCode: string;
  currentTempC: number;
  /** Thời điểm gọi API, ISO 8601. */
  fetchedAt: string;
  daily: DailyForecast[];
  source: 'open-meteo' | 'openweathermap';
  /** Độ cao ô lưới Open-Meteo dùng để dự báo (m) — cho hiệu chỉnh nhiệt theo cao độ. */
  elevationGridM?: number;
}
