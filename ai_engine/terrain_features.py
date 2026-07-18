"""Feature engineering cho model rủi ro SẠT LỞ + LŨ QUÉT theo xã (130 xã
Điện Biên, nguồn: docs/dienbien_risk_theo_xa.csv, bản sao phục vụ service
tại ai_engine/data/).

DÙNG CHUNG giữa huấn luyện (train_terrain.py) và suy luận (terrain_engine.py)
— 2 nơi PHẢI dùng đúng 1 hàm build_terrain_features() để vector đặc trưng
không lệch nhau giữa lúc train và lúc predict (cùng nguyên tắc với
ml_features.py của nhánh multi-hazard).

Nhóm đặc trưng:
- TĨNH (địa hình, tính sẵn từ DEM trong CSV): slope_mean, flow_accum_max
  (log1p vì trải 5.4e3 → 1.5e6), twi_mean, curvature_std + elevation_m lấy
  từ Open-Meteo Elevation API (cache data/commune_elevation.json, NaN nếu
  chưa fetch — XGBoost xử lý missing tự nhiên).
- ĐỘNG (mưa, thay được bằng số liệu live từ Open-Meteo): mua_1h, mua_24h,
  mua_72h, mua_dubao_24h_toi.
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path

_DATA_DIR = Path(__file__).parent / "data"
# Bản sao trong ai_engine/data (dùng cho Docker); fallback bản gốc trong docs/.
_CSV_CANDIDATES = [
    _DATA_DIR / "dienbien_risk_theo_xa.csv",
    Path(__file__).parent.parent / "docs" / "dienbien_risk_theo_xa.csv",
]
ELEVATION_CACHE_PATH = _DATA_DIR / "commune_elevation.json"

# Thứ tự cột PHẢI cố định — model XGBoost đã train gắn chặt với thứ tự này.
# Đổi/thêm cột thì PHẢI train lại model (chạy lại train_terrain.py).
TERRAIN_FEATURE_NAMES: list[str] = [
    "slope_mean_deg",
    "log_flow_accum",
    "twi_mean",
    "curvature_std",
    "elevation_m",
    "rain_1h_mm",
    "rain_24h_mm",
    "rain_72h_mm",
    "rain_next_24h_mm",
]

# Ngưỡng quy đổi risk_score (0-1) -> cấp cảnh báo 1-5 (khớp 100% với cột
# muc_canhbao_* trong CSV; cùng tinh thần cấp độ rủi ro thiên tai QĐ 18/2021).
_LEVEL_THRESHOLDS: list[float] = [0.2, 0.4, 0.6, 0.8]


def risk_score_to_level(score: float) -> int:
    """Quy đổi risk score 0-1 thành cấp cảnh báo 1-5 (ngưỡng 0.2/0.4/0.6/0.8)."""
    level = 1
    for threshold in _LEVEL_THRESHOLDS:
        if score >= threshold:
            level += 1
    return level


@dataclass(frozen=True)
class CommuneRecord:
    """1 dòng trong dienbien_risk_theo_xa.csv — đặc trưng tĩnh + snapshot mưa
    và risk baseline tại thời điểm xây file (dùng làm fallback khi model chưa
    train)."""

    name: str
    centroid_lat: float
    centroid_lon: float
    slope_mean: float
    flow_accum_max: float
    twi_mean: float
    curvature_std: float
    rain_1h_mm: float
    rain_24h_mm: float
    rain_72h_mm: float
    rain_next_24h_mm: float
    baseline_risk_satlo: float
    baseline_risk_luquet: float
    baseline_level_satlo: int
    baseline_level_luquet: int


def load_communes() -> dict[str, CommuneRecord]:
    """Nạp CSV thành dict {tên xã (NAME_3) -> CommuneRecord}. 130 xã, tên duy nhất."""
    for path in _CSV_CANDIDATES:
        if path.exists():
            return _parse_csv(path)
    raise FileNotFoundError(
        f"Không tìm thấy dienbien_risk_theo_xa.csv tại: {[str(p) for p in _CSV_CANDIDATES]}"
    )


def _parse_csv(path: Path) -> dict[str, CommuneRecord]:
    communes: dict[str, CommuneRecord] = {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            record = CommuneRecord(
                name=row["NAME_3"].strip(),
                centroid_lat=float(row["centroid_lat"]),
                centroid_lon=float(row["centroid_lon"]),
                slope_mean=float(row["slope_mean"]),
                flow_accum_max=float(row["flow_accum_max"]),
                twi_mean=float(row["twi_mean"]),
                curvature_std=float(row["curvature_std"]),
                rain_1h_mm=float(row["mua_1h"]),
                rain_24h_mm=float(row["mua_24h"]),
                rain_72h_mm=float(row["mua_72h"]),
                rain_next_24h_mm=float(row["mua_dubao_24h_toi"]),
                baseline_risk_satlo=float(row["risk_satlo"]),
                baseline_risk_luquet=float(row["risk_luquet"]),
                baseline_level_satlo=int(row["muc_canhbao_satlo"]),
                baseline_level_luquet=int(row["muc_canhbao_luquet"]),
            )
            communes[record.name] = record
    return communes


def load_elevation_cache() -> dict[str, float]:
    """Đọc cache độ cao theo xã (data/commune_elevation.json) — sinh bởi
    `python train_terrain.py --fetch-elevation`. Trả {} nếu chưa fetch."""
    if not ELEVATION_CACHE_PATH.exists():
        return {}
    try:
        with open(ELEVATION_CACHE_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return {str(k): float(v) for k, v in data.items()}
    except (json.JSONDecodeError, OSError, ValueError):
        return {}


def build_terrain_features(
    commune: CommuneRecord,
    rain_1h_mm: float,
    rain_24h_mm: float,
    rain_72h_mm: float,
    rain_next_24h_mm: float,
    elevation_m: float | None = None,
) -> list[float]:
    """Vector đặc trưng theo đúng thứ tự TERRAIN_FEATURE_NAMES.

    Args:
        commune: đặc trưng địa hình tĩnh của xã (từ CSV).
        rain_*: số liệu mưa — lúc train lấy từ CSV, lúc serve có thể thay
            bằng số liệu live (live_features.fetch_live_rain).
        elevation_m: độ cao centroid (m) từ Elevation API; None -> NaN.
    """
    return [
        commune.slope_mean,
        math.log1p(commune.flow_accum_max),
        commune.twi_mean,
        commune.curvature_std,
        elevation_m if elevation_m is not None else math.nan,
        rain_1h_mm,
        rain_24h_mm,
        rain_72h_mm,
        rain_next_24h_mm,
    ]
