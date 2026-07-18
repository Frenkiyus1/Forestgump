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
FEATURE_NAMES: list[str] = [
    "temp_min_c",
    "temp_max_c",
    "avg_temp_c",
    "precipitation_mm",
    "rain_12h_mm",  # NaN nếu pipeline không cung cấp — XGBoost xử lý missing tự nhiên
    "humidity_pct",
    "dew_point_c",
    "dew_spread_c",  # chênh nhiệt TB - điểm sương, tín hiệu chính của sương mù
    "wind_speed_kmh",
    "terrain_thung_lung",
    "terrain_nui_cao",
    "terrain_ven_suoi",
]


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
        forecast.rain_12h_mm if forecast.rain_12h_mm is not None else math.nan,
        forecast.humidity_pct,
        forecast.dew_point_c,
        avg_temp_c - forecast.dew_point_c,
        forecast.wind_speed_kmh,
        1.0 if terrain == "thung_lung" else 0.0,
        1.0 if terrain == "nui_cao" else 0.0,
        1.0 if terrain == "ven_suoi" else 0.0,
    ]
