"""ForestGump AI Engine - Dịch vụ dự báo độ mặn (XGBoost).

Nhận CHUỖI quan trắc gần đây {ts, temp, ec, level} từ Backend qua HTTP POST,
dựng đặc trưng time-series (lag, thống kê trượt, pha thuỷ triều) và trả về dự
báo độ mặn cho 24h và 48h tới. Nếu không tìm thấy model đã huấn luyện, dịch vụ
tự động chuyển sang chế độ mock (giá trị ngẫu nhiên) để Backend vẫn hoạt động.
"""

import os
import random
from datetime import datetime, timezone
from typing import Literal

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

from bulletin import generate_bulletin
from features import FEATURE_NAMES, build_features
from risk_engine import ForecastInput, LocationInput, RiskAssessment, compute_risk
from train_flood import FEATURE_NAMES as FLOOD_FEATURE_NAMES
from train_flood import build_flood_features

MODEL_PATH: str = os.getenv("MODEL_PATH", "xgboost_model.json")
# Model riêng cho dự báo 48h. Nếu không có, 48h sẽ tái dùng model 24h
# (xem chú thích trong predict()) — không bịa giá trị bằng nhau như trước.
MODEL_48H_PATH: str = os.getenv("MODEL_48H_PATH", "xgboost_model_48h.json")
# [OPTIONAL/DEMO] Model xác suất lũ quét — xem train_flood.py (dữ liệu tổng hợp,
# CHƯA có dữ liệu lịch sử thật). Không bắt buộc; thiếu file -> /predict-flood-risk
# tự chuyển mock mode như /predict.
FLOOD_MODEL_PATH: str = os.getenv("FLOOD_MODEL_PATH", "flood_model.json")

app = FastAPI(title="ForestGump AI Engine", version="1.0.0")

# --- Nạp model XGBoost (nếu có) ---
model = None
model48 = None
MOCK_MODE: bool = True


def _load_model(path: str):
    """Nạp một Booster XGBoost từ file; trả về None nếu không có/không nạp được."""
    import xgboost as xgb

    if not os.path.exists(path):
        print(f"[AI] WARNING: Model file '{path}' not found.")
        return None
    booster = xgb.Booster()
    booster.load_model(path)
    print(f"[AI] Loaded XGBoost model from '{path}'.")
    return booster


try:
    import xgboost as xgb  # noqa: F401 - kiểm tra thư viện đã cài chưa

    model = _load_model(MODEL_PATH)
    model48 = _load_model(MODEL_48H_PATH)
    MOCK_MODE = model is None
    if MOCK_MODE:
        print("[AI] Running in MOCK mode (random forecasts).")
except ImportError:
    print(
        "[AI] WARNING: 'xgboost' is not installed. "
        "Running in MOCK mode (random forecasts)."
    )
except Exception as exc:  # noqa: BLE001 - log mọi lỗi load model rồi fallback mock
    print(f"[AI] WARNING: Failed to load model ({exc}). Running in MOCK mode.")
    model = None
    model48 = None
    MOCK_MODE = True

# --- [OPTIONAL/DEMO] Nạp model xác suất lũ quét (nếu có) ---
flood_model = None
FLOOD_MOCK_MODE: bool = True

try:
    import xgboost as xgb  # noqa: F401 - kiểm tra thư viện đã cài chưa

    flood_model = _load_model(FLOOD_MODEL_PATH)
    FLOOD_MOCK_MODE = flood_model is None
    if FLOOD_MOCK_MODE:
        print("[AI] /predict-flood-risk running in MOCK mode (random probability).")
except ImportError:
    print("[AI] WARNING: 'xgboost' is not installed. /predict-flood-risk MOCK mode.")
except Exception as exc:  # noqa: BLE001
    print(f"[AI] WARNING: Failed to load flood model ({exc}). MOCK mode.")
    flood_model = None
    FLOOD_MOCK_MODE = True


class Reading(BaseModel):
    """Một điểm quan trắc trong chuỗi lịch sử."""

    ts: str  # ISO timestamp
    temp: float
    ec: float
    level: float


class PredictRequest(BaseModel):
    """Payload đầu vào: chuỗi quan trắc gần đây (ascending, cuối = hiện tại)."""

    history: list[Reading]


class PredictResponse(BaseModel):
    """Kết quả dự báo trả về cho Backend."""

    forecast_24h: float
    forecast_48h: float


def _to_epoch(ts: str) -> float:
    """ISO timestamp -> epoch giây (chấp nhận hậu tố 'Z')."""
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc).timestamp()


@app.get("/health")
def health() -> dict:
    """Kiểm tra trạng thái dịch vụ và chế độ chạy."""
    return {"status": "ok", "mode": "mock" if MOCK_MODE else "model"}


@app.post("/predict", response_model=PredictResponse)
def predict(data: PredictRequest) -> PredictResponse:
    """Dự báo độ mặn 24h và 48h tới từ chuỗi quan trắc gần đây."""
    if MOCK_MODE or model is None or not data.history:
        # Mock: 48h biến động mạnh hơn 24h, là giá trị ĐỘC LẬP (không bằng 24h).
        forecast24: float = round(random.uniform(1.0, 6.0), 2)
        forecast48: float = round(random.uniform(1.0, 7.0), 2)
        return PredictResponse(forecast_24h=forecast24, forecast_48h=forecast48)

    import xgboost as xgb

    # Sắp xếp tăng dần theo thời gian (đề phòng backend gửi lệch thứ tự).
    rows = sorted(data.history, key=lambda r: _to_epoch(r.ts))
    ts = np.array([_to_epoch(r.ts) for r in rows], dtype=float)
    ec = np.array([r.ec for r in rows], dtype=float)
    temp = np.array([r.temp for r in rows], dtype=float)
    level = np.array([r.level for r in rows], dtype=float)

    features = build_features(ts, ec, temp, level).reshape(1, -1)
    dmatrix = xgb.DMatrix(features, feature_names=FEATURE_NAMES)

    forecast24 = round(float(model.predict(dmatrix)[0]), 2)
    # 48h: dùng model 48h riêng nếu có; nếu chưa train thì tái dùng model 24h.
    horizon_model = model48 if model48 is not None else model
    forecast48 = round(float(horizon_model.predict(dmatrix)[0]), 2)

    return PredictResponse(forecast_24h=forecast24, forecast_48h=forecast48)


class DayAssessment(BaseModel):
    """Kết quả đánh giá rủi ro + bản tin cảnh báo cho 1 ngày."""

    risk: RiskAssessment
    bulletin: str


class AssessRiskRequest(BaseModel):
    """Payload đầu vào: 1 địa điểm + dự báo 3-7 ngày (khớp bảng weather_forecast)."""

    location: LocationInput
    forecast: list[ForecastInput]


class AssessRiskResponse(BaseModel):
    location_code: str
    days: list[DayAssessment]


@app.post("/assess-risk", response_model=AssessRiskResponse)
def assess_risk(data: AssessRiskRequest) -> AssessRiskResponse:
    """Đánh giá rủi ro (rét đậm/rét hại, mưa lớn/lũ quét, sương mù) + bản tin
    cảnh báo cho từng ngày trong dự báo Điện Biên. Rule-based (risk_engine.py),
    không phụ thuộc model ML nên luôn hoạt động (không có mock mode)."""
    days: list[DayAssessment] = []
    for day_forecast in data.forecast:
        risk = compute_risk(data.location, day_forecast)
        bulletin = generate_bulletin(data.location, risk)
        days.append(DayAssessment(risk=risk, bulletin=bulletin))
    return AssessRiskResponse(location_code=data.location.code, days=days)


class PredictFloodRiskRequest(BaseModel):
    """[OPTIONAL/DEMO] Đầu vào cho model xác suất lũ quét (train_flood.py)."""

    rain_24h_mm: float
    rain_12h_mm: float = 0.0
    terrain: Literal["thung_lung", "nui_cao", "ven_suoi"]
    elevation_m: float
    humidity_pct: float


class PredictFloodRiskResponse(BaseModel):
    flood_probability: float  # 0-1
    mode: str  # "mock" | "model"


@app.post("/predict-flood-risk", response_model=PredictFloodRiskResponse)
def predict_flood_risk(data: PredictFloodRiskRequest) -> PredictFloodRiskResponse:
    """[OPTIONAL/DEMO] Xác suất lũ quét từ model ML huấn luyện trên dữ liệu TỔNG
    HỢP (xem train_flood.py — chưa có dữ liệu lịch sử thật, docs/dienbien-phase1.md).
    Chỉ dùng tham khảo/demo, KHÔNG thay thế risk_engine.compute_risk() rule-based
    (nguồn đánh giá rủi ro chính thức của hệ thống)."""
    if FLOOD_MOCK_MODE or flood_model is None:
        return PredictFloodRiskResponse(flood_probability=round(random.uniform(0.0, 1.0), 3), mode="mock")

    features = build_flood_features(
        data.rain_24h_mm, data.rain_12h_mm, data.terrain, data.elevation_m, data.humidity_pct
    ).reshape(1, -1)
    dmatrix = xgb.DMatrix(features, feature_names=FLOOD_FEATURE_NAMES)
    probability = float(flood_model.predict(dmatrix)[0])
    return PredictFloodRiskResponse(flood_probability=round(probability, 3), mode="model")
