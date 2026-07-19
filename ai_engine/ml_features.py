"""Feature engineering dùng CHUNG cho huấn luyện (train_xgb.py) và suy luận
(ml_engine.py) — 2 nơi PHẢI dùng đúng 1 hàm build_features() để vector đặc
trưng không lệch nhau giữa lúc train và lúc predict.

Đặc trưng được tính SAU khi đã hiệu chỉnh nhiệt độ theo cao độ
(downscale.downscale_temperature) — tức model học trên nhiệt độ tại độ cao
thực tế của địa điểm, giống pipeline rule engine cũ (risk_engine.compute_risk).
"""

from __future__ import annotations

import math

from risk_engine import ForecastInput, Terrain

# Thứ tự cột PHẢI cố định — model XGBoost đã train gắn chặt với thứ tự này.
# Đổi/thêm cột thì PHẢI train lại model (chạy lại train_xgb.py).
# Các cột tổng hợp từ hourly Open-Meteo (visibility_min_m, dew_spread_min_c,
# humidity_max_pct, rain_1h_mm, wind_gusts_kmh, soil_moisture_0_1) = NaN khi
# nguồn dự phòng OpenWeatherMap không cung cấp — XGBoost xử lý missing tự nhiên.
FEATURE_NAMES: list[str] = [
    "temp_min_c",
    "temp_max_c",
    "avg_temp_c",
    "precipitation_mm",
    "rain_12h_mm",
    "rain_1h_mm",
    "humidity_pct",
    "humidity_max_pct",
    "dew_point_c",
    "dew_spread_c",  # chênh nhiệt TB - điểm sương (trung bình ngày)
    "dew_spread_min_c",  # chênh nhỏ nhất trong ngày (đêm/rạng sáng) — tín hiệu sương mù mạnh nhất
    "visibility_min_m",  # tầm nhìn thấp nhất trong ngày — tín hiệu trực tiếp của sương mù
    "wind_speed_kmh",
    "wind_gusts_kmh",
    "soil_moisture_0_1",
    "cape_max_jkg",  # năng lượng đối lưu — tín hiệu chính của mưa đá
    "freezing_level_min_m",  # mực đóng băng thấp nhất — đá dễ rơi tới đất khi thấp
    "showers_sum_mm",  # mưa đối lưu — gate bằng chứng giông cho mưa đá
    "soil_moisture_9_to_27cm",  # độ ẩm đất tầng rễ — tín hiệu bão hoà cho sạt lở
    "rain_3d_mm",  # mưa tích luỹ 3 ngày — tín hiệu chính của sạt lở
    "terrain_thung_lung",
    "terrain_nui_cao",
    "terrain_ven_suoi",
]


def _opt(value: float | None) -> float:
    return value if value is not None else math.nan


def build_features(forecast: ForecastInput, terrain: Terrain) -> list[float]:
    """Chuyển dự báo 1 ngày (ĐÃ hiệu chỉnh nhiệt độ theo cao độ) thành vector
    đặc trưng theo đúng thứ tự FEATURE_NAMES.

    Args:
        forecast: dự báo 1 ngày với temp_min_c/temp_max_c đã downscale về độ
            cao thực tế của địa điểm.
        terrain: loại địa hình (khớp Terrain trong locations.ts).

    Returns:
        Vector float cùng độ dài với FEATURE_NAMES; trường thiếu = NaN.
    """
    avg_temp_c = (forecast.temp_min_c + forecast.temp_max_c) / 2.0
    return [
        forecast.temp_min_c,
        forecast.temp_max_c,
        avg_temp_c,
        forecast.precipitation_mm,
        _opt(forecast.rain_12h_mm),
        _opt(forecast.rain_1h_mm),
        forecast.humidity_pct,
        _opt(forecast.humidity_max_pct),
        forecast.dew_point_c,
        avg_temp_c - forecast.dew_point_c,
        _opt(forecast.dew_spread_min_c),
        _opt(forecast.visibility_min_m),
        forecast.wind_speed_kmh,
        _opt(forecast.wind_gusts_kmh),
        _opt(forecast.soil_moisture_0_1),
        _opt(forecast.cape_max_jkg),
        _opt(forecast.freezing_level_min_m),
        _opt(forecast.showers_sum_mm),
        _opt(forecast.soil_moisture_9_to_27cm),
        _opt(forecast.rain_3d_mm),
        1.0 if terrain == "thung_lung" else 0.0,
        1.0 if terrain == "nui_cao" else 0.0,
        1.0 if terrain == "ven_suoi" else 0.0,
    ]
