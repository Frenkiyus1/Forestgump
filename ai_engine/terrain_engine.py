"""Suy luận rủi ro SẠT LỞ + LŨ QUÉT theo xã bằng model XGBoost huấn luyện từ
dienbien_risk_theo_xa.csv (train_terrain.py) — phục vụ endpoint
/assess-terrain-risk và /assess-terrain-risk-live (app.py).

Cùng nguyên tắc an toàn với ml_engine.py: KHÔNG bao giờ raise khi thiếu
model. Nếu chưa chạy train_terrain.py (hoặc load lỗi), predict_terrain_risk()
tự fallback về risk score baseline đã tính sẵn trong CSV (mode="csv_baseline")
— con số này là snapshot lúc build CSV, không phản ánh mưa hiện tại, nên
response luôn ghi rõ mode để không âm thầm trả kết quả sai nguồn.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import xgboost as xgb

from terrain_features import (
    TERRAIN_FEATURE_NAMES,
    CommuneRecord,
    build_terrain_features,
    load_communes,
    load_elevation_cache,
    risk_score_to_level,
)

TERRAIN_MODELS_DIR = Path(__file__).parent / "models" / "terrain"

TerrainTarget = Literal["satlo", "luquet"]
TerrainMode = Literal["model", "csv_baseline"]


@dataclass(frozen=True)
class TerrainPrediction:
    """Kết quả cho 1 xã × 1 hiểm hoạ: risk score 0-1 + cấp cảnh báo 1-5."""

    risk_score: float
    warning_level: int
    mode: TerrainMode


class TerrainRegistry:
    """Nạp 2 model satlo/luquet + danh bạ 130 xã + cache độ cao 1 lần lúc
    khởi động, cache lại cho các lần gọi sau (cùng pattern ml_engine.ModelRegistry)."""

    def __init__(self) -> None:
        self.communes: dict[str, CommuneRecord] = load_communes()
        self.elevation_by_name: dict[str, float] = load_elevation_cache()
        self.models: dict[TerrainTarget, xgb.Booster] = {}
        self.metadata: Optional[dict] = None
        self.load_error: Optional[str] = None
        self._load_models()

    def _load_models(self) -> None:
        metadata_path = TERRAIN_MODELS_DIR / "metadata.json"
        if not metadata_path.exists():
            self.load_error = (
                f"Chưa có {metadata_path.name} — chạy `python train_terrain.py` trước"
            )
            return
        try:
            with open(metadata_path, encoding="utf-8") as f:
                self.metadata = json.load(f)
            if self.metadata.get("feature_names") != TERRAIN_FEATURE_NAMES:
                raise ValueError(
                    "feature_names trong metadata.json lệch TERRAIN_FEATURE_NAMES "
                    "hiện tại — train lại model (python train_terrain.py)"
                )
            for target in ("satlo", "luquet"):
                booster = xgb.Booster()
                booster.load_model(str(TERRAIN_MODELS_DIR / f"{target}.xgb.json"))
                self.models[target] = booster
        except Exception as exc:  # noqa: BLE001 - lỗi nạp model không được làm sập service
            self.models = {}
            self.load_error = f"Lỗi nạp model terrain: {exc}"

    def is_ready(self) -> bool:
        return len(self.models) == 2


_registry: Optional[TerrainRegistry] = None


def get_registry() -> TerrainRegistry:
    global _registry
    if _registry is None:
        _registry = TerrainRegistry()
    return _registry


def predict_terrain_risk(
    commune: CommuneRecord,
    rain_1h_mm: float,
    rain_24h_mm: float,
    rain_72h_mm: float,
    rain_next_24h_mm: float,
) -> dict[TerrainTarget, TerrainPrediction]:
    """Dự đoán risk sạt lở + lũ quét cho 1 xã với số liệu mưa cho trước
    (từ CSV, từ live API, hoặc người dùng nhập). Không bao giờ raise:
    thiếu model -> fallback baseline CSV, mode ghi rõ trong kết quả."""
    registry = get_registry()

    if not registry.is_ready():
        return {
            "satlo": TerrainPrediction(
                risk_score=commune.baseline_risk_satlo,
                warning_level=commune.baseline_level_satlo,
                mode="csv_baseline",
            ),
            "luquet": TerrainPrediction(
                risk_score=commune.baseline_risk_luquet,
                warning_level=commune.baseline_level_luquet,
                mode="csv_baseline",
            ),
        }

    features = build_terrain_features(
        commune,
        rain_1h_mm=rain_1h_mm,
        rain_24h_mm=rain_24h_mm,
        rain_72h_mm=rain_72h_mm,
        rain_next_24h_mm=rain_next_24h_mm,
        elevation_m=registry.elevation_by_name.get(commune.name),
    )
    dmatrix = xgb.DMatrix(
        np.array([features], dtype=np.float32), feature_names=TERRAIN_FEATURE_NAMES
    )
    result: dict[TerrainTarget, TerrainPrediction] = {}
    for target, booster in registry.models.items():
        score = float(np.clip(booster.predict(dmatrix)[0], 0.0, 1.0))
        result[target] = TerrainPrediction(
            risk_score=round(score, 4),
            warning_level=risk_score_to_level(score),
            mode="model",
        )
    return result
