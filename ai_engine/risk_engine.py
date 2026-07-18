"""Rule engine tính risk score cho 4 hiểm hoạ Điện Biên (MVP).

Đây là RULE-BASED (if/threshold) dựa thẳng trên ngưỡng đã xác nhận trong
thresholds.py — KHÔNG phải machine learning. Phần ML (xác suất lũ quét) là
optional, xem train_flood.py.

compute_risk() nhận dự báo 1 ngày (khớp bảng weather_forecast / DailyForecast
trong backend/src/weather-types.ts) và thông tin địa điểm (khớp
backend/src/config/locations.ts), trả về risk score 0-100 + alert level riêng
cho từng hiểm hoạ: mưa đá, sạt lở đất, mưa lớn/lũ quét, sương mù dày.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

from downscale import downscale_temperature, fog_risk_factor
from thresholds import (
    DENSE_FOG_MAX_VISIBILITY_M,
    FOG_MAX_VISIBILITY_M,
    FOG_RISK_FACTOR_RED_MIN,
    FOG_RISK_FACTOR_YELLOW_MIN,
    HAIL_CAPE_MODERATE_MIN_JKG,
    HAIL_CAPE_STRONG_MIN_JKG,
    HAIL_CAPE_WEAK_MIN_JKG,
    HAIL_FREEZING_LEVEL_HIGH_RISK_MAX_M,
    HEAVY_RAIN_L1_MIN_24H_MM,
    HEAVY_RAIN_L2_MIN_24H_MM,
    HEAVY_RAIN_L3_MIN_24H_MM,
    LANDSLIDE_RAIN3D_L1_MIN_MM,
    LANDSLIDE_RAIN3D_L2_MIN_MM,
    LANDSLIDE_RAIN3D_L3_MIN_MM,
    LANDSLIDE_TERRAIN_MULTIPLIER,
    SCORE_ORANGE_MIN,
    SCORE_RED_MIN,
    SCORE_YELLOW_MIN,
    TERRAIN_FLOOD_MULTIPLIER,
    AlertLevel,
    classify_fog,
    classify_hail,
    classify_heavy_rain_flood_risk,
    classify_landslide,
)

Terrain = Literal["thung_lung", "nui_cao", "ven_suoi"]
Hazard = Literal["hail", "landslide", "heavy_rain_flood", "fog"]

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
    # Tuỳ chọn — tổng hợp từ dữ liệu HOURLY Open-Meteo (backend/src/weather-ingest.ts,
    # aggregateHourlyByDay). None khi nguồn là OpenWeatherMap dự phòng:
    elevation_grid_m: Optional[float] = None  # độ cao ô lưới Open-Meteo dùng để dự báo
    rain_12h_mm: Optional[float] = None  # mưa 12h trượt lớn nhất trong ngày
    rain_1h_mm: Optional[float] = None  # tham khảo — CHƯA có ngưỡng mm/1h chính thức xác minh được
    visibility_min_m: Optional[float] = None  # tầm nhìn thấp nhất trong ngày — cho classify_fog (WMO)
    dew_spread_min_c: Optional[float] = None  # chênh nhiệt-điểm sương nhỏ nhất trong ngày
    humidity_max_pct: Optional[float] = None  # độ ẩm cao nhất trong ngày
    wind_gusts_kmh: Optional[float] = None  # gió giật mạnh nhất trong ngày
    soil_moisture_0_1: Optional[float] = None  # độ ẩm đất 0-1cm trung bình ngày (m³/m³)
    # Dùng cho mưa đá/sạt lở đất — CHỈ có khi nguồn là Open-Meteo. `None` trên
    # fallback OpenWeatherMap (không có CAPE/mực đóng băng/độ ẩm đất) khiến
    # _hail_risk()/_landslide_risk() trả "chưa đánh giá được" thay vì bịa số liệu.
    cape_max_jkg: Optional[float] = None
    freezing_level_min_m: Optional[float] = None
    soil_moisture_9_to_27cm: Optional[float] = None
    showers_sum_mm: Optional[float] = None
    rain_3d_mm: Optional[float] = None


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


# Khoảng điểm [min, max] của từng band — để kẹp risk_score về đúng band của
# alert_level cuối cùng khi 2 tín hiệu (tầm nhìn/heuristic) cho điểm lệch band.
_LEVEL_SCORE_RANGE: dict[AlertLevel, tuple[float, float]] = {
    "green": (0.0, SCORE_YELLOW_MIN - 0.1),
    "yellow": (SCORE_YELLOW_MIN, SCORE_ORANGE_MIN - 0.1),
    "orange": (SCORE_ORANGE_MIN, SCORE_RED_MIN - 0.1),
    "red": (SCORE_RED_MIN, 100.0),
}


def _clamp_score_to_level(score: float, level: AlertLevel) -> float:
    lo, hi = _LEVEL_SCORE_RANGE[level]
    return _clamp(score, lo, hi)


def _hail_risk(forecast: ForecastInput) -> HazardRisk:
    if (
        forecast.cape_max_jkg is None
        or forecast.freezing_level_min_m is None
        or forecast.showers_sum_mm is None
    ):
        detail = (
            "Thiếu dữ liệu CAPE/mực đóng băng (nguồn dự phòng OpenWeatherMap) — "
            "CHƯA đánh giá được nguy cơ mưa đá, KHÔNG đồng nghĩa an toàn."
        )
        return HazardRisk(hazard="hail", alert_level="green", risk_score=0.0, detail=detail)

    cape = forecast.cape_max_jkg
    freezing_level = forecast.freezing_level_min_m
    showers = forecast.showers_sum_mm
    level = classify_hail(cape, freezing_level, showers)

    # Điểm liên tục 0-100 theo CAPE, neo vào 3 mốc ngưỡng đã định nghĩa.
    if cape <= 0 or showers <= 0:
        raw_score = 0.0
    elif cape < HAIL_CAPE_WEAK_MIN_JKG:
        raw_score = (cape / HAIL_CAPE_WEAK_MIN_JKG) * SCORE_YELLOW_MIN
    elif cape <= HAIL_CAPE_MODERATE_MIN_JKG:
        span = HAIL_CAPE_MODERATE_MIN_JKG - HAIL_CAPE_WEAK_MIN_JKG
        frac = (cape - HAIL_CAPE_WEAK_MIN_JKG) / span
        raw_score = SCORE_YELLOW_MIN + frac * (SCORE_ORANGE_MIN - SCORE_YELLOW_MIN)
    elif cape <= HAIL_CAPE_STRONG_MIN_JKG:
        span = HAIL_CAPE_STRONG_MIN_JKG - HAIL_CAPE_MODERATE_MIN_JKG
        frac = (cape - HAIL_CAPE_MODERATE_MIN_JKG) / span
        raw_score = SCORE_ORANGE_MIN + frac * (SCORE_RED_MIN - SCORE_ORANGE_MIN)
    else:
        frac = _clamp((cape - HAIL_CAPE_STRONG_MIN_JKG) / HAIL_CAPE_STRONG_MIN_JKG, 0.0, 1.0)
        raw_score = SCORE_RED_MIN + frac * (100.0 - SCORE_RED_MIN)

    # Mực đóng băng thấp làm tăng khả năng đá rơi tới đất -> khuếch đại điểm.
    freezing_multiplier = 1.15 if freezing_level <= HAIL_FREEZING_LEVEL_HIGH_RISK_MAX_M else 1.0
    score = _clamp(raw_score * freezing_multiplier)

    detail = (
        f"CAPE {cape:.0f} J/kg, mực đóng băng {freezing_level:.0f}m, mưa đối lưu "
        f"{showers:.0f}mm — proxy heuristic, CHƯA có quy định VN chính thức."
    )
    return HazardRisk(hazard="hail", alert_level=level, risk_score=round(score, 1), detail=detail)


def _landslide_risk(forecast: ForecastInput, terrain: Terrain) -> HazardRisk:
    if forecast.rain_3d_mm is None or forecast.soil_moisture_9_to_27cm is None:
        detail = (
            "Thiếu dữ liệu độ ẩm đất/mưa tích luỹ (nguồn dự phòng OpenWeatherMap) — "
            "CHƯA đánh giá được nguy cơ sạt lở đất, KHÔNG đồng nghĩa an toàn."
        )
        return HazardRisk(hazard="landslide", alert_level="green", risk_score=0.0, detail=detail)

    rain_3d = forecast.rain_3d_mm
    soil_moisture = forecast.soil_moisture_9_to_27cm
    base_level = classify_landslide(rain_3d, soil_moisture)

    # Điểm liên tục 0-100 theo mưa tích luỹ 3 ngày, neo vào 3 mốc ngưỡng đã định nghĩa.
    if rain_3d <= 0:
        raw_score = 0.0
    elif rain_3d < LANDSLIDE_RAIN3D_L1_MIN_MM:
        raw_score = (rain_3d / LANDSLIDE_RAIN3D_L1_MIN_MM) * SCORE_YELLOW_MIN
    elif rain_3d <= LANDSLIDE_RAIN3D_L2_MIN_MM:
        span = LANDSLIDE_RAIN3D_L2_MIN_MM - LANDSLIDE_RAIN3D_L1_MIN_MM
        frac = (rain_3d - LANDSLIDE_RAIN3D_L1_MIN_MM) / span
        raw_score = SCORE_YELLOW_MIN + frac * (SCORE_ORANGE_MIN - SCORE_YELLOW_MIN)
    elif rain_3d <= LANDSLIDE_RAIN3D_L3_MIN_MM:
        span = LANDSLIDE_RAIN3D_L3_MIN_MM - LANDSLIDE_RAIN3D_L2_MIN_MM
        frac = (rain_3d - LANDSLIDE_RAIN3D_L2_MIN_MM) / span
        raw_score = SCORE_ORANGE_MIN + frac * (SCORE_RED_MIN - SCORE_ORANGE_MIN)
    else:
        frac = _clamp((rain_3d - LANDSLIDE_RAIN3D_L3_MIN_MM) / LANDSLIDE_RAIN3D_L3_MIN_MM, 0.0, 1.0)
        raw_score = SCORE_RED_MIN + frac * (100.0 - SCORE_RED_MIN)

    terrain_multiplier = LANDSLIDE_TERRAIN_MULTIPLIER.get(terrain, 1.0)
    adjusted_score = _clamp(raw_score * terrain_multiplier)

    # Địa hình khuếch đại rủi ro đủ để vượt sang band kế tiếp -> nâng tối đa 1 cấp
    # (heuristic dự án, xem thresholds.py).
    level = base_level
    if terrain_multiplier > 1.0:
        if base_level == "yellow" and adjusted_score >= SCORE_ORANGE_MIN:
            level = _escalate(base_level)
        elif base_level == "orange" and adjusted_score >= SCORE_RED_MIN:
            level = _escalate(base_level)

    detail = (
        f"Mưa tích luỹ 3 ngày {rain_3d:.0f}mm, độ ẩm đất {soil_moisture:.2f} m³/m³ "
        f"tại địa hình '{terrain}' (hệ số x{terrain_multiplier:.2f}) — proxy heuristic, "
        "CHƯA có dữ liệu độ dốc/DEM chính thức."
    )
    return HazardRisk(
        hazard="landslide", alert_level=level, risk_score=round(adjusted_score, 1), detail=detail
    )


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


def _fog_visibility_score(visibility_m: float) -> float:
    """Quy đổi tầm nhìn (m) thành điểm 0-100 liên tục, neo vào 2 mốc WMO
    (FOG_MAX_VISIBILITY_M / DENSE_FOG_MAX_VISIBILITY_M) và thang điểm chung
    SCORE_* — cùng cách nội suy tuyến tính như mưa lớn."""
    if visibility_m >= FOG_MAX_VISIBILITY_M:
        # Trên ngưỡng sương mù: giảm dần về 0 khi tầm nhìn tới 5km.
        frac = _clamp((visibility_m - FOG_MAX_VISIBILITY_M) / 4000.0, 0.0, 1.0)
        return SCORE_YELLOW_MIN * (1.0 - frac)
    if visibility_m >= DENSE_FOG_MAX_VISIBILITY_M:
        span = FOG_MAX_VISIBILITY_M - DENSE_FOG_MAX_VISIBILITY_M
        frac = (FOG_MAX_VISIBILITY_M - visibility_m) / span
        return SCORE_YELLOW_MIN + frac * (SCORE_RED_MIN - SCORE_YELLOW_MIN)
    frac = _clamp((DENSE_FOG_MAX_VISIBILITY_M - visibility_m) / DENSE_FOG_MAX_VISIBILITY_M, 0.0, 1.0)
    return SCORE_RED_MIN + frac * (100.0 - SCORE_RED_MIN)


def _fog_risk(forecast: ForecastInput, terrain: Terrain) -> HazardRisk:
    avg_temp_c = (forecast.temp_min_c + forecast.temp_max_c) / 2.0

    # Đầu vào hourly (nếu có) sát vật lý sương mù hơn trung bình ngày: sương mù
    # hình thành lúc ẩm NHẤT / chênh nhiệt-điểm sương NHỎ NHẤT (đêm/rạng sáng).
    spread_c = (
        forecast.dew_spread_min_c
        if forecast.dew_spread_min_c is not None
        else avg_temp_c - forecast.dew_point_c
    )
    humidity = (
        forecast.humidity_max_pct if forecast.humidity_max_pct is not None else forecast.humidity_pct
    )
    factor = fog_risk_factor(humidity, avg_temp_c, avg_temp_c - spread_c, terrain)

    if factor >= FOG_RISK_FACTOR_RED_MIN:
        factor_level: AlertLevel = "red"
    elif factor >= FOG_RISK_FACTOR_YELLOW_MIN:
        factor_level = "yellow"
    else:
        factor_level = "green"
    factor_score = _clamp(factor * 100.0)

    if forecast.visibility_min_m is not None:
        # Có tầm nhìn dự báo (hourly Open-Meteo) -> phân loại WMO chính thức
        # (classify_fog) là TÍN HIỆU CHÍNH. Hệ số heuristic chỉ được NÂNG TỐI
        # ĐA 1 CẤP (cùng nguyên tắc với hệ số địa hình của lũ quét) — vì đêm
        # mùa ẩm nhiệt đới gần như luôn bão hoà (ẩm ~98%, chênh nhiệt-điểm
        # sương ~0), nếu cho heuristic quyền kéo thẳng lên đỏ sẽ báo động giả
        # quanh năm dù model dự báo trời quang.
        vis_level = classify_fog(forecast.visibility_min_m)
        vis_score = _fog_visibility_score(forecast.visibility_min_m)
        escalated = _ALERT_LEVEL_ORDER.index(factor_level) > _ALERT_LEVEL_ORDER.index(vis_level)
        level = _escalate(vis_level) if escalated else vis_level
        score = max(vis_score, factor_score if escalated else 0.0)
        detail = (
            f"Tầm nhìn dự báo thấp nhất {forecast.visibility_min_m:.0f}m (WMO: <1000m sương mù, "
            f"<50m sương mù dày), hệ số nguy cơ bổ trợ {factor:.2f} "
            f"(độ ẩm {humidity:.0f}%, chênh nhiệt-điểm sương {spread_c:.1f}°C, địa hình '{terrain}')"
            + (" — hệ số cao, nâng 1 cấp so với phân loại tầm nhìn." if escalated else ".")
        )
        # Điểm phải nằm trong band của level cuối để alert_level/risk_score nhất quán.
        score = _clamp_score_to_level(score, level)
    else:
        level = factor_level
        score = factor_score
        detail = (
            f"Hệ số nguy cơ sương mù {factor:.2f} (độ ẩm {humidity:.0f}%, "
            f"chênh nhiệt-điểm sương {spread_c:.1f}°C, địa hình '{terrain}') "
            "— ước tính, KHÔNG có tầm nhìn dự báo (nguồn thiếu dữ liệu hourly)."
        )

    return HazardRisk(hazard="fog", alert_level=level, risk_score=round(_clamp(score), 1), detail=detail)


def compute_risk(location: LocationInput, forecast: ForecastInput) -> RiskAssessment:
    """Đánh giá rủi ro 4 hiểm hoạ cho 1 ngày dự báo tại 1 địa điểm.

    Hiệu chỉnh nhiệt độ theo cao độ thực tế (downscale_temperature) trước khi
    tính hệ số sương mù. Nếu forecast không kèm elevation_grid_m (Phase 1 hiện
    chưa cung cấp), coi độ cao ô lưới = độ cao thực tế của địa điểm -> không
    hiệu chỉnh (delta = 0), tránh bịa số liệu. Mưa đá/sạt lở đất không phụ
    thuộc nhiệt độ nên dùng thẳng forecast gốc, không downscale.
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
        _hail_risk(forecast),
        _landslide_risk(forecast, location.terrain),
        _heavy_rain_flood_risk(forecast, location.terrain),  # mưa không hiệu chỉnh theo cao độ
        _fog_risk(corrected, location.terrain),
    ]
    return RiskAssessment(location_code=location.code, date=forecast.date, hazards=hazards)
