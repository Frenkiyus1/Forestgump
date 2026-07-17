"""Rule engine tính risk score cho 3 hiểm hoạ Điện Biên (MVP).

Đây là RULE-BASED (if/threshold) dựa thẳng trên ngưỡng đã xác nhận trong
thresholds.py — KHÔNG phải machine learning. Phần ML (xác suất lũ quét) là
optional, xem train_flood.py.

compute_risk() nhận dự báo 1 ngày (khớp bảng weather_forecast / DailyForecast
trong backend/src/weather-types.ts) và thông tin địa điểm (khớp
backend/src/config/locations.ts), trả về risk score 0-100 + alert level riêng
cho từng hiểm hoạ: rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from downscale import downscale_temperature, fog_risk_factor
from thresholds import (
    COLD_DAMP_MAX_C,
    COLD_SEVERE_MAX_C,
    FOG_RISK_FACTOR_RED_MIN,
    FOG_RISK_FACTOR_YELLOW_MIN,
    HEAVY_RAIN_L1_MIN_24H_MM,
    HEAVY_RAIN_L2_MIN_24H_MM,
    HEAVY_RAIN_L3_MIN_24H_MM,
    SCORE_ORANGE_MIN,
    SCORE_RED_MIN,
    SCORE_YELLOW_MIN,
    TERRAIN_FLOOD_MULTIPLIER,
    AlertLevel,
    classify_cold_damage,
    classify_heavy_rain_flood_risk,
)

Terrain = Literal["thung_lung", "nui_cao", "ven_suoi"]
Hazard = Literal["cold_damage", "heavy_rain_flood", "fog"]

_ALERT_LEVEL_ORDER: list[AlertLevel] = ["green", "yellow", "orange", "red"]


class LocationInput(BaseModel):
    """Thông tin địa điểm dùng cho tính risk — khớp backend/src/config/locations.ts."""

    code: str
    name: str
    elevation_m: float
    terrain: Terrain


class ForecastInput(BaseModel):
    """Dự báo 1 ngày — khớp bảng weather_forecast / DailyForecast (weather-types.ts)."""

    date: str
    temp_min_c: float
    temp_max_c: float
    precipitation_mm: float
    humidity_pct: float
    dew_point_c: float
    wind_speed_kmh: float
    # Tuỳ chọn — pipeline Phase 1 hiện CHƯA cung cấp các trường này:
    elevation_grid_m: Optional[float] = None  # độ cao ô lưới Open-Meteo dùng để dự báo
    rain_12h_mm: Optional[float] = None
    rain_1h_mm: Optional[float] = None  # tham khảo — CHƯA có ngưỡng mm/1h chính thức xác minh được


class HazardRisk(BaseModel):
    hazard: Hazard
    alert_level: AlertLevel
    risk_score: float  # 0-100, càng cao càng nguy hiểm
    detail: str


class RiskAssessment(BaseModel):
    location_code: str
    date: str
    hazards: list[HazardRisk]


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _escalate(level: AlertLevel) -> AlertLevel:
    """Nâng 1 cấp cảnh báo (tối đa 'red')."""
    idx = _ALERT_LEVEL_ORDER.index(level)
    return _ALERT_LEVEL_ORDER[min(len(_ALERT_LEVEL_ORDER) - 1, idx + 1)]


def _cold_damage_risk(forecast: ForecastInput) -> HazardRisk:
    avg_temp_c = (forecast.temp_min_c + forecast.temp_max_c) / 2.0
    level = classify_cold_damage(avg_temp_c)

    if level == "red":
        frac = _clamp((COLD_SEVERE_MAX_C - avg_temp_c) / COLD_SEVERE_MAX_C, 0.0, 1.0)
        score = SCORE_RED_MIN + frac * (100.0 - SCORE_RED_MIN)
        detail = f"Nhiệt độ TB {avg_temp_c:.1f}°C <= {COLD_SEVERE_MAX_C:.0f}°C — rét hại."
    elif level == "yellow":
        span = COLD_DAMP_MAX_C - COLD_SEVERE_MAX_C
        frac = _clamp((COLD_DAMP_MAX_C - avg_temp_c) / span, 0.0, 1.0)
        score = SCORE_YELLOW_MIN + frac * (SCORE_ORANGE_MIN - SCORE_YELLOW_MIN)
        detail = (
            f"Nhiệt độ TB {avg_temp_c:.1f}°C trong khoảng rét đậm "
            f"({COLD_SEVERE_MAX_C:.0f}-{COLD_DAMP_MAX_C:.0f}°C)."
        )
    else:
        frac = _clamp((avg_temp_c - COLD_DAMP_MAX_C) / 10.0, 0.0, 1.0)
        score = SCORE_YELLOW_MIN * (1.0 - frac)
        detail = f"Nhiệt độ TB {avg_temp_c:.1f}°C > {COLD_DAMP_MAX_C:.0f}°C — chưa tới ngưỡng rét đậm."

    return HazardRisk(hazard="cold_damage", alert_level=level, risk_score=round(score, 1), detail=detail)


def _heavy_rain_flood_risk(forecast: ForecastInput, terrain: Terrain) -> HazardRisk:
    rain = forecast.precipitation_mm
    base_level = classify_heavy_rain_flood_risk(rain, forecast.rain_12h_mm)

    # Điểm liên tục 0-100 theo mm/24h, neo vào 3 mốc ngưỡng đã xác nhận.
    if rain <= 0:
        raw_score = 0.0
    elif rain < HEAVY_RAIN_L1_MIN_24H_MM:
        raw_score = (rain / HEAVY_RAIN_L1_MIN_24H_MM) * SCORE_YELLOW_MIN
    elif rain <= HEAVY_RAIN_L2_MIN_24H_MM:
        span = HEAVY_RAIN_L2_MIN_24H_MM - HEAVY_RAIN_L1_MIN_24H_MM
        frac = (rain - HEAVY_RAIN_L1_MIN_24H_MM) / span
        raw_score = SCORE_YELLOW_MIN + frac * (SCORE_ORANGE_MIN - SCORE_YELLOW_MIN)
    elif rain <= HEAVY_RAIN_L3_MIN_24H_MM:
        span = HEAVY_RAIN_L3_MIN_24H_MM - HEAVY_RAIN_L2_MIN_24H_MM
        frac = (rain - HEAVY_RAIN_L2_MIN_24H_MM) / span
        raw_score = SCORE_ORANGE_MIN + frac * (SCORE_RED_MIN - SCORE_ORANGE_MIN)
    else:
        frac = _clamp((rain - HEAVY_RAIN_L3_MIN_24H_MM) / HEAVY_RAIN_L3_MIN_24H_MM, 0.0, 1.0)
        raw_score = SCORE_RED_MIN + frac * (100.0 - SCORE_RED_MIN)

    terrain_multiplier = TERRAIN_FLOOD_MULTIPLIER.get(terrain, 1.0)
    adjusted_score = _clamp(raw_score * terrain_multiplier)

    # Địa hình khuếch đại rủi ro đủ để vượt sang band kế tiếp -> nâng tối đa 1
    # cấp (heuristic dự án, xem thresholds.py — KHÔNG phải quy định lũ quét
    # chính thức theo vùng nguy cơ 1-4).
    level = base_level
    if terrain_multiplier > 1.0:
        if base_level == "yellow" and adjusted_score >= SCORE_ORANGE_MIN:
            level = _escalate(base_level)
        elif base_level == "orange" and adjusted_score >= SCORE_RED_MIN:
            level = _escalate(base_level)

    detail = f"Mưa {rain:.0f}mm/24h"
    if forecast.rain_12h_mm is not None:
        detail += f", {forecast.rain_12h_mm:.0f}mm/12h"
    detail += f" tại địa hình '{terrain}' (hệ số x{terrain_multiplier:.1f})."
    if forecast.rain_1h_mm is not None:
        detail += f" Mưa {forecast.rain_1h_mm:.0f}mm/1h (tham khảo, chưa dùng để tính cấp)."

    return HazardRisk(
        hazard="heavy_rain_flood", alert_level=level, risk_score=round(adjusted_score, 1), detail=detail
    )


def _fog_risk(forecast: ForecastInput, terrain: Terrain) -> HazardRisk:
    avg_temp_c = (forecast.temp_min_c + forecast.temp_max_c) / 2.0
    factor = fog_risk_factor(forecast.humidity_pct, avg_temp_c, forecast.dew_point_c, terrain)

    if factor >= FOG_RISK_FACTOR_RED_MIN:
        level: AlertLevel = "red"
    elif factor >= FOG_RISK_FACTOR_YELLOW_MIN:
        level = "yellow"
    else:
        level = "green"

    score = _clamp(factor * 100.0)
    detail = (
        f"Hệ số nguy cơ sương mù {factor:.2f} (độ ẩm {forecast.humidity_pct:.0f}%, "
        f"chênh nhiệt-điểm sương {avg_temp_c - forecast.dew_point_c:.1f}°C, địa hình '{terrain}') "
        "— ước tính, KHÔNG dựa trên tầm nhìn đo thực tế."
    )
    return HazardRisk(hazard="fog", alert_level=level, risk_score=round(score, 1), detail=detail)


def compute_risk(location: LocationInput, forecast: ForecastInput) -> RiskAssessment:
    """Đánh giá rủi ro 3 hiểm hoạ cho 1 ngày dự báo tại 1 địa điểm.

    Hiệu chỉnh nhiệt độ theo cao độ thực tế (downscale_temperature) trước khi
    phân loại rét đậm/rét hại và tính hệ số sương mù. Nếu forecast không kèm
    elevation_grid_m (Phase 1 hiện chưa cung cấp), coi độ cao ô lưới = độ cao
    thực tế của địa điểm -> không hiệu chỉnh (delta = 0), tránh bịa số liệu.
    """
    elevation_grid = (
        forecast.elevation_grid_m if forecast.elevation_grid_m is not None else location.elevation_m
    )
    corrected = forecast.model_copy(
        update={
            "temp_min_c": downscale_temperature(forecast.temp_min_c, elevation_grid, location.elevation_m),
            "temp_max_c": downscale_temperature(forecast.temp_max_c, elevation_grid, location.elevation_m),
        }
    )

    hazards = [
        _cold_damage_risk(corrected),
        _heavy_rain_flood_risk(forecast, location.terrain),  # mưa không hiệu chỉnh theo cao độ
        _fog_risk(corrected, location.terrain),
    ]
    return RiskAssessment(location_code=location.code, date=forecast.date, hazards=hazards)
