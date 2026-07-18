"""Suy luận rủi ro bằng XGBoost — chạy SONG SONG với rule engine
(risk_engine.py), KHÔNG thay thế. Theo quyết định đã chọn: rule engine vẫn
là nguồn sự thật (source of truth) cho production /assess-risk; module này
phục vụ thử nghiệm/đánh giá (eval_xgb.py) và làm nền cho route riêng sau
này (vd. /assess-risk-ml) khi cần.

Vì sao vẫn fallback về rule engine: model được distill từ chính rule engine
trên dữ liệu TỔNG HỢP (xem train_xgb.py) — CHƯA có quan trắc thật để kiểm
chứng độc lập. Nếu thiếu file model (chưa chạy train_xgb.py) hoặc load lỗi,
assess_risk_ml() tự động dùng lại risk_engine.compute_risk() và đánh dấu rõ
trong RiskAssessment (qua detail) để không âm thầm trả kết quả sai nguồn.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import xgboost as xgb

from downscale import downscale_temperature
from ml_features import FEATURE_NAMES, build_features
from risk_engine import (
    ForecastInput,
    Hazard,
    HazardRisk,
    LocationInput,
    RiskAssessment,
    compute_risk,
)
from thresholds import AlertLevel, SCORE_ORANGE_MIN, SCORE_RED_MIN, SCORE_YELLOW_MIN

MODELS_DIR = Path(__file__).parent / "models"
HAZARDS: list[Hazard] = ["cold_damage", "heavy_rain_flood", "fog"]

# Điểm đại diện (mid-point) của mỗi band alert_level — dùng để quy đổi
# xác suất lớp (predict_proba) của XGBoost thành risk_score 0-100 liên tục,
# CÙNG thang điểm với rule engine (thresholds.SCORE_*) để 2 nguồn so sánh
# được trực tiếp.
_BAND_MIDPOINT: dict[AlertLevel, float] = {
    "green": SCORE_YELLOW_MIN / 2.0,
    "yellow": (SCORE_YELLOW_MIN + SCORE_ORANGE_MIN) / 2.0,
    "orange": (SCORE_ORANGE_MIN + SCORE_RED_MIN) / 2.0,
    "red": (SCORE_RED_MIN + 100.0) / 2.0,
}


class HazardModel:
    """1 model XGBoost (Booster thô, không dùng sklearn wrapper để tránh lệ
    thuộc version pickle) + danh sách lớp theo đúng thứ tự lúc train."""

    def __init__(self, booster: xgb.Booster, classes: list[AlertLevel], test_accuracy: float):
        self.booster = booster
        self.classes = classes
        self.test_accuracy = test_accuracy

    def predict(self, feature_vector: list[float]) -> tuple[AlertLevel, float, dict[AlertLevel, float]]:
        """Dự đoán 1 mẫu. Trả (alert_level, risk_score 0-100, xác suất từng lớp)."""
        dmatrix = xgb.DMatrix(
            np.array([feature_vector], dtype=np.float32), feature_names=FEATURE_NAMES
        )
        proba = self.booster.predict(dmatrix)[0]  # shape (n_classes,) do objective multi:softprob
        proba_by_class = {cls: float(p) for cls, p in zip(self.classes, proba)}

        best_idx = int(np.argmax(proba))
        alert_level = self.classes[best_idx]
        risk_score = sum(p * _BAND_MIDPOINT[cls] for cls, p in proba_by_class.items())
        return alert_level, round(risk_score, 1), proba_by_class


class ModelRegistry:
    """Nạp toàn bộ model + metadata.json 1 lần, cache lại cho các lần gọi sau."""

    def __init__(self) -> None:
        self.models: dict[Hazard, HazardModel] = {}
        self.metadata: Optional[dict] = None
        self.load_error: Optional[str] = None
        self._load()

    def _load(self) -> None:
        metadata_path = MODELS_DIR / "metadata.json"
        if not metadata_path.exists():
            self.load_error = (
                f"Không tìm thấy {metadata_path} — chạy `python train_xgb.py` trước để sinh model."
            )
            return
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            if metadata.get("feature_names") != FEATURE_NAMES:
                raise ValueError(
                    "feature_names trong metadata.json không khớp ml_features.FEATURE_NAMES hiện "
                    "tại — model đã train với bộ đặc trưng cũ, cần chạy lại train_xgb.py."
                )
            for hazard in HAZARDS:
                hazard_meta = metadata["hazards"][hazard]
                booster = xgb.Booster()
                booster.load_model(str(MODELS_DIR / hazard_meta["model_file"]))
                self.models[hazard] = HazardModel(
                    booster=booster,
                    classes=hazard_meta["classes"],
                    test_accuracy=hazard_meta["test_accuracy"],
                )
            self.metadata = metadata
        except Exception as exc:  # noqa: BLE001 - muốn bắt mọi lỗi load để fallback an toàn
            self.load_error = f"Lỗi nạp model XGBoost: {exc}"
            self.models = {}

    @property
    def is_ready(self) -> bool:
        return not self.load_error and len(self.models) == len(HAZARDS)


# Nạp 1 lần khi import module — nếu chưa train, is_ready=False và mọi lệnh
# gọi assess_risk_ml() sẽ fallback về rule engine (không raise lỗi).
_registry = ModelRegistry()


def reload_models() -> ModelRegistry:
    """Nạp lại model từ đĩa (dùng sau khi train lại) — hữu ích cho eval_xgb.py
    và test, tránh phải khởi động lại process."""
    global _registry
    _registry = ModelRegistry()
    return _registry


def predict_hazard_ml(
    forecast: ForecastInput, terrain: str, hazard: Hazard
) -> tuple[AlertLevel, float, dict[AlertLevel, float]]:
    """Dự đoán 1 hiểm hoạ bằng XGBoost. Ném lỗi nếu model chưa sẵn sàng —
    dùng assess_risk_ml() ở mức cao hơn để có fallback tự động."""
    if not _registry.is_ready:
        raise RuntimeError(_registry.load_error or "Model XGBoost chưa sẵn sàng.")
    features = build_features(forecast, terrain)  # type: ignore[arg-type]
    return _registry.models[hazard].predict(features)


def assess_risk_ml(location: LocationInput, forecast: ForecastInput) -> RiskAssessment:
    """Tương đương risk_engine.compute_risk() nhưng dùng XGBoost thay vì
    if/threshold thuần. Tự động fallback về compute_risk() (rule engine) nếu
    model chưa train/lỗi load — KHÔNG bao giờ để service sập vì thiếu model.

    Cùng bước hiệu chỉnh cao độ (downscale_temperature) như rule engine để
    vector đặc trưng nhất quán với lúc train (xem ml_features.build_features).
    """
    if not _registry.is_ready:
        fallback = compute_risk(location, forecast)
        for hazard_risk in fallback.hazards:
            hazard_risk.detail = (
                f"[FALLBACK RULE ENGINE — model XGBoost chưa sẵn sàng: {_registry.load_error}] "
                + hazard_risk.detail
            )
        return fallback

    elevation_grid = (
        forecast.elevation_grid_m if forecast.elevation_grid_m is not None else location.elevation_m
    )
    corrected = forecast.model_copy(
        update={
            "temp_min_c": downscale_temperature(forecast.temp_min_c, elevation_grid, location.elevation_m),
            "temp_max_c": downscale_temperature(forecast.temp_max_c, elevation_grid, location.elevation_m),
        }
    )

    hazards: list[HazardRisk] = []
    for hazard in HAZARDS:
        alert_level, score, proba = predict_hazard_ml(corrected, location.terrain, hazard)
        proba_str = ", ".join(f"{cls}={p:.2f}" for cls, p in proba.items())
        model_acc = _registry.models[hazard].test_accuracy
        detail = (
            f"[XGBoost, agreement với rule engine trên tập test: {model_acc:.1%}] "
            f"Xác suất lớp: {proba_str}."
        )
        hazards.append(HazardRisk(hazard=hazard, alert_level=alert_level, risk_score=score, detail=detail))

    return RiskAssessment(location_code=location.code, date=forecast.date, hazards=hazards)
