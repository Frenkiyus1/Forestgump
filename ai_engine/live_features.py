"""Lấy đặc trưng LIVE cho model rủi ro sạt lở/lũ quét theo xã từ các API
công khai miễn phí, không cần API key:

1. **Open-Meteo Forecast API** (https://api.open-meteo.com/v1/forecast) với
   `past_days=3`: mưa thật 1h/24h/72h vừa qua + dự báo mưa 24h tới + độ ẩm
   đất 0-7cm + xác suất mưa — thay thế snapshot mưa tĩnh trong CSV bằng số
   liệu thời điểm gọi.
2. **Open-Meteo Flood API / GloFAS** (https://flood-api.open-meteo.com):
   lưu lượng sông (river_discharge, m³/s) tại centroid xã — chỉ báo bổ sung
   cho lũ quét, trả về trong `live_context` (KHÔNG đưa vào model vì dữ liệu
   huấn luyện chưa có cột này).
3. **Open-Meteo Elevation API** (https://api.open-meteo.com/v1/elevation):
   độ cao centroid (batch tối đa 100 điểm/call) — đặc trưng TĨNH, fetch 1
   lần lúc train (train_terrain.py --fetch-elevation) rồi cache vào
   data/commune_elevation.json.

Các hàm `parse_*` là hàm thuần (dict -> dataclass) để test offline không cần
mạng (test_terrain.py); phần gọi HTTP tách riêng trong `fetch_*`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
_TIMEOUT_S = 10.0

# Điện Biên dùng giờ Việt Nam (UTC+7) — truyền timezone cố định cho Open-Meteo
# để mốc "hiện tại" khi cắt mưa quá khứ/tương lai không lệch theo server.
_VN_TZ = timezone(timedelta(hours=7))
_VN_TZ_NAME = "Asia/Bangkok"


@dataclass(frozen=True)
class LiveRain:
    """Số liệu mưa live tại 1 điểm — cùng ngữ nghĩa các cột mua_* trong CSV."""

    rain_1h_mm: float
    rain_24h_mm: float
    rain_72h_mm: float
    rain_next_24h_mm: float
    soil_moisture_0_7cm: float | None  # m³/m³, chỉ báo bổ sung (không vào model)
    precip_prob_max_next_24h_pct: float | None
    fetched_at: str  # ISO 8601, giờ VN


@dataclass(frozen=True)
class LiveFlood:
    """Lưu lượng sông GloFAS tại 1 điểm — chỉ báo bổ sung cho lũ quét."""

    river_discharge_m3s: float | None  # hôm nay
    river_discharge_max_7d_m3s: float | None  # đỉnh trong 7 ngày tới


def parse_open_meteo_rain(payload: dict, now: datetime | None = None) -> LiveRain:
    """Tính mưa 1h/24h/72h vừa qua + 24h tới từ response hourly của Open-Meteo
    (yêu cầu gọi với past_days>=3, forecast_days>=2, hourly=precipitation,...).

    Hàm thuần để test offline; `now` chỉ dùng trong test — mặc định giờ VN
    hiện tại.
    """
    if now is None:
        now = datetime.now(_VN_TZ)
    now_naive = now.replace(tzinfo=None, minute=0, second=0, microsecond=0)

    hourly = payload["hourly"]
    times = [datetime.fromisoformat(t) for t in hourly["time"]]
    precip = [p if p is not None else 0.0 for p in hourly["precipitation"]]
    # Chỉ số giờ ĐÃ QUA (time < mốc giờ hiện tại) — phần còn lại là dự báo.
    past = [i for i, t in enumerate(times) if t < now_naive]
    future = [i for i, t in enumerate(times) if t >= now_naive]

    def _sum_last(indices: list[int], hours: int) -> float:
        return round(sum(precip[i] for i in indices[-hours:]), 1)

    soil = hourly.get("soil_moisture_0_to_7cm")
    soil_now = None
    if soil is not None and past:
        soil_now = soil[past[-1]]

    prob_max = None
    daily = payload.get("daily")
    if daily and daily.get("precipitation_probability_max"):
        probs = [p for p in daily["precipitation_probability_max"] if p is not None]
        prob_max = float(max(probs)) if probs else None

    return LiveRain(
        rain_1h_mm=_sum_last(past, 1),
        rain_24h_mm=_sum_last(past, 24),
        rain_72h_mm=_sum_last(past, 72),
        rain_next_24h_mm=round(sum(precip[i] for i in future[:24]), 1),
        soil_moisture_0_7cm=soil_now,
        precip_prob_max_next_24h_pct=prob_max,
        fetched_at=now.isoformat(timespec="seconds"),
    )


def parse_open_meteo_flood(payload: dict) -> LiveFlood:
    """Lấy lưu lượng sông hôm nay + đỉnh 7 ngày tới từ response Flood API."""
    discharge = (payload.get("daily") or {}).get("river_discharge") or []
    values = [v for v in discharge if v is not None]
    return LiveFlood(
        river_discharge_m3s=values[0] if values else None,
        river_discharge_max_7d_m3s=max(values) if values else None,
    )


def fetch_live_rain(lat: float, lon: float) -> LiveRain:
    """Gọi Open-Meteo Forecast API lấy mưa 3 ngày qua + 2 ngày tới tại 1 điểm."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "precipitation,soil_moisture_0_to_7cm",
        "daily": "precipitation_probability_max",
        "past_days": 3,
        "forecast_days": 2,
        "timezone": _VN_TZ_NAME,
    }
    response = httpx.get(_FORECAST_URL, params=params, timeout=_TIMEOUT_S)
    response.raise_for_status()
    return parse_open_meteo_rain(response.json())


def fetch_live_flood(lat: float, lon: float) -> LiveFlood:
    """Gọi Open-Meteo Flood API (GloFAS) lấy lưu lượng sông tại 1 điểm.

    GloFAS là mô hình toàn cầu độ phân giải ~5km — tại xã miền núi nhỏ chỉ
    mang tính tham khảo, vì vậy KHÔNG raise khi lỗi: trả LiveFlood(None, None)
    để endpoint live vẫn hoạt động khi Flood API sập.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "river_discharge",
        "forecast_days": 7,
        "timezone": _VN_TZ_NAME,
    }
    try:
        response = httpx.get(_FLOOD_URL, params=params, timeout=_TIMEOUT_S)
        response.raise_for_status()
        return parse_open_meteo_flood(response.json())
    except (httpx.HTTPError, KeyError, ValueError):
        return LiveFlood(river_discharge_m3s=None, river_discharge_max_7d_m3s=None)


def fetch_elevations(coords: list[tuple[float, float]]) -> list[float]:
    """Gọi Open-Meteo Elevation API cho danh sách (lat, lon) — batch 100/call.

    Dùng lúc train (train_terrain.py --fetch-elevation) để build cache
    data/commune_elevation.json; KHÔNG gọi lúc serve.
    """
    elevations: list[float] = []
    for start in range(0, len(coords), 100):
        batch = coords[start : start + 100]
        params = {
            "latitude": ",".join(f"{lat:.6f}" for lat, _ in batch),
            "longitude": ",".join(f"{lon:.6f}" for _, lon in batch),
        }
        response = httpx.get(_ELEVATION_URL, params=params, timeout=_TIMEOUT_S)
        response.raise_for_status()
        elevations.extend(float(v) for v in response.json()["elevation"])
    return elevations
